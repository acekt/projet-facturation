# Dossier de conception — Processus 2TUP, Agile et modélisation UML

> Matière pour la **Deuxième partie** du rapport (Chapitres III et IV).
> Tous les diagrammes sont en **Mermaid** : ils s'affichent dans l'aperçu Markdown de VS Code/GitHub. Pour Word, exportez-les en PNG (https://mermaid.live → *Actions → PNG*) puis légendez : « Figure III.x : … ».
> Les faits techniques proviennent du code ; les éléments marqués ✏️ sont des **hypothèses à confirmer** avec vos souvenirs/dates réels.

---

## 1. Pourquoi 2TUP (Two Track Unified Process) ?

### 1.1 Justification scientifique du choix
2TUP est un processus **itératif et incrémental** issu d'UP, centré sur l'architecture, piloté par les risques et adapté aux projets où **deux dimensions évoluent indépendamment** :

| Dimension | Question | Dans notre projet |
| :--- | :--- | :--- |
| **Fonctionnelle** (branche gauche) | *Que doit faire le système ?* | Facturation gabonaise : devis, factures, TVA/TPS/CSS, avoirs, paiements |
| **Technique** (branche droite) | *Avec quelles contraintes et quelle architecture ?* | Hors-ligne, multi-entreprises, synchronisation, Windows, sécurité, licences |

Un projet de facturation classique n'aurait qu'une branche forte. Ici, **les contraintes techniques (offline-first, multi-tenant, sync) sont aussi structurantes que le besoin métier** : 2TUP permet de les étudier *séparément* puis de les *fusionner* à la conception. C'est exactement la séparation du rapport :

- **Chapitre III, Section 1** → *branche droite* : étude comparative des technologies et choix de l'architecture ;
- **Chapitre III, Section 2** → *branche centrale* : modélisation UML et base de données ;
- **Chapitre IV** → *branche centrale (suite)* : codage, tests, recette, déploiement.

### 1.2 Le cycle en Y du projet

```mermaid
flowchart TB
  subgraph G["Branche GAUCHE — Besoins fonctionnels"]
    G1["Capture des besoins fonctionnels<br/>(entretiens, audit Word/Excel)"]
    G2["Analyse<br/>(cas d'utilisation, règles fiscales, classes métier)"]
    G1 --> G2
  end
  subgraph D["Branche DROITE — Besoins techniques"]
    D1["Capture des besoins techniques<br/>(offline, multi-tenant, sécurité, Windows)"]
    D2["Conception générique<br/>(Hub & Spoke, Electron + Next.js + SQLite)"]
    D1 --> D2
  end
  subgraph C["Branche CENTRALE — Réalisation"]
    C1["Conception préliminaire<br/>(modèle de données, séquences)"]
    C2["Conception détaillée<br/>(services, repositories, schéma sync)"]
    C3["Codage et tests<br/>(TypeScript strict, Vitest)"]
    C4["Recette et déploiement<br/>(NSIS, auto-update, Supabase)"]
    C1 --> C2 --> C3 --> C4
  end
  START(("Étude<br/>préalable")) --> G1
  START --> D1
  G2 --> C1
  D2 --> C1
  C4 --> END(("Livraison"))
```
*Figure III.1 : Cycle de développement en Y (2TUP) appliqué au projet L'Étoile*

### 1.3 Correspondance 2TUP ↔ livrables réels

| Étape 2TUP | Livrable du projet | Où le trouver |
| :--- | :--- | :--- |
| Étude préalable | Audit de l'existant (Word/Excel), SWOT, cahier des charges | Partie I, Chap. II |
| Capture besoins fonctionnels | SF1–SF6, acteurs, cas d'utilisation | §3 ci-dessous |
| Analyse | Diagramme de classes métier, règles fiscales | §5 |
| Capture besoins techniques | ST1–ST6, exigences non fonctionnelles | §4 |
| Conception générique | Architecture Hub & Spoke, ADR-0001 à 0027 | `docs/decisions/` |
| Conception préliminaire | Modèle relationnel SQLite/PostgreSQL | §6 |
| Conception détaillée | Séquences, états, services transactionnels | §7–§8 |
| Codage | Monorepo Turborepo, ≈ 36 500 lignes | dépôt |
| Tests | 261 + 58 tests automatisés, 100 % de réussite | Audit §4 |
| Recette | Scénarios S1–S5, ADR-0028 à 0033 | §11 |
| Déploiement | Installeur NSIS, GitHub Releases, Supabase | Audit §9 |

---

## 2. Méthode Agile (Scrum adapté) et gestion de projet

### 2.1 Positionnement
2TUP définit **le cycle de vie** (quoi concevoir, dans quel ordre) ; **Scrum** organise **le travail quotidien** (comment avancer par incréments). L'équipe étant composée d'un étudiant développeur et d'un encadreur *Product Owner*, Scrum a été adapté :

| Rôle Scrum | Titulaire | Responsabilité |
| :--- | :--- | :--- |
| Product Owner | Encadreur professionnel (Global Maintenance) | Priorise le backlog, valide les règles métier (codes de documents, régimes fiscaux, mentions légales) |
| Scrum Master / Équipe de développement | Stagiaire (+ assistants IA de code) | Planifie, développe, teste, documente |
| Parties prenantes | Direction, service administratif et commercial | Tests d'acceptation, retours d'usage |

### 2.2 Artefacts et cérémonies réellement observés
| Artefact / cérémonie | Preuve dans le dépôt |
| :--- | :--- |
| Backlog produit et plan directeur | `docs/AUDIT_AND_MASTER_PLAN.md`, `docs/PLAN_CONTINUATION_ET_FINALISATION.md` |
| Definition of Done | `.antigravity` §9 : *« toute fonctionnalité doit être accompagnée de son test Vitest »* ; `npm run quality:decisions` |
| Revue de code / Pull requests | `.github/pull_request_template.md`, PR #1 et #2 fusionnées (15/05/2026) |
| Incréments livrés | 492 commits, convention `feat:`, `fix:`, `chore:` (Conventional Commits) |
| Rétrospective | Fiches ADR (contexte → décision → alternatives → risques → vérification) |
| Intégration/déploiement | `release.yml` (build Windows sur tag `v*`) |

### 2.3 Planning (reconstitué depuis l'historique Git ✏️)
```mermaid
gantt
  title Planning réel du projet (d'après l'historique Git)
  dateFormat YYYY-MM-DD
  axisFormat %d/%m
  section Cadrage
  Audit de l'existant et cahier des charges   :done, a1, 2026-05-15, 3d
  section Noyau métier
  SQLite, devis, conversion en facture, fiscalité :done, b1, 2026-05-15, 4d
  Paiements, tableau de bord, impression      :done, b2, 2026-05-17, 3d
  section Consolidation
  Services, avoirs, utilisateurs, RBAC, exports :done, c1, 2026-05-19, 140d
  section Cloud et Hub
  Supabase, RLS, synchronisation              :done, d1, 2026-10-13, 8d
  Web Hub, MFA, télémétrie, licences          :done, d2, 2026-10-20, 5d
  section Production
  Enrôlement, migration V1-V2, packaging, auto-update :done, e1, 2026-10-22, 4d
  Durcissement auth et UX                     :done, e2, 2026-10-24, 3d
  Modules 1-3 (correctif, curatif, préventif) :done, e3, 2026-10-27, 1d
```
*Figure III.2 : Diagramme de Gantt du projet*

> ✏️ La période de juin à septembre est volontairement regroupée : le dépôt montre 492 commits mais je n'ai pas détaillé les itérations intermédiaires. Complétez avec vos vraies dates de sprint (idéalement : 2 semaines par sprint).

### 2.4 Gestion des risques
| Risque | Probabilité | Impact | Parade mise en œuvre |
| :--- | :---: | :---: | :--- |
| Perte de données locales | Moyenne | Critique | WAL, transactions, sauvegarde quotidienne 7 j, synchro cloud |
| Erreur de calcul fiscal | Moyenne | Critique | Moteur pur isolé, 18 Ko de tests de cas limites, arrondis XAF |
| Absence de connexion Internet | Forte | Élevé | Architecture offline-first |
| Collision de numérotation multi-postes | Moyenne | Élevé | Préfixe de poste + désambiguïsation à la synchro (limite : audit §5.3) |
| Incompatibilité ABI `better-sqlite3`/Electron | Forte | Élevé | Scripts de reconstruction, `asarUnpack` |
| Fuite de données entre entreprises | Faible | Critique | `tenant_id` partout + RLS Postgres |
| Dérive de périmètre | Moyenne | Moyen | ADR + backlog priorisé par l'encadreur |
| Dépendance à des bibliothèques en évolution rapide (Next 16, Electron 42) | Moyenne | Moyen | Consultation de la documentation versionnée (Context7) avant implémentation |

### 2.5 Indicateurs de suivi
Commits : 492 · Tests : 319 (261 + 58) · ADR : 33 · Erreurs TypeScript : 0 · Taux de réussite des tests : 100 %.

---

## 3. Capture des besoins fonctionnels (branche gauche)

### 3.1 Acteurs
| Acteur | Type | Description |
| :--- | :---: | :--- |
| Opérateur | Principal | Agent administratif/commercial : crée devis, factures, encaisse |
| Administrateur | Principal | Dirigeant/responsable : paramètre la société, gère utilisateurs et catalogue, supervise |
| Super Administrateur | Principal | Éditeur de la solution : gère entreprises, licences, annonces (Web Hub) |
| Supabase (Cloud) | Secondaire | Authentification, stockage, synchronisation |
| Client final | Externe | Destinataire des documents (n'interagit pas avec l'application) |

### 3.2 Exigences fonctionnelles (reprises du cahier des charges)
| Code | Exigence | Priorité (MoSCoW) |
| :--- | :--- | :---: |
| SF1 | Gestion des clients (NIF, RCCM, téléphone obligatoire) | Must |
| SF2 | Catalogue produits / prestations / formations en XAF | Must |
| SF3 | Devis → facture sans ressaisie, numérotation automatique | Must |
| SF4 | Calcul fiscal : remise, CSS, TPS, TVA, arrondis XAF | Must |
| SF5 | Paiements partiels, solde restant, statuts automatiques | Must |
| SF6 | PDF/impression A4 à l'en-tête de l'entreprise, export Excel, tableau de bord | Must |
| SF7 | Avoirs (notes de crédit) | Should |
| SF8 | Utilisateurs, rôles, changement de mot de passe forcé | Must |
| SF9 | Journal d'audit des actions sensibles | Should |
| SF10 | Multi-entreprises (multi-tenant) et enrôlement d'un poste | Should |
| SF11 | Synchronisation cloud et licence (lecture seule si expirée) | Should |
| SF12 | Supervision centralisée (Hub) : flotte, finances, annonces | Could |

### 3.3 Exigences non fonctionnelles et techniques (branche droite)
| Code | Exigence | Mesure / preuve |
| :--- | :--- | :--- |
| ST1 | Fonctionnement 100 % hors-ligne | SQLite local, aucune dépendance réseau pour facturer |
| ST2 | Intégrité ACID, clés primaires UUID, soft delete | `db.ts`, transactions |
| ST3 | Sécurité : hash des mots de passe, verrouillage, sandbox Electron | Audit §6 |
| ST4 | Performance : calcul d'une facture de 10 000 lignes < 50 ms | Mesuré : 0,37–0,85 ms |
| ST5 | Isolation multi-entreprises | `tenant_id` + RLS |
| ST6 | Distribution : installeur Windows, mise à jour automatique | NSIS + `electron-updater` |
| ST7 | Maintenabilité : TypeScript strict, tests, ADR | 0 erreur `tsc`, 319 tests |
| ST8 | Ergonomie : mode sombre, accessibilité clavier, toasts | `packages/ui` |

### 3.4 Diagramme de cas d'utilisation

```mermaid
flowchart LR
  OP(["👤 Opérateur"])
  AD(["👤 Administrateur"])
  SA(["👤 Super Admin"])
  CL(["☁️ Supabase"])

  subgraph SYS["Système Facturier (Desktop)"]
    UC1(["S'authentifier"])
    UC2(["Gérer les clients"])
    UC3(["Consulter le catalogue"])
    UC4(["Gérer le catalogue"])
    UC5(["Créer un devis"])
    UC6(["Convertir un devis en facture"])
    UC7(["Créer une facture"])
    UC8(["Enregistrer un paiement"])
    UC9(["Émettre un avoir"])
    UC10(["Imprimer / exporter PDF-Excel"])
    UC11(["Consulter le tableau de bord"])
    UC12(["Gérer les utilisateurs"])
    UC13(["Paramétrer la société et les taxes"])
    UC14(["Consulter le journal d'audit"])
    UC15(["Synchroniser avec le cloud"])
    UC16(["Calculer la fiscalité"])
  end
  subgraph HUB["Web Hub"]
    UH1(["Gérer les entreprises et licences"])
    UH2(["Superviser la flotte de postes"])
    UH3(["Diffuser une annonce"])
    UH4(["Consulter finances et audit Hub"])
  end

  OP --- UC1 & UC2 & UC3 & UC5 & UC6 & UC7 & UC8 & UC9 & UC10 & UC11
  AD --- UC1 & UC4 & UC12 & UC13 & UC14 & UC11 & UC10
  UC5 -.->|include| UC16
  UC7 -.->|include| UC16
  UC6 -.->|extend| UC7
  UC15 --- CL
  OP --- UC15
  SA --- UH1 & UH2 & UH3 & UH4
  UH1 --- CL
```
*Figure III.3 : Diagramme de cas d'utilisation général*

### 3.5 Description textuelle — cas « Convertir un devis en facture »
| Champ | Contenu |
| :--- | :--- |
| Acteur | Opérateur (propriétaire du devis) ou Administrateur |
| Pré-conditions | Authentifié ; licence active ; devis non supprimé, non converti, non expiré |
| Déclencheur | Clic sur « Convertir en facture » |
| Scénario nominal | 1. Le système charge le devis et ses lignes. 2. Vérifie droits, statut et validité. 3. Génère le numéro `FAC-…`. 4. Crée la facture (échéance J+30) et copie les lignes. 5. Passe le devis à `CONVERTI`. 6. Écrit une entrée d'audit. 7. Retourne le numéro. |
| Scénarios alternatifs | A1 devis introuvable (404) · A2 non propriétaire (403) · A3 devis déjà converti · A4 devis expiré · A5 licence en lecture seule |
| Post-conditions | Facture `UNPAID` ; devis verrouillé ; ligne marquée « à synchroniser » |
| Garantie | Opération **atomique** : tout ou rien |

### 3.6 Description textuelle — cas « Enregistrer un paiement »
| Champ | Contenu |
| :--- | :--- |
| Pré-conditions | Facture existante, non supprimée ; l'opérateur est propriétaire (ou admin) |
| Scénario nominal | Saisie montant/mode/date/référence → validation Zod → calcul du reste à payer → insertion du paiement → recalcul du statut (`UNPAID/PARTIALLY_PAID/PAID`) → audit |
| Alternatifs | Montant > reste à payer → refus avec message « excède le reste à charge » ; facture supprimée → refus |
| Post-conditions | Statut de la facture mis à jour dans la même transaction |

---

## 4. Conception générique — choix technologiques (Section 1 du Chapitre III)

### 4.1 Comparatif des architectures de solution
| Critère (poids) | Tableur Word/Excel (existant) | Application Web SaaS pure | **Client lourd Offline-First + Cloud** (retenu) | Logiciel du marché (Sage, EBP) |
| :--- | :---: | :---: | :---: | :---: |
| Fonctionne sans Internet (25) | ✅ | ❌ | ✅ | ✅ |
| Conformité fiscale gabonaise sur mesure (25) | ❌ | ✅ | ✅ | ⚠️ à paramétrer |
| Coût de licence (15) | ✅ gratuit | ⚠️ hébergement | ✅ | ❌ élevé |
| Intégrité et traçabilité (15) | ❌ | ✅ | ✅ | ✅ |
| Multi-agences (10) | ❌ | ✅ | ✅ (sync) | ⚠️ |
| Maîtrise du code (10) | — | ✅ | ✅ | ❌ |
| **Verdict** | Écarté | Écarté (connectivité) | **Retenu** | Écarté (coût/adaptation) |

### 4.2 Comparatif des technologies

| Couche | Options étudiées | **Choix** | Justification |
| :--- | :--- | :---: | :--- |
| Coque desktop | Electron · Tauri · .NET WPF/WinForms | **Electron 42** | Écosystème web réutilisable, impression PDF native, auto-update mature ; Tauri exigerait Rust, WPF fermerait la voie à la réutilisation web (Hub) |
| Framework UI | Next.js · React+Vite · Angular | **Next.js 16 (App Router, standalone)** | Server Actions = couche métier sécurisée côté serveur local ; partage du code avec le Hub |
| Base locale | SQLite · PostgreSQL local · IndexedDB · Excel | **SQLite (`better-sqlite3`)** | Zéro administration, fichier unique, ACID, WAL, synchrone et très rapide |
| Cloud | Supabase · Firebase · API Node maison | **Supabase** | PostgreSQL + RLS native (isolation multi-tenant), Auth + MFA, RPC |
| Synchronisation | PowerSync · CouchDB/PouchDB · Firebase · service maison | **CloudSyncService (maison) + schéma/règles PowerSync** | Contrôle des conflits de numérotation et de la licence ; PowerSync prêt pour le temps réel |
| État UI | Zustand · Redux Toolkit · Context | **Zustand 5** | Minimaliste, sans boilerplate |
| Validation | Zod · Yup · Joi | **Zod 3** | Inférence TypeScript, validation partagée client/serveur |
| Mots de passe | bcryptjs · argon2 · scrypt | **bcryptjs** | Pas de compilation native supplémentaire (déjà source de fragilité avec SQLite) ; argon2 en évolution |
| PDF | `@react-pdf/renderer` · Puppeteer · impression Chromium | **react-pdf + `printToPDF` Electron** | Rendu fidèle A4 sans navigateur externe |
| Tests | Vitest · Jest · Playwright | **Vitest + Testing Library + Playwright** | Rapidité, compatibilité ESM/TypeScript |
| Monorepo | Turborepo · Nx · Lerna | **Turborepo + npm workspaces** | Cache de tâches, peu de configuration |
| Style | Tailwind 4 + Radix/Shadcn · MUI · Bootstrap | **Tailwind 4 + Shadcn** | Design system sur mesure, mode sombre |
| Packaging | electron-builder · electron-forge | **electron-builder (NSIS)** | Auto-update GitHub, installeur Windows |

> ⚠️ **Cohérence avec la Partie I** : le texte déjà rédigé cite « Electron, React, **Vite**, Tailwind CSS ». Le code réel utilise **Next.js 16** (Vite n'apparaît que via Vitest). Corrigez la phrase (voir guide de rédaction).

### 4.3 Architecture technique retenue
```mermaid
flowchart TB
  subgraph PRES["Présentation"]
    R["React 19 + Tailwind 4 + Shadcn<br/>(packages/ui)"]
    Z["Zustand (état)"]
  end
  subgraph LOG["Logique applicative (serveur Next local)"]
    SA2["Server Actions<br/>(contrôle de session + RBAC)"]
    SV["Services transactionnels<br/>(Invoice, Quote, CreditNote)"]
    FI["Moteur fiscal pur<br/>@workspace/database/fiscal"]
    VA["Validation Zod"]
  end
  subgraph DATA["Données"]
    RP["Repositories"]
    SQ[("SQLite WAL")]
  end
  subgraph SYNC["Synchronisation"]
    CS["CloudSyncService<br/>push / pull LWW"]
    TL["Télémétrie + licence"]
  end
  R --> Z --> SA2 --> VA --> SV --> FI
  SV --> RP --> SQ
  SQ --> CS --> CLOUD[("Supabase PostgreSQL + RLS")]
  CS --> TL --> CLOUD
```
*Figure III.4 : Architecture logicielle en couches*

---

## 5. Modélisation statique — Diagramme de classes

```mermaid
classDiagram
  direction LR
  class Tenant {
    +UUID id
    +string name
    +string status  « active, trial, suspended, expired »
    +date licenseExpiresAt
  }
  class User {
    +UUID id
    +string username
    +string email
    +string role  « admin, user »
    +bool isActive
    +bool forcePasswordChange
    +login()
    +changePassword()
  }
  class Client {
    +UUID id
    +string name
    +string phone
    +string nif
    +string rccm
    +string status  « active, inactive »
    +UUID id
    +string name
    +string category
    +int unitPrice
  }
  class Quote {
    +UUID id
    +string number
    +date date
    +date validUntil
    +string status  « EN_ATTENTE, ENVOYE, CONVERTI, REFUSE, EXPIRE »
    +convertToInvoice()
    +duplicate()
  }
  class Invoice {
    +UUID id
    +string number
    +date dueDate
    +string status  « UNPAID, PARTIALLY_PAID, PAID, cancelled »
    +computeRemaining()
    +updateStatus()
  }
  class DocumentLine {
    +UUID id
    +string description
    +decimal quantity
    +int unitPrice
    +int total
  }
  class Payment {
    +UUID id
    +int amount
    +string method
    +date date
    +string reference
  }
  class CreditNote {
    +UUID id
    +string number
    +string reason
    +string status  « open, applied, cancelled »
  }
  class FiscalTotals {
    +int subtotal
    +int discount
    +int cssAmount
    +int taxBase
    +int tpsAmount
    +int tvaAmount
    +int total
  }
  class AuditLog {
    +UUID id
    +string action
    +string entityType
    +datetime createdAt
  }
  class Settings {
    +string companyName
    +string nif
    +string rccm
    +float tvaRate
    +float tpsRate
    +float cssRate
    +string companyCode
  }
  Tenant "1" o-- "*" User
  Tenant "1" o-- "*" Client
  Tenant "1" o-- "*" Service
  Tenant "1" -- "1" Settings
  Client "1" --> "*" Quote
  Client "1" --> "*" Invoice
  Quote "1" --> "0..1" Invoice : converti en
  Quote "1" *-- "1..*" DocumentLine
  Invoice "1" *-- "1..*" DocumentLine
  CreditNote "1" *-- "1..*" DocumentLine
  Invoice "1" *-- "*" Payment
  Invoice "1" --> "*" CreditNote
  Quote ..> FiscalTotals : calcule
  Invoice ..> FiscalTotals : calcule
  User "1" --> "*" AuditLog
```
*Figure III.5 : Diagramme de classes du domaine métier*

> Note de modélisation : en base, `DocumentLine` est matérialisée en trois tables (`quote_items`, `invoice_items`, `credit_note_items`) ; la généralisation est un choix d'analyse, la spécialisation un choix de conception.

---

## 6. Modèle de données relationnel (SQLite local)

```mermaid
erDiagram
  CLIENTS ||--o{ QUOTES : "clientId"
  CLIENTS ||--o{ INVOICES : "clientId"
  CLIENTS ||--o{ CREDIT_NOTES : "clientId"
  QUOTES ||--o{ QUOTE_ITEMS : "quoteId CASCADE"
  QUOTES ||--o| INVOICES : "quoteId"
  INVOICES ||--o{ INVOICE_ITEMS : "invoiceId CASCADE"
  INVOICES ||--o{ PAYMENTS : "invoiceId CASCADE"
  INVOICES ||--o{ CREDIT_NOTES : "invoiceId"
  CREDIT_NOTES ||--o{ CREDIT_NOTE_ITEMS : "creditNoteId CASCADE"
  USERS ||--o{ AUDIT_LOGS : "userId"
  CLIENTS {
    TEXT id PK
    TEXT name
    TEXT phone
    TEXT nif
    TEXT rccm
    TEXT status
    DATETIME deletedAt
    TEXT tenant_id
  }
  QUOTES {
    TEXT id PK
    TEXT number UK
    TEXT clientId FK
    TEXT date
    REAL subtotal
    REAL discount
    REAL taxBase
    REAL tpsAmount
    REAL tvaAmount
    REAL cssAmount
    REAL total
    TEXT status
    TEXT validUntil
    TEXT tenant_id
  }
  INVOICES {
    TEXT id PK
    TEXT number UK
    TEXT quoteId FK
    TEXT clientId FK
    TEXT dueDate
    REAL total
    TEXT status
    TEXT tenant_id
  }
  PAYMENTS {
    TEXT id PK
    TEXT invoiceId FK
    REAL amount
    TEXT paymentMethod
    TEXT date
    TEXT reference
    TEXT tenant_id
  }
  CREDIT_NOTES {
    TEXT id PK
    TEXT number UK
    TEXT invoiceId FK
    TEXT reason
    REAL total
    TEXT status
  }
  USERS {
    TEXT id PK
    TEXT username UK
    TEXT email UK
    TEXT password
    TEXT role
    INTEGER is_active
    INTEGER force_password_change
    TEXT tenant_id
  }
  SERVICES {
    TEXT id PK
    TEXT name
    TEXT category
    REAL unitPrice
  }
  SEQUENCES {
    TEXT name PK
    INTEGER current_value
    INTEGER last_year
  }
  SYNC_META {
    TEXT key PK
    TEXT value
  }
  SYNC_TOMBSTONES {
    TEXT table_name PK
    TEXT record_id PK
    TEXT deleted_at
  }
```
*Figure III.6 : Modèle entité-association de la base locale*
(Extrait : lignes `quote_items`, `invoice_items`, `credit_note_items`, `audit_logs`, `settings` et `pending_cloud_members` omises pour la lisibilité ; les colonnes `updated_at` et `synced_at` sont ajoutées par `ensureSyncSchema` à toutes les tables synchronisées.)

### 6.1 Règles de conception de la base
| Règle | Mise en œuvre |
| :--- | :--- |
| Clés primaires **UUIDv4** générées côté client | `crypto.randomUUID()` : pas de conflit entre postes hors-ligne |
| **Soft delete** | Colonne `deletedAt` ; filtre `deletedAt IS NULL` systématique |
| Isolation multi-entreprises | Colonne `tenant_id` + index composites `(tenant_id, deletedAt)` |
| Montants **entiers** (XAF) | Validation `z.number().int()` + `Math.round` |
| Intégrité référentielle | `PRAGMA foreign_keys = ON`, `ON DELETE CASCADE` sur les lignes |
| Suivi de synchronisation | Triggers qui renseignent `updated_at` ; table `sync_tombstones` pour les suppressions physiques |
| Migration non destructive | `ALTER TABLE ... ADD COLUMN` idempotents + `migrateLegacy` avec sauvegarde |
| Performance | Index partiels `WHERE deletedAt IS NULL` ; statements préparés mis en cache |

### 6.2 Moteur fiscal — formalisation
Soit `S = Σ(qᵢ × pᵢ)` (arrondi par ligne), `R` la remise, `H = max(0, S − R)` :

| Étape | Formule | Arrondi |
| :--- | :--- | :--- |
| CSS | `H × cssRate/100` | entier |
| Base taxable | `B = H + CSS` | — |
| TPS | `B × tpsRate/100` | entier |
| TVA | `B × tvaRate/100` | entier |
| **Total TTC** | `B + TPS + TVA` | — |

**Exemple chiffré** (S = 1 000 000 XAF, R = 0 ; taux 1 % / 9,5 % / 18 %) :
CSS = 10 000 → Base = 1 010 000 → TPS = 95 950 → TVA = 181 800 → **TTC = 1 287 750 XAF**.

> ✏️ À valider avec l'encadreur (cf. audit §5.1) : application des deux taxes à toutes les lignes, et base taxable incluant la CSS.

---

## 7. Modélisation dynamique

### 7.1 Diagramme de séquence — Devis converti, puis paiement
```mermaid
sequenceDiagram
  autonumber
  actor Op as Opérateur
  participant UI as Interface React
  participant SA as Server Action
  participant SV as QuoteService
  participant DB as SQLite
  Op->>UI: Clic « Convertir en facture »
  UI->>SA: convertQuote(quoteId)
  SA->>SA: getSession() + garde de licence
  SA->>SV: convertToInvoice(quoteId, userId, role, tenantId)
  SV->>DB: SELECT devis (filtre tenant_id)
  DB-->>SV: devis + lignes
  SV->>SV: vérifier propriétaire, statut, validité
  rect rgb(235,245,255)
    Note over SV,DB: Transaction atomique
    SV->>DB: getNextNumber('invoice')
    SV->>DB: INSERT invoices + invoice_items
    SV->>DB: UPDATE quotes SET status = CONVERTI
    SV->>DB: INSERT audit_logs
  end
  SV-->>SA: {invoiceId, invoiceNumber}
  SA-->>UI: succès
  UI-->>Op: Toast « Facture FAC-001/GM/2026 créée »
  Op->>UI: Enregistrer un paiement
  UI->>SA: createPayment(données)
  SA->>SA: Zod + RBAC + calcul du reste à payer
  alt montant > reste à payer
    SA-->>UI: erreur « excède le reste à charge »
  else montant valide
    SA->>DB: INSERT payments
    SA->>DB: recalcul du statut (UNPAID / PARTIALLY_PAID / PAID)
    SA-->>UI: nouveau statut
  end
```
*Figure III.7 : Séquence « Devis → Facture → Paiement »*

### 7.2 Diagramme de séquence — Synchronisation cloud
```mermaid
sequenceDiagram
  autonumber
  participant R as CloudSyncRunner
  participant S as CloudSyncService
  participant L as SQLite local
  participant A as Supabase Auth
  participant P as Supabase PostgreSQL
  R->>S: syncNow(accessToken)
  S->>A: getUser(token)
  A-->>S: utilisateur
  S->>P: lire profil et tenant
  alt tenant absent
    S->>P: RPC provision_tenant()
  end
  S->>P: lire statut du tenant
  alt suspendu ou expiré
    S-->>R: erreur de licence (mode lecture seule)
  end
  S->>L: réconcilier tenant_id local ↔ cloud
  loop pour chaque table (parents avant enfants)
    S->>L: lignes où updated_at > synced_at
    S->>P: upsert par lots de 200
    opt erreur 23505 (numéro dupliqué)
      S->>P: nouvel essai avec numéro suffixé
    end
    S->>P: pull des lignes plus récentes (pages de 1000)
    S->>L: appliquer (Last-Write-Wins)
  end
  S->>L: appliquer les tombstones (suppressions)
  S->>P: envoyer la télémétrie (non bloquant)
  S-->>R: rapport {pushed, pulled, deleted, skipped, errors}
```
*Figure III.8 : Séquence de synchronisation Desktop ↔ Cloud*

### 7.3 Diagramme de séquence — Authentification hors-ligne
```mermaid
sequenceDiagram
  autonumber
  actor U as Utilisateur
  participant L as login-client
  participant A as loginUser (Server Action)
  participant DB as SQLite
  U->>L: identifiant + mot de passe
  L->>A: loginUser(data)
  A->>A: checkRateLimit(identifiant)
  alt compte verrouillé
    A-->>L: refus + minutes restantes
  else autorisé
    A->>DB: SELECT utilisateur actif
    A->>A: bcrypt.compare (hash factice si inconnu)
    alt échec
      A->>A: recordFailedLogin (5 → verrouillage 15 min)
      A->>DB: audit LOGIN_FAILED
      A-->>L: identifiants invalides
    else succès
      A->>DB: audit LOGIN, last_login_at
      A->>A: cookie HttpOnly signé (7 jours)
      A-->>L: session {userId, role, tenantId}
    end
  end
```
*Figure III.9 : Séquence d'authentification*

### 7.4 Diagrammes d'états
```mermaid
stateDiagram-v2
  [*] --> EN_ATTENTE : création
  EN_ATTENTE --> ENVOYE : envoi au client
  EN_ATTENTE --> CONVERTI : conversion
  ENVOYE --> CONVERTI : acceptation
  ENVOYE --> REFUSE : refus
  EN_ATTENTE --> EXPIRE : validUntil dépassée
  ENVOYE --> EXPIRE : validUntil dépassée
  CONVERTI --> [*]
  REFUSE --> [*]
  EXPIRE --> [*]
```
*Figure III.10 : Cycle de vie d'un devis*

```mermaid
stateDiagram-v2
  [*] --> UNPAID : création
  UNPAID --> PARTIALLY_PAID : 0 < paiements < total
  PARTIALLY_PAID --> PAID : paiements ≥ total
  UNPAID --> PAID : paiement total
  PAID --> PARTIALLY_PAID : suppression d'un paiement
  PARTIALLY_PAID --> UNPAID : suppression des paiements
  UNPAID --> cancelled : avoir ≥ total
  PARTIALLY_PAID --> cancelled : avoir ≥ total
  cancelled --> [*]
```
*Figure III.11 : Cycle de vie d'une facture (statuts persistés)*

### 7.5 Diagramme d'activité — Émission d'une facture
```mermaid
flowchart TD
  A(("Début")) --> B["Saisir client, lignes, remise, échéance"]
  B --> C{"Données valides ?<br/>(Zod : entiers XAF, ≥ 1 ligne)"}
  C -- Non --> B
  C -- Oui --> D{"Licence autorise<br/>l'émission ?"}
  D -- Non --> X["Message : mode lecture seule"] --> Z(("Fin"))
  D -- Oui --> E{"Client actif<br/>et du bon tenant ?"}
  E -- Non --> B
  E -- Oui --> F["Calculer CSS, TPS, TVA, TTC"]
  F --> G["Transaction : numéro + facture + lignes"]
  G --> H{"Issu d'un devis ?"}
  H -- Oui --> I["Marquer le devis CONVERTI"]
  H -- Non --> J
  I --> J["Journal d'audit"]
  J --> K["Aperçu, impression ou PDF"]
  K --> L["Synchronisation différée"]
  L --> Z
```
*Figure III.12 : Activité « Émettre une facture »*

---

## 8. Conception technique (diagrammes d'architecture)

### 8.1 Diagramme de composants
```mermaid
flowchart LR
  subgraph ELECTRON["Processus Electron (main.js)"]
    M1["Fenêtre principale<br/>sandbox + contextIsolation"]
    M2["IPC : print, export-pdf, version, updater"]
    M3["Secrets persistants (secrets.json)"]
    M4["Sauvegarde quotidienne"]
    M5["Auto-updater"]
  end
  subgraph NEXT["Serveur Next.js (processus enfant)"]
    N1["Server Actions"]
    N2["Services + Repositories"]
    N3["better-sqlite3"]
    N4["CloudSyncService"]
  end
  PRELOAD["preload.js (contextBridge)"]
  M1 --> PRELOAD --> M2
  M3 -- variables d'environnement --> NEXT
  M1 -- HTTP localhost --> N1 --> N2 --> N3
  N4 --> N3
  N4 -- HTTPS --> SUP[("Supabase")]
  M5 -- HTTPS --> GH["GitHub Releases"]
```
*Figure III.13 : Diagramme de composants du poste Desktop*

### 8.2 Diagramme de déploiement
```mermaid
flowchart TB
  subgraph PC["Poste agence — Windows 10/11"]
    EXE["Facturier-Setup-1.0.0.exe (NSIS)"]
    APP["Electron + Next standalone"]
    FILE[("%APPDATA%/Facturier/data/database.sqlite")]
    BK[("backups/backup_AAAA-MM-JJ.sqlite")]
    SEC["secrets.json (0600)"]
    EXE --> APP
    APP --> FILE
    APP --> BK
    APP --> SEC
  end
  subgraph CLOUD["Cloud"]
    SUPA[("Supabase — PostgreSQL, Auth, RLS")]
    PSY["PowerSync (règles de buckets)"]
    VER["Web Hub (Vercel/Railway)"]
    REL["GitHub Releases"]
  end
  APP -- HTTPS JWT --> SUPA
  APP -. WebSocket .-> PSY
  PSY --> SUPA
  VER --> SUPA
  APP -- mise à jour --> REL
  ADMIN(["Super Admin — navigateur"]) -- HTTPS + MFA --> VER
```
*Figure III.14 : Diagramme de déploiement*

### 8.3 Isolation multi-entreprises côté cloud (RLS)
La migration `20261013_desktop_sync.sql` crée, pour chaque table métier, une politique `tenant_isolation` (`for all to authenticated`) fondée sur `public.current_tenant_id()` ; `tenants` et `profiles` ont des politiques dédiées, et le rôle `superadmin` (AAL2 pour le Hub) un accès global tracé dans `hub_audit_logs`.

### 8.4 Règles de synchronisation PowerSync (buckets)
| Bucket | Paramètre | Contenu |
| :--- | :--- | :--- |
| `tenant_data` | `tenant_id` du JWT ou du profil | Toutes les tables métier de l'entreprise |
| `user_profile` | `user_id` | Profil de l'utilisateur connecté |
| `announcements` | `tenant_id` | Annonces actives (globales ou ciblées) |

---

## 9. Conception détaillée : patrons et choix de code remarquables
| Patron / pratique | Illustration |
| :--- | :--- |
| Architecture en couches | Action → Service → Repository → SQLite |
| Service transactionnel | `db.transaction(() => { … })` pour numéro + facture + lignes + audit |
| Moteur pur / fonction sans effet de bord | `computeTotals` testé sur 10 000 lignes |
| Garde (Guard clause) | `assertLicenseAllowsCreation`, vérifications RBAC en tête d'action |
| Façade de cache | `Proxy` de la base qui redirige `prepare` vers un cache de statements |
| Idempotence des migrations | `CREATE TABLE IF NOT EXISTS`, `PRAGMA table_info` avant `ALTER` |
| Last-Write-Wins + tombstones | `CloudSyncService`, `sync_tombstones` |
| Journal d'audit transverse | `logAudit` appelé dans les transactions |
| Résilience | Error boundaries, télémétrie non bloquante, repli du chemin de base à 3 niveaux |
| Décisions documentées | 33 ADR (contexte, décision, alternatives, risques, vérification) |

---

## 10. Interface homme-machine (IHM)
Éléments à illustrer par des **captures d'écran** (Figure IV.x) : écran de connexion · assistant de configuration initiale (`/setup`) · tableau de bord administrateur et opérateur · liste/édition des devis · éditeur de facture avec calcul en temps réel · fenêtre de paiement · prévisualisation A4 · avoirs · paramètres (taux, logo, mentions) · gestion des utilisateurs · journal d'audit · mises à jour · Web Hub (vue d'ensemble, tenants 360°, flotte, finances, licences).
Principes appliqués : design system unique (`packages/ui`), mode sombre natif, focus clavier visible (WCAG 2.1), retours par *toasts*, indicateurs d'état colorés (statuts), obligatoires marqués d'un astérisque, trois formats d'affichage des listes (tableau / horizontal / blocs).

---

## 11. Stratégie de test et recette (Section 2 du Chapitre IV)

### 11.1 Protocole
1. **Tests unitaires et d'intégration** automatisés (Vitest) à chaque évolution — critère « Definition of Done ».
2. **Maintenance en trois volets** par module (ADR-0028 → 0033) : *correctif* (anomalies fonctionnelles), *curatif* (intégrité et assainissement), *préventif* (index, durcissement multi-tenant).
3. **Recette utilisateur** par l'encadreur et le personnel administratif.

### 11.2 Scénarios de recette (cahier de tests)
| N° | Scénario | Résultat attendu | Statut |
| :---: | :--- | :--- | :---: |
| R1 | Configuration initiale : société, NIF, RCCM, code, taux | Paramètres enregistrés, administrateur créé | ✅ |
| R2 | Créer un client sans téléphone | Refus « numéro requis » | ✅ |
| R3 | Devis de 3 lignes avec remise | Totaux conformes au moteur fiscal (valeur de référence §6.2) | ✅ |
| R4 | Convertir un devis expiré | Refus explicite | ✅ |
| R5 | Convertir deux fois le même devis | Second essai refusé | ✅ |
| R6 | Paiement partiel puis solde | Statuts `PARTIALLY_PAID` → `PAID` | ✅ |
| R7 | Paiement supérieur au reste | Refus avec montant restant | ✅ |
| R8 | Opérateur A consulte les factures de B | Accès refusé (RBAC) | ✅ |
| R9 | 5 mots de passe erronés | Verrouillage 15 min + audit | ✅ |
| R10 | Facturation hors-ligne puis reconnexion | Synchronisation silencieuse | ✅ |
| R11 | Deux postes créent le même numéro | Unicité garantie à la synchronisation | ✅ (limite : continuité, audit §5.3) |
| R12 | Tenant suspendu depuis le Hub | Émission bloquée, consultation conservée | ✅ |
| R13 | Licence expirée depuis 8 jours | Lecture seule ; 5 jours : période de grâce | ✅ |
| R14 | Migration d'une base V1 | Sauvegarde + rattachement au tenant, idempotente | ✅ |
| R15 | Installation sur poste vierge | Application démarre, base dans `%APPDATA%` | ✅ |
| R16 | Impression A4 et export PDF/Excel | Document conforme à la charte | ✅ |

> ✏️ Les statuts ✅ s'appuient sur les tests automatisés existants (`tests/unit`, `tests/integration`, `tests/security`). Pour R15 et R16, ajoutez vos **captures** et la date de recette réelle.

### 11.3 Indicateurs de résultats (tableau IV.x)
| Indicateur | Avant (Word/Excel) | Après (L'Étoile) | Gain |
| :--- | :---: | :---: | :---: |
| Temps de création d'une facture | ✏️ ~15 min (à mesurer) | ✏️ ~2 min (à mesurer) | ✏️ ~85 % |
| Erreurs de calcul fiscal | Fréquentes (manuel) | 0 (moteur testé) | 100 % |
| Doublons de numéros | Possibles | 0 en local ; unicité garantie en synchro | — |
| Disponibilité hors connexion | Oui (fichiers) | Oui | = |
| Traçabilité des actions | Aucune | Audit complet | ✔ |
| Suivi des impayés | Manuel | Tableau de bord temps réel | ✔ |

> ✏️ **Chronométrez** réellement 5 créations de facture avant/après auprès du personnel : des chiffres mesurés valent bien plus qu'une estimation devant le jury.
