# 🏛️ Architecture & Documentation Technique (L'Étoile)

## 1. Vue d'Ensemble
L'Étoile est une application Desktop (Electron) propulsée par des technologies web modernes (Next.js 15, React 19, Tailwind CSS). Elle utilise une architecture **N-Tier** robuste permettant une séparation claire des responsabilités (Separation of Concerns).

La persistance des données s'effectue localement via SQLite (`better-sqlite3`), garantissant l'indépendance de l'application vis-à-vis d'une connexion internet. La gestion de l'état global côté client est assurée par Zustand, tandis que la sécurité (RBAC, Authentification) est protégée par des signatures HMAC cryptographiques.

## 2. Schéma de l'Architecture (Cartographie Exhaustive)

```text
/
├── __tests__/                   # Anciens tests isolés ou temporaires
│   └── api/                     # Tests API obsolètes
├── app/                         # App Router Next.js (Routage et Contrôleurs)
│   ├── api/                     # Couche Controllers (Validation Zod et Appel Services)
│   │   ├── audit-logs/          # Historique des actions (Lecture seule Admin)
│   │   ├── auth/                # Authentification
│   │   │   ├── login/           # Connexion & génération du HMAC
│   │   │   ├── logout/          # Destruction de session
│   │   │   └── me/              # Vérification de session active
│   │   ├── clients/             # Gestion du carnet d'adresses clients
│   │   │   └── [id]/            # Opérations CRUD par client
│   │   ├── credit-notes/        # Gestion des avoirs sur factures
│   │   │   └── [id]/            # Récupération d'un avoir
│   │   ├── dashboard/           # Tableau de bord analytique
│   │   │   └── metrics/         # Agrégation financière et KPIs
│   │   ├── health/              # Sonde de disponibilité de l'API
│   │   ├── invoices/            # Gestion des Factures
│   │   │   ├── [id]/            # CRUD Facture unitaire (incluant Soft Delete)
│   │   │   └── status/          # Mise à jour du statut de paiement
│   │   ├── payments/            # Gestion des Règlements (Acomptes, Soldes)
│   │   │   └── [id]/            # Suppression d'un règlement (re-calcul auto)
│   │   ├── quotes/              # Gestion des Devis (Proformas)
│   │   │   ├── [id]/            # CRUD Devis unitaire
│   │   │   ├── convert/         # Workflow de transformation Devis -> Facture
│   │   │   └── duplicate/       # Clonage d'un devis existant
│   │   ├── services/            # Catalogue des Prestations (Articles)
│   │   │   └── [id]/            # CRUD Service unitaire
│   │   ├── settings/            # Configuration de l'entreprise (NIF, Taxes, Banque)
│   │   ├── setup/               # Onboarding initial (Création de l'Admin)
│   │   └── users/               # Gestion des utilisateurs et rôles (RBAC)
│   │       └── [id]/            # Opérations CRUD par utilisateur
│   ├── login/                   # Page de connexion React
│   ├── setup/                   # Page d'Onboarding React
│   ├── globals.css              # Styles globaux (Tailwind)
│   └── layout.tsx               # Point d'entrée de l'App Shell HTML
├── components/                  # Composants React Frontend
│   ├── dashboard/               # Widgets graphiques (Admin / User Dashboard)
│   ├── features/                # Sous-composants métiers modulaires
│   │   ├── invoices/            # Tableaux, Filtres, Modales dédiés aux Factures
│   │   └── quotes/              # Tableaux, Filtres, Modales dédiés aux Devis
│   ├── layout/                  # Command Menu, Sidebar, Topbar
│   ├── pages/                   # "Smart Components" (Vues complètes qui connectent Zustand/Hooks)
│   └── ui/                      # "Dumb Components" Design System (Shadcn/Radix UI)
├── data/                        # Persistance locale (Fichiers SQLite générés)
├── hooks/                       # Logique Frontend Asynchrone (Couplage fetch/store)
│   ├── use-invoices.ts          # Fetch et actions CRUD Factures
│   ├── use-quotes.ts            # Fetch et actions CRUD Devis
│   └── use-mobile.ts            # Détection de l'affichage mobile
├── lib/                         # Logique Backend et Utilitaires
│   ├── api/                     # Scripts backend partagés (Numbering, Audit Logs)
│   ├── fiscal/                  # Moteur financier (Calcul TVA, TPS, CSS, arrondis XAF)
│   ├── repositories/            # Data Access Layer (Abstraction SQLite db.prepare)
│   │   ├── InvoiceRepository.ts
│   │   ├── MetricsRepository.ts
│   │   ├── QuoteRepository.ts
│   │   └── UserRepository.ts
│   ├── services/                # Business Logic Layer (Orchestration des Workflows)
│   │   ├── CreditNoteService.ts # Création d'avoir et ré-ouverture de facture
│   │   ├── InvoiceService.ts    # Création de facture et calcul des totaux
│   │   └── QuoteService.ts      # Conversion Devis vers Facture
│   ├── types/                   # Définitions TypeScript backend (API Requests/Responses)
│   ├── constants.ts             # Source de vérité (Magic Strings : ROLES, STATUTS)
│   ├── db.ts                    # Singleton de connexion SQLite et Migrations
│   ├── store.ts                 # Zustand (État global de l'application React)
│   └── validations.ts           # Schémas Zod (Validation stricte des payloads API)
├── public/                      # Ressources statiques (Icônes, Splash screen)
├── tests/                       # Assurance Qualité (QA Vitest & Playwright)
│   ├── e2e/                     # Scripts Playwright (Simulation complète navigateur)
│   ├── helpers/                 # Utilitaires de tests (Seeding DB en mémoire)
│   ├── integration/             # Tests Vitest (Isolation RBAC, Workflows API)
│   └── unit/                    # Tests Vitest (Mathématiques fiscales isolées)
├── types/                       # Typages globaux de l'environnement (ex: Electron)
├── ARCHITECTURE.md              # Ce document de référence
├── SPECIFICATIONS.md            # Cahier des charges du logiciel L'Étoile
├── electron-builder.yml         # Configuration du package final Desktop (Windows/Mac/Linux)
├── main.js                      # Processus Main d'Electron (Orchestrateur Desktop)
├── preload.js                   # Processus Preload d'Electron (Pont IPC / Sécurité)
├── middleware.ts                # Protection globale Next.js (Authentification HMAC & RBAC)
├── next.config.mjs              # Configuration Next.js App Router
├── playwright.config.ts         # Configuration des tests E2E
├── tailwind.config.ts           # Design Tokens et couleurs
├── tsconfig.json                # Options strictes du compilateur TypeScript
└── vitest.config.ts             # Configuration du Runner de tests Vitest
```

