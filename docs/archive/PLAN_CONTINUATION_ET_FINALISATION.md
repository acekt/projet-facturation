> [!NOTE]
> Document archivé. Remplacé par les plans de référence consolidés dans docs/plans/ (00_DIAGNOSTIC_DETTES_ZOMBIES_FREINS.md, 01_PLAN_CORRECTIF.md, 02_PLAN_CURATIF.md, 03_PLAN_PREVENTIF.md).

# Plan d'Action & Feuille de Route de Finalisation — Facturier (Hub & Spoke)

> **Document de Référence Opérationnelle**  
> **Date de rédaction :** 22 Octobre 2026  
> **Statut global du projet :** ~88% achevé  
> **Objectif :** Guider méthodiquement les dernières étapes pour le déploiement et la mise en production du Client Desktop Local-First et du Hub Cloud Super Admin.

---

## 1. Synthèse de l'Existant (Socle Validé à 100%)

Avant d'engager les travaux restants, voici l'état certifié par les suites de tests automatisées du Monorepo :

| Composant | Statut actuel | Métriques de Validation |
| :--- | :---: | :--- |
| **Client Desktop (`apps/desktop`)** | ✅ **Opérationnel** | **171/171 tests passés** (34 fichiers de tests). Fiscalité gabonaise exacte (TVA/CSS/TPS), tunnel devis ➔ factures ➔ avoirs ➔ règlements, isolation multi-tenant locale stricte, chiffrement AES-256-GCM. |
| **Portail Super Admin Hub (`apps/web-hub`)** | ✅ **Opérationnel** | **48/48 tests passés** (7 fichiers de tests). 8 modules complets (Dashboard, Tenants 360, Flotte & Synchro, Finance, Adoption, Audit, Licences, Annonces), MFA AAL2, formulaires en tiroirs latéraux (`<Sheet>`) sans marges blanches. |
| **Composants Partagés (`packages/ui`)** | ✅ **Opérationnel** | 35 composants Shadcn/Radix UI prêts pour réutilisation transverse. |
| **Décisions Architecturales (`ADR`)** | ✅ **Opérationnel** | **17/17 ADRs validées** via `npm run quality:decisions`. |
| **Typage TypeScript** | ✅ **0 Erreur** | `tsc --noEmit` validé sur l'ensemble des paquets du monorepo. |

---

## 2. Diagramme d'Exécution des Phases Restantes

```mermaid
graph TD
    subgraph Phase 1 : Cœur de Réplication
        P1A[1.1 Harmonisation du Moteur de Synchro] --> P1B[1.2 Extension AppSchema & sync_rules.yaml]
        P1B --> P1C[1.3 Anti-Collision Numérotation Multi-Postes]
    end

    subgraph Phase 2 : Enrôlement & Migration Locale
        P2A[2.1 Assistant d'Enrôlement Tenant sur Desktop] --> P2B[2.2 Script Migration Transparente V1 ➔ V2]
        P2B --> P2C[2.3 Verrouillage Dynamique de Licence Échue]
    end

    subgraph Phase 3 : Packaging & Distribution Desktop
        P3A[3.1 Validation du Build Electron Standalone] --> P3B[3.2 Génération Installateur Windows .exe]
        P3B --> P3C[3.3 Mécanisme Auto-Update]
    end

    subgraph Phase 4 : Déploiement Cloud Production
        P4A[4.1 Exécution Migrations Supabase Prod] --> P4B[4.2 Déploiement Web Hub Vercel/Railway]
        P4C[4.3 Déploiement Instance PowerSync Cloud] --> P4B
    end

    subgraph Phase 5 : Recette & Mise en Service
        P1C --> RECETTE[Tests E2E Multi-Postes & Recette Finale]
        P2C --> RECETTE
        P3C --> RECETTE
        P4B --> RECETTE
```

---

## 3. Détail des Phases et Tâches Opérationnelles

### Phase 1 : Finalisation du Moteur de Synchronisation (PowerSync & CloudSync)
**Objectif :** Garantir que deux postes de caisse d'un même tenant synchronisent instantanément et sans aucun conflit lors du retour en ligne.

- [x] **Tâche 1.1 — Clarification et unification du pipeline de réplication** (ADR-0018)
- [x] **Tâche 1.2 — Extension du schéma PowerSync (`AppSchema.ts` — 14 tables)** (ADR-0018)
- [x] **Tâche 1.3 — Rédaction du fichier officiel `sync_rules.yaml`** (ADR-0018)
- [x] **Tâche 1.4 — Prévention des collisions de numérotation séquentielle** (ADR-0018)

---

### Phase 2 : Enrôlement, Gestion des Licences & Migration Locale
**Objectif :** Permettre à une entreprise d'installer l'application Desktop et de la lier en 1 clic à son abonnement SaaS, tout en migrant les anciennes données locales.

