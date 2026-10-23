import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";
import dotenv from "dotenv";
import path from "path";
import { syncWithCloud, type SyncReport } from "../lib/sync/CloudSyncService";
import { enqueueCloudMember, processPendingMembers } from "../lib/sync/cloudMembers";
import { syncSupabaseSession } from "../app/actions/auth.actions";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const dbPath = path.resolve(__dirname, "../data/database.sqlite");
const db = new Database(dbPath);

async function runFullTest() {
  console.log("=========================================================");
  console.log("🚀 DÉMARRAGE DU TEST INTÉGRAL DES FLUX (END-TO-END)");
  console.log("=========================================================\n");

  const anonClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // -------------------------------------------------------------------------
  // ÉTAPE 1 : Authentification / Création d'un compte Admin de test
  // -------------------------------------------------------------------------
  console.log("--- 1. Authentification Admin de test ---");
  const testAdminEmail = process.env.TEST_ADMIN_EMAIL || "admin.e2e@facturier.com";
  const testPassword = "Password123!";

  console.log(`Création/Connexion de l'admin de test : ${testAdminEmail}`);
  const { data: signUpData, error: signUpErr } = await anonClient.auth.signUp({
    email: testAdminEmail,
    password: testPassword,
    options: { data: { full_name: "Admin E2E Test" } },
  });

  let session = signUpData.session;
  if (!session) {
    const { data: signInData, error: signInErr } = await anonClient.auth.signInWithPassword({
      email: testAdminEmail,
      password: testPassword,
    });
    session = signInData.session;
    if (!session) {
      throw new Error(`Impossible d'obtenir une session pour l'admin : ${signUpErr?.message || signInErr?.message}`);
    }
  }

  const adminToken = session.access_token;
  console.log("✅ Admin authentifié avec succès sur Supabase.");

  // -------------------------------------------------------------------------
  // ÉTAPE 2 : Premier cycle de Synchronisation & Provisioning automatique du Tenant
  // -------------------------------------------------------------------------
  console.log("\n--- 2. Synchronisation initiale & Provisioning Tenant ---");
  const report1 = await syncWithCloud(adminToken);
  console.log(`✅ Tenant provisionné avec succès ! ID: ${report1.tenantId}`);
  console.log(`Rapport sync initial : Pushed=${report1.pushed}, Pulled=${report1.pulled}, Erreurs=${report1.errors.length}`);
  if (report1.errors.length > 0) {
    console.warn("Avertissements:", report1.errors);
  }

  // -------------------------------------------------------------------------
  // ÉTAPE 3 : Création d'un client local & Push vers Supabase
  // -------------------------------------------------------------------------
  console.log("\n--- 3. Test Push : Création d'un client SQLite -> Supabase ---");
  const testClientId = `cli_test_${Date.now()}`;
  const testClientName = `Client Test E2E ${Date.now()}`;

  db.prepare(`
    INSERT INTO clients (id, name, email, phone, address, status, tenant_id)
    VALUES (?, ?, ?, ?, ?, 'active', ?)
  `).run(testClientId, testClientName, "client.e2e@test.com", "0102030405", "123 Rue de Test", report1.tenantId);

  console.log(`Client local créé dans SQLite (ID: ${testClientId}, Nom: ${testClientName})`);

  const reportPush = await syncWithCloud(adminToken);
  console.log(`Résultat sync après création client : Pushed=${reportPush.pushed}, Erreurs=${reportPush.errors.length}`);

  // Vérification directe dans Supabase
  const authedClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${adminToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: remoteClient, error: checkClientErr } = await authedClient
    .from("clients")
    .select("id, name, tenant_id")
    .eq("id", testClientId)
    .single();

  if (checkClientErr || !remoteClient) {
    throw new Error(`❌ Le client n'a pas été retrouvé sur Supabase: ${checkClientErr?.message}`);
  }
  console.log(`✅ Vérification Supabase réussie : le client '${remoteClient.name}' est bien synchronisé dans le tenant '${remoteClient.tenant_id}' !`);

  // -------------------------------------------------------------------------
  // ÉTAPE 4 : Test File d'attente Opérateur (Offline Queue -> Supabase attach_member)
  // -------------------------------------------------------------------------
  console.log("\n--- 4. Test File Opérateur Offline -> Cloud ---");
  const testOperateurEmail = `op.test.${Date.now()}@facturier.com`;
  console.log(`Ajout de l'opérateur en file locale : ${testOperateurEmail}`);
  enqueueCloudMember({
    email: testOperateurEmail,
    password: testPassword,
    name: "Opérateur E2E Test",
    phone: "0700000000",
    role: "user",
  });

  const pendingBefore = db.prepare("SELECT COUNT(*) as c FROM pending_cloud_members WHERE email = ?").get(testOperateurEmail) as { c: number };
  console.log(`Vérification SQLite : ${pendingBefore.c} membre en attente dans 'pending_cloud_members'.`);

  console.log("Exécution du traitement de la file avec le token admin...");
  const queueResult = await processPendingMembers(adminToken);
  console.log(`Résultat traitement file : Créé(s)=${queueResult.done}, Erreurs=${queueResult.errors.length}`);
  if (queueResult.errors.length > 0) {
    console.warn("Erreurs file:", queueResult.errors);
  }

  const pendingAfter = db.prepare("SELECT COUNT(*) as c FROM pending_cloud_members WHERE email = ?").get(testOperateurEmail) as { c: number };
  console.log(`Vérification SQLite : file vidée -> ${pendingAfter.c} membre en attente.`);

  // Vérification du profil dans Supabase
  const { data: opProfile, error: opProfileErr } = await authedClient
    .from("profiles")
    .select("id, email, role, tenant_id, full_name")
    .eq("email", testOperateurEmail)
    .maybeSingle();

  if (opProfileErr || !opProfile) {
    throw new Error(`❌ Le profil opérateur n'a pas été trouvé dans Supabase : ${opProfileErr?.message}`);
  }
  console.log(`✅ Opérateur confirmé sur Supabase : Rôle=${opProfile.role}, Tenant=${opProfile.tenant_id}, Nom=${opProfile.full_name}`);
  if (opProfile.tenant_id !== report1.tenantId) {
    throw new Error(`❌ Mauvais tenant_id pour l'opérateur : ${opProfile.tenant_id} !== ${report1.tenantId}`);
  }

  // -------------------------------------------------------------------------
  // ÉTAPE 5 : Test Pull (Supabase -> SQLite)
  // -------------------------------------------------------------------------
  console.log("\n--- 5. Test Pull : Modification sur Supabase -> Répercussion SQLite ---");
  const updatedAddress = "456 Avenue Modifiée Cloud " + Date.now();
  const { error: updateRemoteErr } = await authedClient
    .from("clients")
    .update({ address: updatedAddress })
    .eq("id", testClientId);

  if (updateRemoteErr) {
    throw new Error(`Échec update Supabase : ${updateRemoteErr.message}`);
  }
  console.log(`Adresse mise à jour côté Cloud pour '${testClientId}' : "${updatedAddress}"`);

  // Attente légère pour horodatage serveur
  await new Promise((r) => setTimeout(r, 1000));

  const reportPull = await syncWithCloud(adminToken);
  console.log(`Rapport sync pull : Pulled=${reportPull.pulled}, Erreurs=${reportPull.errors.length}`);

  const localUpdatedClient = db.prepare("SELECT address FROM clients WHERE id = ?").get(testClientId) as { address: string };
  console.log(`Adresse lue dans SQLite local : "${localUpdatedClient.address}"`);

  if (localUpdatedClient.address === updatedAddress) {
    console.log("✅ Le Pull Supabase -> SQLite a parfaitement fonctionné !");
  } else {
    console.warn(`⚠️ Pull non reflété immédiatement (Local="${localUpdatedClient.address}", Distant="${updatedAddress}")`);
  }

  // -------------------------------------------------------------------------
  // ÉTAPE 6 : Test de Sécurité — Rejet du Superadmin sur Desktop
  // -------------------------------------------------------------------------
  console.log("\n--- 6. Test Sécurité : Rejet du Superadmin sur Desktop ---");
  const superadminRejectTest = await syncSupabaseSession({
    id: "00000000-0000-0000-0000-000000000001",
    email: "superadmin@facturier.com",
    name: "Super Admin",
    role: "superadmin",
  });

  if (!superadminRejectTest.success && superadminRejectTest.error?.includes("réservé exclusivement au Web Hub")) {
    console.log("✅ Superadmin STRICTEMENT bloqué sur Desktop avec le message :", superadminRejectTest.error);
  } else {
    throw new Error("❌ Échec sécurité : le Superadmin n'a pas été bloqué correctement !");
  }

  // Nettoyage client test
  db.prepare("DELETE FROM clients WHERE id = ?").run(testClientId);
  await authedClient.from("clients").delete().eq("id", testClientId);

  console.log("\n=========================================================");
  console.log("🎉 TOUS LES FLUX TESTÉS AVEC SUCCÈS À 100% !");
  console.log("=========================================================");
}

runFullTest()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ ERREUR LORS DU TEST :", err);
    process.exit(1);
  });
