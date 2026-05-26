# Cahier des Charges Fonctionnel et Technique (CDCFT) - L'Étoile

## 1. PRÉSENTATION GÉNÉRALE ET OBJECTIFS

- **Nom de l'application :** L'Étoile
- **Cible :** Petites et Moyennes Entreprises (PME) et prestataires de services opérant sur le marché gabonais.
- **Nature du logiciel :** Application desktop fintech dédiée à la facturation et à la gestion de devis.
- **Mode de déploiement :** Monoposte (installation locale stricte), garantissant un fonctionnement 100% hors-ligne.
- **Objectif clé :** Proposer une expérience utilisateur premium, inspirée des standards visuels de Linear, Stripe et Vercel, pour une gestion comptable fluide, robuste et sans compromis.

---

## 2. ARCHITECTURE TECHNIQUE ET STACK

L'application repose sur une architecture moderne et performante, optimisée pour le déploiement desktop.

- **Framework principal :** [Next.js](https://nextjs.org/) (version 16.2.6) utilisant le compilateur **Turbopack** pour des performances de développement et de build accrues.
- **Environnement d'exécution :** [Electron.js](https://www.electronjs.org/), permettant l'encapsulation de l'application web en une application desktop native (Windows).
- **Base de données :** SQLite local, géré via la bibliothèque `better-sqlite3`. L'accès aux données est centralisé dans `lib/db.ts` et protégé par une couche de service (`proxy.ts`).
- **Langage et Typage :** **TypeScript** en mode strict, assurant la robustesse du code et la maintenabilité à long terme.
- **Gestionnaire de paquets :** **npm** exclusivement. Toute utilisation de pnpm est proscrite au sein du workspace.
- **Gestion d'état :** Zustand pour un état global réactif et synchronisé avec le backend SQLite.

---

## 3. SPÉCIFICATIONS FONCTIONNELLES (LOGIQUE MÉTIER)

### Gestion des Rôles et Sécurité
- **Authentification :** Système de connexion local sécurisé.
- **Rôles :** Distinction entre 'Admin' (accès total, configuration, suppression) et 'User' (opérations courantes).
- **Sécurité :** Hachage des mots de passe en SHA-256 et protection des routes via middleware.

### Cycle de vie des documents
- **Règle d'or :** Une facture ne peut pas être créée ex nihilo. Elle naît **EXCLUSIVEMENT** de la conversion d'un devis validé.
- **Facture Miroir :** Lors de la conversion, l'intégralité des données du devis (lignes, prix, remises, taxes) est figée. La facture générée est **non-modifiable** pour préserver l'intégrité comptable.
- **Épurement du workflow :** Suppression des boutons "Enregistrer un brouillon" et des actions de duplication. L'action unique pour le devis est "Générer le devis".
- **Dynamisme :** Le catalogue de services (table `services`) alimente dynamiquement les listes déroulantes de l'éditeur de documents.

---

## 4. CONFORMITÉ FISCALE GABONAISE (RÈGLES DGI)

L'application applique strictement la cascade fiscale gabonaise selon les formules suivantes :

1.  **Total Brut HT** = $\sum (\text{Quantité} \times \text{Prix Unitaire})$
2.  **Net HT** = $\text{Total Brut HT} - \text{Remise}$
3.  **CSS (Contribution Spéciale de Solidarité)** = \% \times \text{Net HT}$
4.  **Base de calcul TVA** = $\text{Net HT} + \text{CSS}$
5.  **TVA (Taxe sur la Valeur Ajoutée)** = 8\% \times \text{Base de calcul TVA}$
6.  **Net à Payer (TTC)** = $\text{Math.round}(\text{Net HT} + \text{CSS} + \text{TVA})$

*Note : Tous les montants sont arrondis à l'entier le plus proche (0 décimale) pour être conformes à l'usage du Franc CFA (XAF).*

---

## 5. NUMÉROTATION ET ÉTATS DE PAIEMENT

### Numérotation Chronologique
- **Format :** `Séquence/CodeEntreprise/Année` (ex: `001/GM/2025`).
- **Réinitialisation :** La séquence redémarre automatiquement à **001** le 1er janvier de chaque année.

### Suivi des Règlements
- **Statuts autorisés :** "Payée (100%)", "En attente", "Acompte", "Annulée (Avoir)".
- **Gestion des Acomptes :** Saisie dynamique du montant encaissé avec recalcul immédiat du reste à payer.
- **Modes de règlement :** Uniquement "Espèces", "Chèque" ou "Virement Bancaire".

---

## 6. MODULES INTERFACES (UI/UX) ET IMPRESSION NATIVE

### Dashboard Analytique
- **Données réelles :** Tous les compteurs (CA, volume de factures, impayés) sont dynamisés par des requêtes SQL réelles.
- **Filtrage :** Capacité de segmenter les statistiques par période : Mois, Trimestre ou Année.

### Design et Ergonomie
- **Sidebar :** Navigation fluide avec gestion précise du contraste au survol (hover) pour une lisibilité optimale.
- **Paramètres :** Organisation en 3 onglets (Tabs) :
    1. **Entreprise :** Identité légale, NIF, RCCM, Adresse.
    2. **Banque :** Coordonnées pour les virements.
    3. **Options :** Configuration métier (ex: Toggle délai de paiement réglementaire).

### Impression Native (Mode Electron)
- **Bannissement de window.print() :** Utilisation des API d'impression d'Electron pour un rendu "propre" (sans URL, sans date de navigateur).
- **Téléchargement :** Génération de PDF via `@react-pdf/renderer` avec ouverture du dialogue de sauvegarde Windows.
- **Styles d'impression (@media print) :**
    - Masquage automatique de la navigation et des boutons.
    - Inversion de couleurs : Fond blanc pur et texte noir (économie d'encre).
    - **Intégrité :** Utilisation de `page-break-inside: avoid` pour empêcher la coupure des tableaux de prestations ou des blocs de totaux.

---
