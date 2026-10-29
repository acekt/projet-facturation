# Runbook Opérationnel — Facturier (Hub & Spoke)

> **Guide d'Exploitation, Sauvegarde, Restauration et Gestion d'Incidents**  
> *Dernière mise à jour : 28 octobre 2026*

---

## 1. Sauvegarde et Restauration des Données

### 1.1. Sauvegarde Locale SQLite (Desktop)
L'application Desktop réalise automatiquement une sauvegarde quotidienne à l'initialisation (via `apps/desktop/main/backup.js`) dans le répertoire `userData/backups/`.

#### Déclenchement manuel d'une sauvegarde SQLite :
```powershell
# Depuis la racine du projet ou sur la machine cliente
$BackupDir = "$env:APPDATA\Facturier\backups"
$DbSource = "$env:APPDATA\Facturier\database.sqlite"
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"

New-Item -ItemType Directory -Force -Path $BackupDir
Copy-Item -Path $DbSource -Destination "$BackupDir\database_manual_$Timestamp.sqlite"
Write-Host "[BACKUP] Sauvegarde effectuée : $BackupDir\database_manual_$Timestamp.sqlite"
```

#### Vérification d'intégrité de la sauvegarde :
```powershell
sqlite3 "$BackupDir\database_manual_$Timestamp.sqlite" "PRAGMA integrity_check;"
# Résultat attendu : ok
```

#### Restauration d'une sauvegarde SQLite :
1. Fermer complètement l'application Facturier (`taskkill /F /IM Facturier.exe`).
2. Remplacer la base corrompue par la copie de sauvegarde :
```powershell
Copy-Item -Path "$BackupDir\database_backup_YYYYMMDD.sqlite" -Destination "$env:APPDATA\Facturier\database.sqlite" -Force
```
3. Relancer l'application Facturier.

---

### 1.2. Sauvegarde et Export Cloud (Supabase)
```bash
# Sauvegarde complète de la base de données distante
npx supabase db dump -f supabase_backup_$(date +%Y%m%d).sql

# Export spécifique des tables métier pour un tenant donné
npx supabase db dump --data-only -f tenant_data_dump.sql
```

---

## 2. Procédures en Cas d'Incident de Synchronisation

### 2.1. Symptôme : Le statut affiche « Hors-ligne » alors qu'Internet fonctionne
1. **Contrôle de connectivité Supabase** :
   - Tester l'endpoint REST Supabase : `curl -I https://<SUPABASE_PROJECT_ID>.supabase.co/rest/v1/`
   - Vérifier la validité du certificat SSL et l'absence de blocage par un proxy d'entreprise.
2. **Vérification de l'expiration du token JWT** :
   - Dans l'application Desktop, ouvrir la console DevTools (`Ctrl+Shift+I` en mode dev) ou inspecter `userData/main.log`.
   - Si l'erreur `PGRST301 (JWT expired)` apparaît : Déconnecter et reconnecter l'utilisateur pour forcer le renouvellement de la session cloud.

### 2.2. Symptôme : Conflit de modifications ou blocage de la file d'attente
1. Vérifier les mutations en échec dans la base locale :
```sql
SELECT count(*) FROM local_mutations WHERE status = 'failed';
```
2. Pour réinitialiser le pointeur de synchronisation descendante sans perdre les données locales :
```sql
UPDATE tenant_sync_state SET last_pulled_at = datetime('now', '-7 days') WHERE tenant_id = 'MON_TENANT_ID';
```
3. Déclencher une resynchronisation forcée depuis l'interface (`Paramètres > Synchronisation > Synchroniser maintenant`).

---

## 3. Rotation des Secrets et Identifiants

### 3.1. Rotation du Secret de Session Electron / Next.js
Le secret cryptographique utilisé pour sceller les sessions locales réside dans `userData/session-secret.key` (géré par `apps/desktop/main/secrets.js`).

#### Procédure de rotation forcée :
1. Fermer l'application Facturier.
2. Supprimer le fichier de clé :
```powershell
Remove-Item "$env:APPDATA\Facturier\session-secret.key" -Force
```
3. Au redémarrage, `apps/desktop/main/secrets.js` génère automatiquement un nouveau secret aléatoire de 256 bits (`crypto.randomBytes(32)`).
4. *Conséquence* : Tous les utilisateurs locaux devront se ré-authentifier.

### 3.2. Rotation de la Clé API Supabase (Service Role ou Anon Key)
1. Générer la nouvelle clé dans le tableau de bord Supabase Cloud (`Project Settings > API`).
2. Mettre à jour les variables d'environnement dans le fichier `.env.local` du Desktop ou dans les paramètres du Hub :
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (Hub uniquement, strictement confidentielle).
3. Relancer la compilation des applications : `npm run build`.

---

## 4. Diagnostics et Dépannage Post-Installation

### 4.1. Emplacements des Fichiers et Journaux

| Composant | Emplacement Windows |
| :--- | :--- |
| Base SQLite locale | `%APPDATA%\Facturier\database.sqlite` |
| Sauvegardes SQLite | `%APPDATA%\Facturier\backups\` |
| Cache des logos | `%APPDATA%\Facturier\logos\` |
| Journal du main process | `%APPDATA%\Facturier\main.log` |
| Secret de session | `%APPDATA%\Facturier\session-secret.key` |

### 4.2. Processus Zombie sous Windows
Si l'application refuse de démarrer en indiquant que le port Next.js est occupé :
```powershell
# Arrêt immédiat de tous les processus orphelins Facturier et Node standalone
taskkill /F /IM Facturier.exe /T
taskkill /F /IM node.exe /FI "WINDOWTITLE eq Facturier*"
```

---

## 5. Commandes de Validation et Contrôles Qualité

Avant tout déploiement ou mise en production, exécuter systématiquement :

```powershell
# 1. Contrôle des types TypeScript sur l'ensemble du monorepo
npm run typecheck

# 2. Validation des fiches de décisions architecturales (ADR)
npm run quality:decisions

# 3. Exécution de la suite de tests unitaires et d'intégration
npm run test --workspace=facturier-desktop

# 4. Vérification du build de production Electron
npm run build --workspace=facturier-desktop
```
