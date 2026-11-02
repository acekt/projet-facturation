# RAPPORT D'AUDIT: LOT 2 - DATABASE, REPOSITORIES, SERVICES & FISCALITÉ

Ce rapport documente l'audit exhaustif en lecture seule de la couche d'accès aux données (SQLite), des repositories, des services métier et de la logique mathématique/fiscale de l'application "Facturier".

## 1. Anatomie fichier par fichier (Rôle et Impact)

### 1.1 Moteur SQLite & Migrations
*   `apps/desktop/lib/db.ts` :
    *   **Rôle** : Cœur de la connexion SQLite (`better-sqlite3`). Gère la résolution de chemin selon l'environnement (Test, Electron, Dev) et configure le cache de requêtes.
    *   **Impact** : Critique. Active le WAL (`journal_mode = WAL`) et intercepte la fermeture du processus pour forcer un checkpoint truncate propre, ce qui prévient la corruption.
*   `apps/desktop/lib/backup.ts` :
    *   **Rôle** : Réalise des sauvegardes SQLite natives `db.backup()` et vérifie l'intégrité via `PRAGMA integrity_check`.
    *   **Impact** : Très positif pour la fiabilité des données.
*   `apps/desktop/lib/db/migrateLegacy.ts` :
    *   **Rôle** : Script idempotent assurant la transition entre l'ancienne base locale (IDs entiers) et la nouvelle (tenant_id et UUIDs).
    *   **Impact** : Indispensable pour la rétrocompatibilité (V1 -> V2). L'utilisation de `transaction()` ici assure l'atomicité.
*   `apps/desktop/lib/db/migrations/index.ts` :
    *   **Rôle** : Exécuteur ("Runner") des migrations versionnées.
    *   **Impact** : Très bien sécurisé (désactivation temporaire des `foreign_keys` car interdit dans une transaction).
*   `apps/desktop/lib/db/migrations/types.ts` : Interface basique de définition d'une migration `Migration`.
*   `apps/desktop/lib/db/migrations/0001_initial_schema.ts` : Définit le schéma structurel initial.
*   `apps/desktop/lib/db/migrations/0002_schema_hardening.ts` : Mute les colonnes de monnaie en `INTEGER` pour prévenir l'accumulation de flottants et insère des contraintes `CHECK(total >= 0)`.

### 1.2 Repositories
*   `apps/desktop/lib/repositories/InvoiceRepository.ts` : DAL pour les factures et les `invoice_items`.
*   `apps/desktop/lib/repositories/QuoteRepository.ts` : DAL pour les devis et `quote_items`.
*   `apps/desktop/lib/repositories/MetricsRepository.ts` : Agrége de multiples statistiques et KPIs (C.A., paiements, état des devis/factures).
*   `apps/desktop/lib/repositories/SettingsRepository.ts` : Configuration de l'entreprise (nom, Taux TVA...).
*   `apps/desktop/lib/repositories/UserRepository.ts` : CRUD sur les utilisateurs système.

### 1.3 Services Métier
*   `apps/desktop/lib/services/InvoiceService.ts` : Règle métier complexe de la facturation (création, numérotation, statut, relations avec les items).
*   `apps/desktop/lib/services/QuoteService.ts` : Création et conversion de Devis vers Facture.
*   `apps/desktop/lib/services/CreditNoteService.ts` : Génération d'avoirs partiels ou totaux sur facture, calcul prorata.
*   `apps/desktop/lib/services/ExportService.ts` : Génère l'extraction Excel de toutes les tables existantes de la base.
*   `apps/desktop/lib/services/EnrollmentService.ts` : Connexion cloud et provisioning local.
*   `apps/desktop/lib/services/SetupService.ts` : Initialise l'app localement.

### 1.4 Moteur Fiscal & Logique Mathématique
*   `apps/desktop/lib/fiscal/index.ts` : Redirige vers `@workspace/database/fiscal`.
*   `packages/database/src/fiscal/index.ts` : Moteur de calcul pur, traite le calcul en cascade (HT -> CSS -> Base -> TPS -> TVA -> Total). Exécute l'arrondi mathématique de façon isolée (XAF).
*   `apps/desktop/lib/math-logic.ts` : Fichier de "proxy" ré-exportant les types de base depuis le package `@workspace/database/fiscal`.
*   `apps/desktop/lib/api/invoice-logic.ts` : Interroge les `settings` et exécute `updateInvoiceStatus`.
*   `apps/desktop/lib/api/quote-logic.ts` : Calcule les expirations temporelles et gère le diagramme d'état des devis.
*   `apps/desktop/lib/api/numbering.ts` : Gère le séquenceur et formatte le code facture en norme (ex: FAC-001/GAB/2026).

## 2. Audit des performances SQLite (Blocages & N+1)

**Problème 1 : Aggrégations lourdes sans limite et requêtes N+1**
*   **Fichier:Ligne** : `apps/desktop/lib/repositories/MetricsRepository.ts` (Ligne 216 - getRecentActivity).
    ```typescript
    query += ' ORDER BY createdAt DESC LIMIT 5';
    ```
    (Note : Ce query précis a bien un limit. Toutefois, le Repository ne pagine pas la récupération initiale complète.)
