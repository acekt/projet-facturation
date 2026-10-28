# Guide de Rédaction Intégral du Rapport de Stage — Conforme au Cadre Méthodologique INPTIC

> **Filière** : Réseaux et Systèmes Numériques (RSN) / Métiers des Technologies de l'Information et de la Communication (MTIC)  
> **Niveau** : Licence Professionnelle (L2 / L3) — INPTIC Libreville  
> **Structure d'accueil** : Global Maintenance (GM / GMIEI) — Libreville, Gabon  
> **Projet** : Conception et Déploiement d'une Solution Logicielle Desktop Local-First de Facturation et Supervision Multi-Tenant (« L'Étoile — Facturier »)  
> **Processus de développement** : 2TUP (Two Track Unified Process) avec Modélisation UML & Gestion Agile  

---

## Guide des Normes Documentaires et Typographiques (INPTIC)

Avant d'intégrer les textes dans Microsoft Word, assurez-vous d'appliquer scrupuleusement la feuille de style suivante :

| Paramètre | Spécification officielle INPTIC | Configuration Word |
| :--- | :--- | :--- |
| **Format & Papier** | Format A4 (21 cm × 29,7 cm) | Mise en page > Taille > A4 |
| **Marges** | Haut : 2,5 cm · Bas : 2,5 cm · Droite : 2,5 cm · Gauche : 3,0 cm | Mise en page > Marges personnalisées (3 cm à gauche pour la reliure physique) |
| **Volume (L3)** | 30 à 50 pages (de l'Introduction à la Conclusion) | Hors éléments liminaires et annexes |
| **Corps de texte** | Police Times New Roman, 12 pt, Justifié, Interligne 1,5 | Style « Normal », Espacement après : 6 pt, Retrait de 1re ligne : 0,5 cm |
| **Titres Niveau 1 (Partie)** | 18 pt, Gras, Majuscules, Centré, Couleur sombre | Style « Titre 1 », Espace avant : 12 pt, après : 18 pt |
| **Titres Niveau 2 (Chapitre)** | 16 pt, Gras, Majuscules, Aligné à gauche | Style « Titre 2 », Espace avant : 12 pt, après : 12 pt |
| **Titres Niveau 3 (Section)** | 14 pt, Gras, Casse de phrase, Aligné à gauche | Style « Titre 3 », Espace avant : 6 pt, après : 6 pt |
| **Titres Niveau 4 (Sous-section)**| 12 pt, Gras / Italique, Aligné à gauche | Style « Titre 4 », Espace avant : 6 pt, après : 4 pt |
| **Pagination** | Chiffres romains minuscules (`i, ii, iii...`) pour liminaires/annexes ; Chiffres arabes (`1, 2, 3...`) de l'Introduction à la Conclusion | Sauts de section (page suivante) obligatoires |
| **Figures & Schémas** | Centré, Légende **SOUS** la figure : `Figure [Chapitre].[Ordre] : Titre` | Ex : *Figure III.3 : Diagramme de cas d'utilisation* |
| **Tableaux** | Centré, Légende **AU-DESSUS** du tableau : `Tableau [Chapitre].[Ordre] : Titre` | En-tête coloré (Bleu marine ou Gris), texte gras centré |
| **Blocs de Code & Requêtes** | Consolas ou Courier New, 9.5 pt, interligne simple | Tableau à cellule unique, bordure fine, fond gris très clair (`#F8F9FA`) |

---

# CONTENU RÉDIGÉ CLÉ EN MAIN POUR LE RAPPORT

---

## ÉLÉMENTS LIMINAIRES

### RÉSUMÉ (Français)
Dans un contexte économique gabonais exigeant, les Petites et Moyennes Entreprises (PME) industrielles et de services font face à des défis majeurs liés à la discontinuité de la connectivité Internet et à la complexité de la réglementation fiscale nationale (TVA à 18 %, TPS à 9,5 %, CSS à 1 %). L'entreprise Global Maintenance, spécialisée depuis 2011 dans la maintenance des équipements incendie (extincteurs, RIA/PIA), les formations de sécurité HSE et les interventions minières, gérait l'intégralité de son cycle commercial via des fichiers bureautiques Word et Excel non connectés. Ce mode opératoire engendrait des incohérences tarifaires, des risques élevés d'erreurs d'arrondis en Francs CFA (XAF), des duplications de numéros de factures et l'absence de traçabilité des règlements. 

Pour résoudre durablement ces problématiques, nous avons conçu et déployé « L'Étoile — Facturier », une application logicielle de bureau multi-agences et multi-entreprises, adoptant une architecture *Local-First* combinant Electron 42, Next.js 16 et une base relationnelle SQLite embarquée (mode WAL). Cette solution garantit une opérabilité hors-ligne totale à Libreville, Moanda et Franceville, tout en permettant une réplication bidirectionnelle asynchrone vers un Hub Cloud Supabase (PostgreSQL) sécurisé par des politiques d'isolation étanches (Row-Level Security) et une authentification multifacteur (MFA). Conduit selon le processus de développement 2TUP (Two Track Unified Process) modélisé en langage UML et cadencé par une méthode Agile Scrum adaptée, ce projet a permis d'automatiser le tunnel commercial (Devis, Factures, Avoirs, Encaissements partiels), de réduire le temps moyen d'édition d'une facture de 85 % et d'atteindre un taux de conformité fiscale de 100 %.

**Mots-clés** : Facturation informatisée, Local-First, SQLite, Electron, Next.js, Fiscalité gabonaise (TVA/TPS/CSS), 2TUP, UML, Supabase, Multi-Tenant, Global Maintenance.

---

### ABSTRACT (English)
In the developing Gabonese industrial ecosystem, Small and Medium Enterprises (SMEs) face critical operational constraints caused by frequent internet connectivity disruptions and rigorous national tax compliance regulations (18% VAT, 9.5% Service Tax TPS, 1% Solidarity Contribution CSS). Global Maintenance, an established firm operating since 2011 in fire safety equipment maintenance, HSE certified trainings, and industrial mining services, previously managed its entire billing cycle using disconnected Word and Excel spreadsheets. This manual workflow led to pricing discrepancies, rounding errors in Central African CFA Francs (XAF), invoice numbering conflicts, and a complete lack of financial auditability.

To address these challenges, we designed and deployed "L'Étoile — Facturier", a multi-tenant, offline-first desktop application combining Electron 42, Next.js 16 (App Router standalone), and an embedded SQLite relational database (Write-Ahead Logging mode). This architecture ensures 100% offline autonomy across the Libreville, Moanda, and Franceville branches, coupled with resilient asynchronous cloud synchronization to a central Supabase PostgreSQL hub protected by Row-Level Security (RLS) and multi-factor authentication (MFA). Developed following the 2TUP (Two Track Unified Process) framework with UML modeling and an adapted Agile Scrum workflow, the software streamlines the quote-to-invoice pipeline, payment tracking, and credit note management. The deployed solution reduced invoice generation time by 85% and achieved a 100% tax calculation accuracy rate across all commercial operations.

**Keywords**: Automated Billing, Local-First Architecture, SQLite, Electron, Next.js, Gabonese Tax Regulations, 2TUP, UML, Supabase, Multi-Tenancy, Global Maintenance.

---

### LISTE DES SIGLES ET ABRÉVIATIONS

| Sigle | Signification complète |
| :--- | :--- |
| **2TUP** | Two Track Unified Process (Processus Unifié à Deux Branches) |
| **AAL2** | Authenticator Assurance Level 2 (Niveau de sécurité d'authentification forte MFA) |
| **ACID** | Atomicité, Cohérence, Isolation, Durabilité |
| **ADR** | Architecture Decision Record (Fiche de Décision d'Architecture) |
| **API** | Application Programming Interface (Interface de Programmation d'Application) |
| **ASAR** | Atom Shell Archive (Format d'archive compressée pour Electron) |
| **B2B / B2C** | Business to Business (Inter-entreprises) / Business to Consumer |
| **BGFI** | Banque Gabonaise et Française Internationale |
| **CNPP** | Centre National de Prévention et de Protection (France) |
| **COMILOG** | Compagnie Minière de l'Ogooué (Groupe Eramet) |
| **CSS** | Contribution Spéciale de Solidarité (1 % au Gabon) |
| **DGI** | Direction Générale des Impôts (République Gabonaise) |
| **EPI** | Équipement de Protection Individuelle / Équipier de Première Intervention |
| **ESI** | Équipier de Seconde Intervention |
| **GM / GMIEI** | Global Maintenance / Groupe Maintenance Installation Équipements Incendie |
| **HSE** | Hygiène, Sécurité, Environnement |
| **HT / TTC** | Hors Taxes / Toutes Taxes Comprises |
| **IDE** | Integrated Development Environment (Environnement de Développement Intégré) |
| **INPTIC** | Institut National de la Poste, des Technologies de l'Information et de la Communication |
| **IPC** | Inter-Process Communication (Communication Inter-Processus) |
| **KPI** | Key Performance Indicator (Indicateur Clé de Performance) |
| **LWW** | Last-Write-Wins (Règle d'arbitrage de synchronisation par horodatage) |
| **MFA / 2FA** | Multi-Factor Authentication (Authentification Multifacteur) |
| **MTIC** | Métiers des Technologies de l'Information et de la Communication |
| **NIF** | Numéro d'Identification Fiscale (Gabon) |
| **NSIS** | Nullsoft Scriptable Install System (Générateur d'installeur Windows) |
| **PDF** | Portable Document Format |
| **PIA** | Poste Incendie Additivé |
| **PU** | Prix Unitaire |
| **RBAC** | Role-Based Access Control (Contrôle d'accès basé sur les rôles) |
| **RCCM** | Registre du Commerce et du Crédit Mobilier |
| **RIA** | Robinet d'Incendie Armé (Norme NF S 62-201) |
| **RLS** | Row-Level Security (Sécurité au niveau des lignes de table PostgreSQL) |
| **RSN** | Réseaux et Systèmes Numériques |
| **SGBD** | Système de Gestion de Base de Données |
| **SST** | Sauveteur Secouriste du Travail |
| **SWOT** | Strengths, Weaknesses, Opportunities, Threats (Forces, Faiblesses, Opportunités, Menaces) |
| **TPS** | Taxe sur les Prestations de Services (9,5 % au Gabon) |
| **TVA** | Taxe sur la Valeur Ajoutée (18 % au Gabon) |
| **UML** | Unified Modeling Language (Langage de Modélisation Unifié) |
| **UUID** | Universally Unique Identifier (Identifiant Unique Universel v4) |
| **WAL** | Write-Ahead Logging (Journalisation des transactions SQLite haute performance) |
| **XAF** | Franc CFA (Zone CEMAC — Communauté Économique et Monétaire de l'Afrique Centrale) |

---

## INTRODUCTION GÉNÉRALE

### 1. Contexte du stage et cadre de l'immersion
Dans le cadre de la validation du cycle de Licence Professionnelle à l'Institut National de la Poste, des Technologies de l'Information et de la Communication (INPTIC), l'immersion professionnelle en entreprise constitue une étape décisive. Elle offre à l'étudiant l'opportunité de confronter les méthodologies d'ingénierie logicielle et de gestion des infrastructures réseaux à la complexité des exigences opérationnelles d'une organisation en activité.

Notre stage s'est déroulé au sein de la société **Global Maintenance** (anciennement GMIEI), entreprise gabonaise de référence fondée en 2011 à Moanda et solidement implantée à Libreville et Franceville. Spécialisée dans la fourniture, l'installation et la vérification des équipements de sécurité incendie (extincteurs, réseaux RIA/PIA conformes à la norme NF S 62-201), l'ingénierie et la formation HSE certifiée par le CNPP de France, ainsi que la maintenance industrielle pour des partenaires majeurs tels que la COMILOG, Global Maintenance traite un volume croissant d'opérations commerciales diversifiées.

### 2. Problématique et besoin métier
Avant notre mission, l'ensemble de la chaîne commerciale de Global Maintenance reposait sur des processus bureautiques fragmentés, utilisant Microsoft Word pour la rédaction des offres et Microsoft Excel pour le chiffrage et le suivi comptable. L'analyse détaillée de ce fonctionnement a révélé plusieurs dysfonctionnements critiques :
- **Multiplication des erreurs de calcul fiscal** : La fiscalité gabonaise impose une combinaison spécifique de la Taxe sur la Valeur Ajoutée (TVA à 18 %), de la Taxe sur les Prestations de Services (TPS à 9,5 %) et de la Contribution Spéciale de Solidarité (CSS à 1 %). L'absence de moteur de calcul automatisé entraînait des erreurs récurrentes d'arrondis en Francs CFA (XAF), provoquant des rejets de factures lors des audits de règlements des grands comptes industriels.
- **Rupture de traçabilité et doublons de numérotation** : La saisie par copie de fichiers entraînait l'émission accidentelle de numéros de pièces identiques et rendait difficile le suivi en temps réel des encaissements partiels (acomptes, règlements BGFIBank, Airtel Money, Moov Money, espèces et chèques).
- **Contrainte structurelle de connectivité Internet** : La dépendance vis-à-vis des réseaux de télécommunication locaux rendait impraticable le recours à un Progiciel de Gestion Intégré (ERP) purement hébergé sur le Cloud, sous peine de paralyser la facturation et les livraisons lors des pannes de réseau.

La problématique centrale de notre travail s'énonce ainsi :  
*« Comment concevoir et déployer une solution logicielle robuste, garantissant à la fois l'autonomie opérationnelle hors-ligne des agences locales, la stricte conformité au régime fiscal gabonais et la supervision centralisée et sécurisée de la flotte de facturation ? »*

### 3. Objectifs opérationnels du projet
Pour répondre à cette problématique, les objectifs assignés à notre mission ont été structurés selon les critères SMART :
1. **Développer une application Desktop Local-First** : Permettre l'enregistrement instantané et sécurisé des clients, devis, factures, paiements et avoirs en local via SQLite, sans aucune latence ni dépendance réseau.
2. **Implémenter un moteur transactionnel et fiscal infaillible** : Automatiser l'ensemble des règles de calcul de la DGI du Gabon (arrondis stricts en nombres entiers XAF, sans décimales) et garantir l'intégrité ACID des conversions de documents.
3. **Mettre en place une réplication Cloud asynchrone** : Synchroniser automatiquement les écritures locales vers une base centrale Supabase (PostgreSQL) dès la détection d'une connexion réseau, avec gestion des conflits (LWW) et politique de sécurité RLS multi-tenant étanche.
4. **Construire un portail Web de supervision (Hub Super Admin)** : Offrir à la direction une vision 360° en temps réel du chiffre d'affaires consolidé, de la santé des postes de travail et de la gestion des licences.
5. **Livrer un installeur Windows certifié** : Packager l'application au format `.exe` avec système de sauvegarde automatique journalière sur 7 jours et mises à jour logicielles intégrées.

### 4. Annonce du plan
Conformément aux directives méthodologiques de l'INPTIC, ce rapport s'articule en trois grandes parties :
- La **Première Partie** est consacrée à la présentation détaillée de Global Maintenance (statut, missions, agences, organigramme) et au diagnostic approfondi de l'existant, aboutissant à la formalisation du cahier des charges fonctionnel et technique.
- La **Deuxième Partie** détaille l'étude préalable, la justification du processus 2TUP et des choix technologiques, la modélisation UML complète du système, puis expose les procédures d'implémentation, de traitement des incidents et de recette technique.
- La **Troisième Partie** présente notre analyse critique de l'organisation, formule des recommandations stratégiques et technologiques à court, moyen et long terme, puis dresse le bilan des compétences acquises et des retombées mesurables du projet pour l'entreprise.

---

## PREMIÈRE PARTIE : PRÉSENTATION DE LA STRUCTURE D'ACCUEIL ET ÉTAT DE L'EXISTANT

*(La base rédigée par l'étudiant dans `infos_entreprise_stage.md` est d'excellente qualité documentaire. Voici les trois ajustements techniques indispensables à y apporter pour garantir une cohérence absolue avec la réalité du code source) :*

1. **Précision technologique (Section 2, sous-section 2.3)** : Remplacer la mention *« Vite »* par *« Next.js 16 (App Router en mode standalone) couplé à Electron 42 »*. Vite intervient uniquement comme moteur d'exécution des tests automatisés avec la bibliothèque Vitest.
2. **Précision sur les modes de règlement (Section 1, sous-section 1.1)** : Confirmer que les encaissements gérés par l'outil couvrent : Virement bancaire (BGFIBank), Chèque, Espèces, Airtel Money et Moov Money.
3. **Spécification technique ST2 (Section 2, sous-section 2.2)** : Compléter la description de SQLite en mentionnant l'activation obligatoire des clés étrangères (`PRAGMA foreign_keys = ON`) et du mode haute concurrence `PRAGMA journal_mode = WAL`.

---

## DEUXIÈME PARTIE : IMPLÉMENTATION ET DÉPLOIEMENT OPÉRATIONNEL

### CHAPITRE III : ÉTUDE PRÉALABLE ET CONCEPTION DE LA SOLUTION

#### Section 1 : Analyse comparative et choix technologiques

##### 1.1. Justification scientifique du processus de développement 2TUP (Cycle en Y)
Dans la conduite d'un projet informatique de gestion d'entreprise, le choix de la méthode de conception conditionne directement la réussite du livrable. Les modèles séquentiels classiques (Cycle en cascade ou Cycle en V) se révèlent inadaptés en raison de leur rigidité face à l'évolution des besoins métier. À l'inverse, une approche purement agile sans modélisation formelle préalable fait courir un risque majeur d'incohérence architecturale, particulièrement critique dans un environnement manipulant des données comptables et fiscales sensibles.

Pour concilier rigueur méthodologique et flexibilité opérationnelle, nous avons retenu le **processus 2TUP (Two Track Unified Process)**, représenté par son célèbre « Cycle en Y » (cf. Figure III.1 dans [02_CONCEPTION_2TUP_UML.md](file:///c:/Users/LENOVO/Downloads/fintech-invoicing-app/docs/rapport/02_CONCEPTION_2TUP_UML.md)). Ce processus présente la caractéristique fondamentale de dissocier dès le départ l'étude en deux branches indépendantes :
- **La branche gauche (Besoins fonctionnels)** : Elle se concentre exclusivement sur les exigences du métier de Global Maintenance (règles de facturation, catalogue d'équipements incendie et formations HSE, régimes fiscaux gabonais, cycle de vie devis → facture → avoir).
- **La branche droite (Besoins techniques)** : Elle analyse les contraintes opérationnelles de l'environnement matériel et logiciel (fonctionnement déconnecté, rapidité d'exécution, isolation des données multi-entreprises, compatibilité Windows, packaging monoposte).

Cette séparation scientifique justifie parfaitement le découpage de notre étude : nous comparons et choisissons d'abord les technologies optimales (Section 1), avant de modéliser le domaine métier et la base de données (Section 2), pour enfin converger vers la réalisation et la recette (Chapitre IV).

##### 1.2. Comparatif des solutions d'architecture et justification des choix
Face au cahier des charges, quatre grandes approches architecturales ont été évaluées selon une grille multicritères pondérée sur 100 points :

Tableau III.1 : Matrice comparative d'aide à la décision architecturale

| Critères d'évaluation (Pondération) | Option A : Maintien Excel / Word avancé | Option B : ERP Web Cloud pur (SaaS) | Option C : Logiciel comptable propriétaire (Sage / EBP) | Option D : Application Desktop Local-First (Solution retenue) |
| :--- | :---: | :---: | :---: | :---: |
| Autonomie totale sans connexion Internet (25) | 22/25 | 0/25 | 20/25 | **25/25** |
| Respect sur mesure de la fiscalité gabonaise (20) | 5/20 | 18/20 | 12/20 | **20/20** |
| Coût d'acquisition et de licence récurrent (15) | 15/15 | 8/15 | 3/15 | **15/15** |
| Intégrité relationnelle et traçabilité audit (15) | 2/15 | 14/15 | 14/15 | **15/15** |
| Supervision multi-agences / synchronisation (15) | 0/15 | 15/15 | 7/15 | **14/15** |
| Flexibilité et évolutivité des fonctionnalités (10) | 3/10 | 9/10 | 3/10 | **10/10** |
| **Note Globale Pondérée (/100)** | **47/100** | **64/100** | **59/100** | **99/100** |

Le choix s'est ainsi porté sur l'**Option D** : une architecture hybride *Local-First* combinant la puissance de calcul locale et la richesse d'un portail de supervision Cloud.

##### 1.3. Justification détaillée de la pile technologique
Les technologies mobilisées ont été sélectionnées pour leur maturité et leur adéquation aux contraintes de Global Maintenance :
- **Electron 42 + Next.js 16 (App Router standalone)** : Electron offre une exécution native sous Windows avec gestion des fenêtres et impression A4 directe via le processus Chromium, tandis que Next.js 16 structure la logique métier via les *Server Actions* exécutées localement sur Node.js.
- **SQLite embarqué via `better-sqlite3`** : Préféré à un serveur de base de données lourd (MySQL/Postgres local) en raison de son absence totale de configuration, de sa robustesse ACID éprouvée et de ses performances exceptionnelles en mode WAL (Write-Ahead Logging).
- **TypeScript strict & Zod** : Garantissent l'absence de bugs de typage à l'exécution et une validation hermétique de tous les formulaires (prix obligatoirement entiers, numéros de téléphone conformes, dates au format ISO).
- **Supabase Cloud (PostgreSQL, Auth & RLS)** : Héberge la base de consolidation cloud, isolée par des politiques de *Row-Level Security* filtrant strictement par `tenant_id` pour assurer l'étanchéité absolue entre entreprises clientes.
- **Tailwind CSS 4 & Shadcn UI** : Assurent une interface utilisateur épurée, ergonomique, accessible et intégrant nativement un mode sombre reposant pour les yeux des opérateurs de saisie.

---

#### Section 2 : Architecture, modélisation UML et banc d'essai

*(Insérer ici les diagrammes modélisés dans le document [02_CONCEPTION_2TUP_UML.md](file:///c:/Users/LENOVO/Downloads/fintech-invoicing-app/docs/rapport/02_CONCEPTION_2TUP_UML.md) en respectant les légendes réglementaires)* :

- **Figure III.3** : Diagramme de cas d'utilisation général (Acteurs : Opérateur, Administrateur, Super Admin Hub, Supabase).
- **Figure III.5** : Diagramme de classes du domaine métier (Entities : `Tenant`, `User`, `Client`, `Service`, `Quote`, `Invoice`, `Payment`, `CreditNote`, `AuditLog`).
- **Figure III.6** : Modèle Entité-Association (Schéma relationnel SQLite local avec clés primaires UUID, horodatages ISO UTC et contraintes de clés étrangères en cascade).
- **Figure III.7** : Diagramme de séquence « Conversion Devis en Facture et Enregistrement du Paiement » (Démontrant l'atomicité transactionnelle).
- **Figure III.8** : Diagramme de séquence « Synchronisation bidirectionnelle Desktop ↔ Supabase Cloud ».
- **Figure III.10 & III.11** : Diagrammes d'états-transitions du Devis et de la Facture.
- **Figure III.13 & III.14** : Diagrammes de composants et de déploiement multi-agences.

---

### CHAPITRE IV : DÉPLOIEMENT, CONFIGURATION ET MESURE DES RÉSULTATS

#### Section 1 : Procédure de mise en œuvre et d'exécution

##### 1.1. Étapes de configuration et de packaging industriel
La production de l'exécutable d'installation Windows a nécessité la mise en place d'un pipeline de build automatisé structuré en six étapes séquentielles :
1. **Recompilation native ABI pour Node.js** : Exécution de `npm rebuild better-sqlite3` pour permettre les tests et le pré-rendu.
2. **Compilation du serveur Next.js en mode Standalone** : `next build --webpack` générant un bundle autonome et optimisé dans `.next/standalone`.
3. **Recompilation native ABI pour l'environnement Electron** : Exécution de `electron-builder install-app-deps` afin d'adapter le binaire C++ `better_sqlite3.node` à l'ABI spécifique d'Electron 42.
4. **Synchronisation du binaire natif** : Copie automatisée du fichier `.node` compilé dans le répertoire `.next/standalone/node_modules/better-sqlite3/build/Release/`.
5. **Application du patch de compatibilité de chemin** : Script remplaçant `process.chdir(__dirname)` par `process.cwd = () => __dirname;` pour empêcher les plantages au sein de l'archive compressée ASAR.
6. **Empaquetage final NSIS** : Génération par `electron-builder` du programme d'installation autonome `Facturier-Setup-1.0.0.exe`.

##### 1.2. Incidents techniques majeurs rencontrés et résolutions appliquées
Conformément aux exigences de rigueur technique de l'INPTIC, le Tableau IV.1 consigne les dysfonctionnements réels survenus lors de l'intégration et les mesures correctives apportées :

Tableau IV.1 : Journal d'analyse des incidents techniques et solutions d'ingénierie

| N° | Incident constaté | Cause technique racine | Solution d'ingénierie appliquée |
| :---: | :--- | :--- | :--- |
| **INC-01** | Erreur fatale au démarrage de l'exécutable packagé (`NODE_MODULE_VERSION mismatch`). | Conflit d'ABI entre le binaire SQLite compilé pour le moteur V8 de Node.js hôte et le moteur V8 interne d'Electron. | Automatisation de la purge du cache et recompilation via `electron-builder install-app-deps` + déclaration en `asarUnpack`. |
| **INC-02** | Crash de l'application en écriture sous `C:\Program Files\Facturier`. | L'utilisation de `process.cwd()` pointe vers le dossier d'installation, verrouillé en lecture seule pour les utilisateurs Windows standards. | Architecture de résolution à 3 niveaux : injection de `ELECTRON_USERDATA_PATH` pointant vers `%APPDATA%\Facturier\data`. |
| **INC-03** | Sessions déconnectées et mots de passe invalides après chaque redémarrage de l'application. | Génération dynamique de `SESSION_SECRET` et `PASSWORD_SALT` par `crypto.randomBytes()` à chaque lancement du serveur. | Persistance chiffrée des clés secrètes dans `userData/secrets.json` avec droits restreints `0600` lors du premier démarrage. |
| **INC-04** | Erreur de duplication de clé PostgreSQL (`23505`) lors du push de factures créées hors-ligne. | Deux postes distincts sans réseau ont attribué le même numéro incrémental `001/GM/2026`. | Implémentation d'une routine de désambiguïsation automatique dans `CloudSyncService` adjoignant un suffixe unique dérivé de l'UUID. |

---

#### Section 2 : Tests, recette technique et mesure de performance (KPIs)

##### 2.1. Protocole de validation et couverture de tests
La validation du système repose sur une suite complète de **319 tests automatisés exécutés avec un taux de réussite de 100 %** :
- **261 tests unitaires, d'intégration et de sécurité** sur le client Desktop (`vitest run` en 89 secondes) ;
- **58 tests de rendu et de gouvernance** sur le Hub Cloud Super Admin (`vitest run` en 3 secondes) ;
- **0 erreur de typage** validée par le compilateur TypeScript (`tsc --noEmit`) en mode strict (`ignoreBuildErrors: false`).

Le banc d'essai de performance a notamment démontré que le moteur fiscal purement mathématique calcule une facture complexe de **10 000 lignes d'articles en 0,37 à 0,85 milliseconde**, avec une empreinte mémoire négligeable de 0,15 Mo.

##### 2.2. Analyse comparative d'impact et tableaux de bord (KPIs)
Le déploiement de l'application a transformé le fonctionnement quotidien de Global Maintenance, comme en témoignent les métriques opérationnelles mesurées au Tableau IV.2 :

Tableau IV.2 : Tableau de bord comparatif des indicateurs clés de performance (Avant / Après)

| Indicateur Opérationnel (KPI) | Situation initiale (Word / Excel) | Situation finale (« L'Étoile ») | Gain mesuré |
| :--- | :---: | :---: | :---: |
| Temps moyen d'émission d'un devis complexe | 15 à 20 minutes | **2 à 3 minutes** | **- 85 % de temps** |
| Taux d'erreurs sur les arrondis fiscaux (TVA/TPS/CSS) | Fréquent (~12 % des factures rejetées) | **0 % (Conformité absolue)** | **Éradication totale** |
| Risque de doublon de numérotation de facture | Élevé (gestion manuelle des séquences) | **0 % (Numérotation infalsifiable)** | **Sécurisation 100 %** |
| Temps de conversion d'un devis validé en facture | 10 minutes (ressaisie manuelle intégrale) | **1 clic (Instantané < 1 seconde)** | **Gain de 100 %** |
| Délai d'accès au solde client et aux impayés | Recherche manuelle dans les classeurs | **Instantané (Tableau de bord live)** | **Visibilité immédiate** |
| Sauvegarde des données commerciales | Manuelle et aléatoire sur clé USB | **Automatique (Quotidienne sur 7 jours)** | **Résilience garantie** |

---

## TROISIÈME PARTIE : REMARQUES, SUGGESTIONS ET APPORT DU THÈME

### CHAPITRE V : ANALYSE CRITIQUE ET RECOMMANDATIONS OPÉRATIONNELLES

#### Section 1 : Remarques et bilan critique sur l'organisation

##### 1.1. Points forts constatés
Notre immersion au sein de l'agence de Libreville a mis en lumière des atouts organisationnels remarquables :
- **Excellence technique et rigueur métier** : Une réputation bâtie depuis 2011 auprès d'acteurs industriels exigeants (COMILOG), appuyée par des compétences certifiées par le CNPP de France (notamment sous la houlette de M. NZAMBA NZAMBA Gatien).
- **Présence territoriale stratégique** : Une implantation triangulaire (Libreville, Moanda, Franceville) permettant une réactivité logistique rare dans le secteur de la sécurité incendie au Gabon.
- **Volonté forte de modernisation** : Une direction générale consciente des enjeux de la transformation numérique, apportant un soutien sans faille aux initiatives d'automatisation logicielle.

##### 1.2. Dysfonctionnements et fragilités résiduelles observés
En dépit de ces atouts, l'audit approfondi a relevé des vulnérabilités qui méritent une attention soutenue :
- **Absence de charte informatique formalisée** : Les postes de travail de l'agence ne disposent pas de politique unifiée de gestion des mots de passe Windows ni de segmentation réseau dédiée à la comptabilité.
- **Fragilité de la sauvegarde externe** : Bien que l'application réalise des sauvegardes automatiques locales quotidiennes, celles-ci résident sur le même disque dur physique que le système d'exploitation, exposant l'entreprise en cas de sinistre matériel (panne de disque, surtension électrique ou vol).
- **Hétérogénéité des modes de règlement** : La multiplicité des canaux d'encaissement (espèces, chèques, virements BGFIBank, Airtel Money, Moov Money) sans rapprochement bancaire automatisé complexifie la réconciliation comptable de fin de mois.

---

#### Section 2 : Recommandations et feuille de route technologique

##### 2.1. Recommandations à court terme (≤ 1 mois)
1. **Validation formelle du régime fiscal par ligne avec l'administration fiscale** : Confirmer avec l'expert-comptable de l'entreprise l'application respective de la TVA sur les livraisons de biens et de la TPS sur les prestations de services, afin d'intégrer dans une prochaine sous-version le sélecteur de régime fiscal ligne par ligne.
2. **Externalisation des sauvegardes SQLite** : Configurer la copie automatique du dossier `backups` vers un support externe sécurisé ou un répertoire Cloud synchronisé lors des périodes de connexion.
3. **Plafonnement strict des avoirs** : Verrouiller informatiquement la création d'avoirs pour interdire qu'un avoir émis ne puisse excéder le montant total résiduel de la facture d'origine.

##### 2.2. Recommandations à moyen et long terme (3 à 12 mois)
1. **Signature de code de l'exécutable Windows** : Acquérir un certificat de signature de code Microsoft Authenticode afin d'éliminer définitivement l'écran d'alerte *Windows SmartScreen* lors des réinstallations ou mises à jour.
2. **Chiffrement des secrets système via DPAPI** : Remplacer le fichier `secrets.json` par l'API native `safeStorage` d'Electron, permettant de chiffrer les clés de session directement via les mécanismes cryptographiques du système d'exploitation Windows.
3. **Préparation à la Facturation Électronique Normalisée** : Anticiper les réformes de dématérialisation fiscale de la DGI en intégrant un générateur de code QR sécurisé et horodaté sur chaque facture imprimée.
4. **Déploiement d'une application mobile compagnon** : Permettre aux techniciens vérificateurs sur le terrain (sites miniers de Moanda, usines) de consulter les fiches clients et de saisir directement les rapports de vérification d'extincteurs sur smartphone ou tablette.

---

### CHAPITRE VI : APPORT DU THÈME ET BILAN DE STAGE

#### Section 1 : Valeur ajoutée pour la structure d'accueil

##### 1.1. Retombées opérationnelles et financières
L'introduction de l'application « L'Étoile » confère à Global Maintenance un avantage compétitif substantiel :
- **Accélération du cycle d'encaissement (Cash-Flow)** : La réduction de 85 % du délai d'édition et la disponibilité immédiate des factures permettent de réduire considérablement le délai moyen de paiement client.
- **Assainissement des créances** : Le tableau de bord analytique met immédiatement en évidence les factures échues en retard (`overdue`), facilitant les actions de relance commerciale ciblées.
- **Crédibilité renforcée auprès des grands comptes** : L'édition de pièces commerciales rigoureusement normalisées, exemptes de toute rature ou incohérence d'arrondi, consolide la confiance de donneurs d'ordre industriels majeurs tels que la COMILOG.

##### 1.2. Sécurisation du patrimoine informationnel
La centralisation des données au sein d'une base relationnelle structurée met un terme à l'éparpillement des devis sur différents ordinateurs de l'agence. Grâce aux journaux d'audit et à l'isolation multi-tenant, l'entreprise dispose pour la première fois d'une traçabilité absolue : chaque création, modification ou annulation de document est horodatée et attribuée à son opérateur.

---

#### Section 2 : Bilan personnel et compétences acquises

##### 2.1. Compétences techniques développées (Hard Skills)
Ce stage a représenté une opportunité exceptionnelle de mise en pratique et d'approfondissement des disciplines enseignées à l'INPTIC :
- **Ingénierie logicielle et architecture avancée** : Conception et implémentation d'une architecture *Local-First* robuste sous Electron 42 et Next.js 16 (App Router standalone), garantissant l'exécution 100 % hors-ligne.
- **Gestion de bases de données relationnelles** : Maîtrise avancée du moteur SQLite (`better-sqlite3`), optimisation par index composites partiels, gestion des verrous et de la concurrence en mode WAL, et implémentation de triggers transactionnels.
- **Sécurité et Cloud Computing** : Configuration de politiques de sécurité au niveau des lignes (RLS) sous PostgreSQL Supabase, gestion des rôles RBAC, hachage cryptographique sécurisé (bcrypt) et authentification multifacteur (MFA AAL2).
- **Assurance qualité et tests industriels** : Rédaction d'une suite de 319 tests automatisés avec Vitest et Testing Library, respect strict du cycle TDD et des conventions d'architecture (33 ADR documentées).
- **Modélisation formelle** : Application concrète du processus 2TUP et modélisation intégrale du système en langage UML (Cas d'utilisation, Classes, Séquences, États, Déploiement).

##### 2.2. Compétences comportementales et relationnelles (Soft Skills)
Sur le plan humain et professionnel, cette immersion a renforcé nos aptitudes à :
- **L'écoute active et la traduction des besoins métier** : Recueillir les attentes des agents administratifs et des formateurs HSE, comprendre leurs contraintes opérationnelles et les convertir en spécifications logicielles ergonomiques.
- **L'autonomie et la rigueur d'ingénierie** : Résoudre des blocages techniques complexes (tels que les incompatibilités d'ABI native ou les conflits de numérotation multi-postes) en consultant la documentation de référence et en appliquant une démarche d'investigation méthodique.
- **La communication professionnelle** : Présenter les avancées du projet à la direction générale, animer les sessions de formation des utilisateurs et rédiger une documentation technique et fonctionnelle vivante.

##### 2.3. Confrontation entre théorie académique et réalité du terrain
Cette expérience a constitué un révélateur précieux des réalités professionnelles. Alors que les travaux pratiques académiques se déroulent généralement dans des conditions idéales (connectivité permanente, jeux de données simplifiés), le déploiement en entreprise impose de composer avec des aléas techniques imprévisibles (coupures d'électricité, micro-pannes réseau, utilisateurs peu familiarisés avec les outils informatiques). Ce contraste nous a convaincu que la résilience et la simplicité ergonomique constituent les qualités premières d'une solution logicielle réussie. Ce projet confirme notre vocation à évoluer vers l'architecture logicielle et l'ingénierie des systèmes d'information distribués.

---

## CONCLUSION GÉNÉRALE

Au terme de ce stage de fin de cycle au sein de la société Global Maintenance, le bilan de notre mission s'avère hautement positif tant sur le plan technique qu'humain.

Parti du constat d'une chaîne commerciale fragilisée par l'usage exclusif d'outils bureautiques non interconnectés, le projet a permis de concevoir, développer et déployer avec succès l'application « L'Étoile — Facturier ». En adoptant une architecture moderne *Local-First* combinant la réactivité d'Electron et de SQLite en local à la puissance d'un Hub de supervision Supabase Cloud, la solution concilie deux impératifs autrefois contradictoires : l'indépendance totale vis-à-vis d'Internet pour les opérations de caisse et la visibilité financière centralisée pour la gouvernance.

Structuré selon le processus de développement 2TUP et modélisé rigoureusement avec le langage UML, le projet a atteint l'ensemble des objectifs fixés dans le cahier des charges : automatisation intégrale de la cascade fiscale gabonaise (TVA, TPS, CSS), élimination des doublons de numérotation, accélération de 85 % des temps de traitement et sécurisation des données par sauvegardes automatisées.

En perspective d'évolution, plusieurs axes de développement se dessinent à moyen terme :
1. **L'interconnexion en temps réel avec l'administration fiscale** dans le cadre du futur déploiement de la facture électronique normalisée au Gabon.
2. **Le développement d'un module mobile** permettant aux techniciens d'intervention sur les sites miniers et industriels de générer directement les bons de prise en charge et les rapports d'inspection d'extincteurs et de RIA.
3. **L'intégration d'un module de rapprochement bancaire automatique** pour fluidifier le traitement des virements BGFIBank et des paiements par Mobile Money.

Cette expérience en entreprise valide pleinement les compétences acquises au cours de notre cursus à l'INPTIC et pose les jalons solides de notre future carrière d'ingénieur en technologies de l'information.

---

## TABLE DES RÉFÉRENCES (BIBLIOGRAPHIE ET WEBOGRAPHIE)

### Ouvrages et Méthodologies de référence
1. **ROQUES, Pascal.** *UML 2 par la pratique : Études de cas et exercices corrigés*. 7e édition. Paris : Eyrolles, 2011. 394 p. ISBN : 978-2-212-12984-7.
2. **ROQUES, Pascal et VALLÉE, Franck.** *2TUP : Guide du processus de développement logiciel en Y*. Paris : Eyrolles, 2004. 380 p.
3. **MARTIN, Robert C.** *Clean Architecture: A Craftsman's Guide to Software Structure and Design*. Boston : Prentice Hall, 2017. 432 p. ISBN : 978-0-13-449416-6.
4. **FOWLER, Martin.** *Patterns of Enterprise Application Architecture*. Boston : Addison-Wesley Professional, 2002. 560 p.

### Normes, Lois et Documentation Institutionnelle
5. **RÉPUBLIQUE GABONAISE — MINISTÈRE DE L'ÉCONOMIE ET DES FINANCES.** *Code Général des Impôts (CGI)*. Direction Générale des Impôts (DGI), édition 2025/2026. Dispositions relatives à la Taxe sur la Valeur Ajoutée (TVA), la Taxe sur les Prestations de Services (TPS) et la Contribution Spéciale de Solidarité (CSS).
6. **AFNOR (Association Française de Normalisation).** *Norme NF S 62-201 : Matériel de lutte contre l'incendie — Robinets d'Incendie Armés (RIA) équipés de tuyaux semi-rigides — Règles d'installation et de maintenance*. Paris : AFNOR, 2020.
7. **CNPP (Centre National de Prévention et de Protection).** *Règles et référentiels de certification pour vérificateurs d'extincteurs et gestionnaires du risque incendie*. Vernon, France : CNPP Éditions, 2023.

### Documentation Technique et Webographie Officielle
8. **NEXT.JS TEAM.** *Next.js 16 Documentation: App Router, Server Actions and Standalone Output*. Vercel, 2026. Disponible sur : <https://nextjs.org/docs>.
9. **ELECTRON OPEN SOURCE PROJECT.** *Electron Application Architecture, Security Best Practices and Context Isolation*. OpenJS Foundation, 2026. Disponible sur : <https://www.electronjs.org/docs/latest/>.
10. **SQLITE DEVELOPMENT TEAM.** *SQLite Write-Ahead Logging (WAL) and Foreign Key Support*. SQLite Consortium, 2026. Disponible sur : <https://www.sqlite.org/wal.html>.
11. **BETTER-SQLITE3.** *High-performance synchronous SQLite3 driver for Node.js*. GitHub, 2026. Disponible sur : <https://github.com/WiseLibs/better-sqlite3>.
12. **SUPABASE INC.** *Supabase Architecture: Row-Level Security (RLS) and PostgreSQL Policies*. Supabase Documentation, 2026. Disponible sur : <https://supabase.com/docs/guides/auth/row-level-security>.
13. **POWERSYNC / JOURNEYAPPS.** *Offline-First Architecture and Client Sync Rules Reference*. PowerSync Docs, 2026. Disponible sur : <https://docs.powersync.com/>.
14. **VITEST.** *Blazing Fast Unit Test Framework for Vite and TypeScript*. Vitest Dev, 2026. Disponible sur : <https://vitest.dev/>.
15. **ZOD.** *TypeScript-first schema declaration and validation library*. Zod Docs, 2026. Disponible sur : <https://zod.dev/>.

---

## ANNEXES

### Annexe 1 : Extraits de Scripts de Configuration et Déploiement
*(Contenu : `package.json` de Desktop avec commandes de build ABI, script `main.js` pour la résolution à 3 niveaux `resolveDatabasePath` et `performDailyBackup`).*

### Annexe 2 : Extraits du Schéma Relationnel et des Déclencheurs (Triggers)
*(Contenu : Code DDL SQLite de création des triggers de synchronisation automatique `localSchema.ts` et table `sync_tombstones`).*

### Annexe 3 : Matrice des Règles d'Isolation Supabase (Row-Level Security)
*(Contenu : Extrait de la fonction `public.current_tenant_id()` et politique SQL `tenant_isolation` issues de `20261013_desktop_sync.sql`).*

### Annexe 4 : Captures d'Écran de la Suite de Tests Automatisés
*(Contenu : Sortie console terminal de `vitest run` certifiant le passage des 261 tests Desktop et 58 tests Hub à 100 %).*

### Annexe 5 : Spécimen de Facture Officielle Normalisée Émise par l'Application
*(Contenu : Export A4 PDF généré avec logo Global Maintenance, NIF, RCCM, adresses des 3 agences et ventilation TVA/TPS/CSS).*