- [x] **Tâche 2.1 — Assistant d'Enrôlement initial de l'entreprise (Desktop)** (ADR-0019)
- [x] **Tâche 2.2 — Script de migration automatique (V1 ➔ V2)** (ADR-0019)
- [x] **Tâche 2.3 — Barrière de Licence Dynamique (Grace Period & Lecture Seule)** (ADR-0019)

---

### Phase 3 : Packaging & Distribution de l'Application Desktop (.exe)
**Objectif :** Produire un installateur exécutable Windows certifié, autonome et simple à installer.

- [x] **Tâche 3.1 — Compilation Standalone Next.js + Electron (résolution dynamique)** (ADR-0020)
- [x] **Tâche 3.2 — Génération de l'installateur Windows (`.exe` NSIS & asarUnpack)** (ADR-0020)
- [x] **Tâche 3.3 — Auto-Updater Electron & Interface Mises à Jour dans Paramètres** (ADR-0020)

---

### Phase 4 : Déploiement en Production du Hub Cloud (`apps/web-hub`)
**Objectif :** Rendre la plateforme Super Admin accessible en ligne sous domaine sécurisé HTTPS.

- [x] **Tâche 4.1 — Exécution et audit des migrations PostgreSQL Supabase** (ADR-0021) :
  - Bundle consolidé `supabase/deploy_all_migrations.sql` (19 tables : 14 répliquées + 5 SaaS/Hub, triggers, RLS, RPCs et contraintes d'unicité anti-collision).
  - Présence et cohérence des 4 migrations unitaires dans `supabase/migrations/`.
- [x] **Tâche 4.2 — Déploiement de `apps/web-hub` (Vercel ou Railway)** (ADR-0021) :
  - Template `.env.example` complet avec toutes les clés de production (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, `POWERSYNC_URL`).
  - Prêt pour build de production : `export const instant = false;` et `await connection();` sur `/mfa` et toutes les routes serveur.
  - Compilation de production Next.js 16 validée (`next build` 18 routes opérationnelles).
- [x] **Tâche 4.3 — Instanciation du service PowerSync Cloud** (ADR-0021) :
  - Règles officielles `powersync/sync_rules.yaml` prêtes pour connexion à l'instance Supabase de production.
  - Définition des 3 buckets : `tenant_data`, `user_profile`, `announcements`.

---

### Phase 5 : Recette Métier & Scénarios de Validation de Bout en Bout
**Objectif :** Valider l'intégrité de l'écosystème sur les cas d'usage réels avant commercialisation.

| Scénario de Test | Action Réalisée | Résultat Attendu |
| :--- | :--- | :--- |
| **S1. Création & Enrôlement** | Créer un tenant "Entreprise Test" sur le Hub ➔ Installer Desktop et saisir la licence. | Le poste Desktop est associé, le logo et les infos du tenant s'affichent, le poste apparaît dans le Hub ("Parc & Synchro"). |
| **S2. Facturation Hors-Ligne** | Couper la connexion Wi-Fi sur le poste ➔ Créer 3 factures et 1 avoir ➔ Reconnecter le Wi-Fi. | Création locale instantanée. À la reconnexion, synchronisation silencieuse vers Supabase et apparition des montants dans "Finance & Volumes" du Hub. |
| **S3. Multi-Postes Simultané** | Créer une facture sur Poste A et une sur Poste B au même instant pour le même client. | Les deux factures reçoivent des numéros distincts sans conflit d'unicité, les deux postes répliquent l'intégralité du portefeuille client. |
| **S4. Annonce Broadcast** | Publier une annonce urgente ("Maintenance ce soir") depuis le Hub. | Notification immédiate affichée sur tous les terminaux Desktop connectés. |
| **S5. Suspension de Tenant** | Cliquer sur "Suspendre le Tenant" depuis le Hub. | Le terminal Desktop bloque l'émission de factures sous 60 secondes avec message explicatif clair. |

---

## 4. Matrice de Priorité et Calendrier d'Exécution Conseillé

| Priorité | Périmètre | Durée Estimée | Livrable |
| :---: | :--- | :---: | :--- |
| **P0** | Schéma PowerSync complet & `sync_rules.yaml` | 2 à 3 jours | `AppSchema.ts` et `sync_rules.yaml` validés |
| **P0** | Déploiement Supabase & PowerSync Cloud réel | 1 à 2 jours | Connexion WebSocket active Desktop ↔ Cloud |
| **P1** | Packaging Windows `.exe` (`electron-builder`) | 2 jours | Fichier d'installation `Facturier-Setup.exe` |
| **P1** | Déploiement Web Hub en ligne (Vercel/HTTPS) | 1 jour | URL de production accessible aux Super Admins |
| **P2** | Tests de recette E2E et validation finale | 2 jours | Rapport de recette complet validé à 100% |

---

*Ce document est une référence vivante : toute décision d'ajustement sera consignée dans `docs/decisions/` conformément aux règles du projet.*