*   **Risque de verrouillage (SQLITE_BUSY)** :
    *   **Fichier:Ligne** : `apps/desktop/lib/services/ExportService.ts` (Ligne 46).
        ```typescript
        const rawInvoices = db.prepare(`SELECT * FROM invoices WHERE deletedAt IS NULL${tf.sql} ORDER BY date DESC`).all(...tf.params);
        for (const invoice of rawInvoices) {
           invoice.items = db.prepare(`SELECT * FROM invoice_items WHERE invoiceId = ?`).all(invoice.id);
        }
        ```
        Cette boucle *for* induit le syndrome **N+1 Queries**. Si la BDD contient 10 000 factures, 10 001 requêtes sont lancées, ce qui risque de surcharger SQLite et de renvoyer un HTTP 500 sur le main thread en production.
*   **Absence d'Index pertinent en base** :
    Bien que la migration `0002` ajoute de multiples index sur `tenant_id` et `deletedAt`, il manque des index partiels natifs sur des filtres spécifiques comme le statut des paiements ou les plages de date intensément requêtées par le Dashboard.

## 3. Audit de l'intégrité transactionnelle

**Problème 2 : Opérations multi-écritures risquées sans Transaction**
L'intégrité comptable exige que la mise à jour d'un statut (ex: Conversion de devis, Paiement, Avoir) se fasse obligatoirement de concert avec la création des entités dépendantes.

*   **Fichier:Ligne** : `apps/desktop/lib/services/QuoteService.ts` (Ligne 201 - `convertToInvoice`)
    ```typescript
    // Création de la facture
    const invoiceId = InvoiceRepository.create(newInvoice, quoteItems);
    // Mise à jour du devis : AUCUNE db.transaction() encapsulant ces deux blocs distincts n'est visible
    db.prepare("UPDATE quotes SET status = 'CONVERTI' WHERE id = ?").run(quoteId);
    ```
    Si SQLite ou le serveur crash entre l'insertion de la facture et l'update du devis, la facture est créée mais le devis reste "EN_ATTENTE". Il pourra être converti en une deuxième facture, ruinant la numérotation séquentielle et la base fiscale.

## 4. Chasse aux doublons de calculs financiers et fiscaux

**Problème 3 : Dispersion et duplications partielles**
Les calculs sont bien isolés et documentés dans `packages/database/src/fiscal/index.ts`, mais on observe un "Wrapper de transition" (hérité d'une version précédente) appelé `calculateFiscalCascade`.
*   **Fichier:Ligne** : `packages/database/src/fiscal/index.ts` (Ligne 138 - `calculateFiscalCascade`)
    ```typescript
    export function calculateFiscalCascade(...) {
        // Fonction dépréciée qui masque le mécanisme complet en appelant l'autre.
    }
    ```
    De plus, il existe `apps/desktop/lib/math-logic.ts`, `apps/desktop/lib/fiscal/index.ts`, et `apps/desktop/lib/api/invoice-logic.ts` qui ré-exportent en boucle `computeTotals`. Le backend l'utilise comme source de vérité. L'implémentation est correcte mathématiquement (Cascade `NetHT -> + CSS = TaxBase -> + TPS -> + TVA = Total`, avec des entiers et `Math.round()`), mais l'arborescence des fichiers porte à confusion.

## 5. Feuille de route en 3 plans

### PLAN CORRECTIF (Transactions & Numérotation)
*   **Sécuriser la conversion avec `db.transaction()`** :
    Envelopper `convertToInvoice` (dans `QuoteService.ts`) dans une transaction native.
    *Extrait cible (QuoteService.ts:201)* :
    ```typescript
    const conversionTx = db.transaction(() => {
       const invoiceId = InvoiceRepository.create(newInvoice, quoteItems);
       db.prepare("UPDATE quotes SET status = 'CONVERTI' WHERE id = ?").run(quoteId);
       return invoiceId;
    });
    return conversionTx();
    ```

### PLAN CURATIF (Anti N+1 Queries)
*   **Corriger `ExportService.ts` avec des sous-requêtes ou jointures (`json_group_array`)** :
    Éliminer le syndrome N+1 lors des exports Excel.
    *Extrait cible (ExportService.ts)* :
    ```sql
    -- Remplacer les 10 000 requêtes par une seule requête avec aggrégation JSON
    SELECT i.*,
      (SELECT json_group_array(json_object('id', it.id, 'description', it.description, 'total', it.total))
       FROM invoice_items it WHERE it.invoiceId = i.id) as items_json
    FROM invoices i WHERE i.deletedAt IS NULL;
    ```
*   **Nettoyer l'architecture Fiscale** :
    Supprimer complètement `calculateFiscalCascade` et retirer les fichiers miroirs superflus (`apps/desktop/lib/fiscal/index.ts`) pour obliger tous les composants à n'importer que depuis `@workspace/database/fiscal`.

### PLAN PRÉVENTIF (Scalabilité SQLite)
*   **Pagination stricte (LIMIT/OFFSET)** :
    Intégrer obligatoirement une clause de pagination dans les Repositories (`findAll`, `search`) via des DTO de requête, car un backend sans limites bloquera le Renderer Node sur les gros volumes.
*   **Nouveaux Index (Migrations V4)** :
    Générer une migration `0004_performance_indexes.ts` pour créer :
    `CREATE INDEX idx_invoices_date_status ON invoices(date DESC, status);` pour optimiser immédiatement les requêtes lourdes du Dashboard et de `MetricsRepository`.