## 3. Flux de Données (Data Flow)

Le cycle de vie d'une donnée respecte strictement l'architecture N-Tier :

1. **Frontend (UI & Interaction)**
   - L'utilisateur interagit avec une vue (`components/pages/quotes.tsx`).
   - Le composant appelle une méthode exposée par un Custom Hook (`hooks/use-quotes.ts`).
2. **Network (Fetch)**
   - Le Custom Hook déclenche la requête HTTP `fetch('/api/quotes/convert')`.
   - Il gère l'état de chargement local (`isConverting`) et protège contre le double-clic.
3. **Controller (app/api/)**
   - Le routeur Next.js intercepte la requête. Le `middleware.ts` a déjà validé la signature HMAC.
   - Le contrôleur effectue la vérification des rôles (RBAC) via `lib/constants.ts` et valide le Body de la requête avec Zod (`lib/validations.ts`).
4. **Business Logic (lib/services/)**
   - Le contrôleur délègue la requête validée au Service métier (`QuoteService.convertToInvoice()`).
   - Le Service orchestre l'opération (ex: calculs fiscaux via `lib/fiscal/`, orchestration transactionnelle).
5. **Data Access (lib/repositories/)**
   - Le Service ordonne la sauvegarde à la base de données via le Repository (`InvoiceRepository`, `QuoteRepository`). Le Repository génère et exécute le SQL propre via `db.prepare()`.
6. **Retour au Client**
   - Le Repository retourne l'ID créé au Service, qui le retourne au Controller, qui envoie une réponse JSON (200 OK).
   - Le Custom Hook capte la réponse, affiche un Toast de succès via Sonner, et actualise silencieusement l'état global Zustand (`lib/store.ts`) pour que React mette à jour l'UI automatiquement.

## 4. Conventions et Bonnes Pratiques

- **Aucune requête SQL dans l'API** : L'objet SQLite `db` ne doit jamais être importé dans `app/api/...`. Toute requête vers la base doit être encapsulée dans une méthode d'un Repository.
- **Aucune Logique Métier dans les Controllers** : Les fichiers `route.ts` ne font que lire, valider (Zod) et répondre. Le code transactionnel (CRUD complexe) vit dans les Services.
- **Séparation UI / Logique Frontend** : Les composants React (`components/pages/`) ne doivent jamais utiliser directement `fetch()`. Les appels réseaux sont isolés dans des Custom Hooks (`hooks/`). Les très gros composants de page doivent être éclatés en `components/features/`.
- **Tolérance Zéro pour les "Magic Strings"** : Toutes les chaînes de caractères de statut (`PAID`, `EN_ATTENTE`) ou de rôles (`admin`) doivent être appelées depuis l'enum `lib/constants.ts` pour garantir la résilience du refactoring et le typage TypeScript.
- **Monnaie XAF (Arrondis Impératifs)** : Le Franc CFA (XAF) ne possédant pas de décimales, la règle d'or fiscale est d'appliquer `Math.round()` à chaque étape unitaire du calcul (quantité × prixUnitaire par ligne) et non sur le total global, pour éviter toute dérive mathématique liée au standard IEEE 754.
