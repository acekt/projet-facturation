# ✦ L'ÉTOILE
## Application Desktop de Facturation & Gestion de Devis
### CAHIER DES CHARGES FONCTIONNEL ET TECHNIQUE

**Version :** 4.0.0-prod — Optimisée
**Date :** Mai 2026
**Cible :** PME & Prestataires de services — Marché Gabonais
**Déploiement :** Monoposte — 100 % Hors-ligne
**Conformité :** DGI Gabon — Cascade fiscale TVA/CSS/XAF

---

## 1. PRÉSENTATION GÉNÉRALE ET OBJECTIFS
L'Étoile est une application desktop fintech dédiée à la facturation et à la gestion de devis pour les PME et prestataires de services opérant sur le marché gabonais. Elle repose sur une architecture 100 % locale (monoposte, hors-ligne) et s'inspire des standards visuels de Linear, Stripe et Vercel pour offrir une expérience utilisateur premium.

- **Hors-ligne :** Aucune dépendance réseau : toutes les données restent sur la machine hôte.
- **Conformité :** Respect strict de la cascade fiscale DGI (TVA, CSS, XAF).
- **Règlements & Acomptes :** Suivi granulaire des paiements partiels avec calcul du solde restant dû.
- **Rôles :** Séparation nette entre administration système (Admin) et opérations métier (Utilisateur).
- **Traçabilité :** Cycle de vie documentaire tracé et infalsifiable, de la création du devis jusqu'à l'archivage de la facture.

---

## 2. ARCHITECTURE TECHNIQUE ET STACK
| Couche | Technologie | Rôle |
| :--- | :--- | :--- |
| **UI / Routing** | Next.js 16.2.6 + Turbopack | Rendu React côté client, navigation |
| **Runtime Desktop** | Electron.js | Encapsulation native Windows, IPC, impression |
| **Persistance** | SQLite via better-sqlite3 | Base de données locale, 100 % hors-ligne |
| **Langage** | TypeScript strict | Fiabilité, maintenabilité, auto-complétion |
| **État global** | Zustand | Synchronisation UI ↔ SQLite en temps réel |
| **PDF** | @react-pdf/renderer | Génération de documents PDF téléchargeables |
| **Paquets** | npm exclusivement | Pas de pnpm dans le workspace |

⚠️ **Toute utilisation de pnpm est proscrite dans le workspace. npm est l'unique gestionnaire de paquets autorisé.**

L'accès aux données SQLite est centralisé dans `lib/db.ts` et protégé par une couche de service (`proxy.ts`). Zustand synchronise l'état global React avec le backend SQLite en temps réel pour garantir la cohérence de l'interface sans rechargement de page.

---

## 3. GESTION DES RÔLES ET SÉCURITÉ

### 3.1 Philosophie de séparation des responsabilités
L'application distingue deux rôles fonctionnellement étanches. L'Admin est exclusivement chargé de la gestion des utilisateurs et de la configuration système. Il n'intervient pas dans le cycle de vie métier des documents. L'Utilisateur Standard (User) est le seul acteur du workflow métier : création, suivi, conversion et archivage des devis et factures.

| Capacité | Admin | Utilisateur Standard |
| :--- | :---: | :---: |
| Gestion des utilisateurs système | ✔ Total (CRUD) | ✘ |
| Réinitialisation mot de passe | ✔ | ✘ |
| Configuration entreprise & banque | ✔ | ✘ |
| Création / édition de devis | ✔ | ✔ |
| Conversion devis → facture | ✔ | ✔ |
| Mise à jour statut de paiement | ✔ | ✔ |
| Annulation de facture (avoir) | ✔ | ✔ |
| Gestion du catalogue de services | ✔ | ✔ |
| Consultation tableau de bord | ✔ | ✔ |
| Export PDF | ✔ | ✔ |
| Suppression de devis (brouillon) | ✔ | ✘ |
| Accès aux journaux d'audit | ✔ | ✘ |

### 3.2 Authentification et sécurité
- **Mots de passe :** Hachage des mots de passe en SHA-256 stocké localement dans SQLite.
- **Protection des routes :** Middleware Next.js interceptant chaque requête pour valider la session active.
- **Session :** Expiration de session configurable (délai d'inactivité paramétrable par l'Admin).
- **Audit :** Toute action sensible (création, conversion, annulation) est enregistrée dans un journal d'audit horodaté.

🔒 **Règle :** Un compte Admin ne peut pas être utilisé pour des opérations métier (création de devis, factures). Cette contrainte est enforced au niveau middleware.

---

## 4. GESTION ET SUIVI DES DEVIS

### 4.1 Cycle de vie et états d'un devis
Chaque devis passe par des états définis avec des transitions strictement contrôlées. L'interface affiche en permanence le statut courant sous forme de badge coloré.

| Statut | Code couleur | Description | Transitions autorisées |
| :--- | :--- | :--- | :--- |
| **Brouillon** | ⬤ Gris | En cours de saisie, non envoyé | → Soumis, → Supprimé |
| **Soumis** | ⬤ Bleu | Généré et remis au client | → Accepté, → Refusé, → Expiré |
| **Accepté** | ⬤ Vert | Client a donné son accord | → Converti en facture |
| **Refusé** | ⬤ Rouge | Client a décliné l'offre | → Archivé (lecture seule) |
| **Expiré** | ⬤ Orange | Délai de validité dépassé | → Relancé (nouveau devis), → Archivé |
| **Converti** | ⬤ Indigo | Facture générée depuis ce devis | Aucune (terminal) |
| **Archivé** | ⬤ Gris foncé | Hors workflow actif | Aucune (lecture seule) |

### 4.2 Création d'un devis
**Champs obligatoires**
- Client : sélection depuis le référentiel clients ou saisie manuelle (Nom, Adresse, NIF, RCCM si applicable).
- Date d'émission et date de validité (par défaut : +30 jours, configurable dans les Options).
- Numéro auto-généré au format Séquence/CodeEntreprise/Année (ex : 001/GM/2026).
- Au moins une ligne de prestation : sélection depuis le catalogue de services ou saisie libre.
- Chaque ligne inclut : Désignation, Quantité, Prix Unitaire HT, Taux de Remise (%) et Taux de CSS (%).

**Comportement de l'éditeur**
- Recalcul fiscal en temps réel à chaque modification de ligne (voir Section 6).
- Ajout / suppression de lignes dynamique sans rechargement de page.
- Sélection de services depuis la table `services` via liste déroulante avec filtrage par texte.
- Champ 'Mentions légales / Conditions' : bloc de texte libre pré-rempli depuis les paramètres entreprise.
- Action unique : bouton 'Générer le devis' — aucun bouton 'Brouillon' ni 'Dupliquer'.

### 4.3 Tableau de bord des devis
L'écran de liste des devis est la vue centrale de suivi. Il offre les capacités suivantes :

**Filtres et recherche**
- Recherche full-text sur numéro de devis, nom du client, désignation de prestation.
- Filtres combinables : Statut, Période (Mois / Trimestre / Année), Utilisateur créateur.
- Tri par colonne : Date, Montant TTC, Statut, Client.
- Indicateur visuel de proximité d'expiration : badge 'Expire dans X jours' affiché à moins de 7 jours de la date de validité.

**Colonnes affichées**
- N° Devis — Client — Date d'émission — Validité — Montant TTC — Statut — Actions

**Actions disponibles par ligne**
- Consulter (lecture seule) — Générer PDF — Convertir en facture (si statut Accepté) — Marquer Refusé / Expiré — Archiver.

### 4.4 Notifications et alertes de suivi
- Expiration proche : Alerte J-7 : badge orange sur les devis dont la date de validité est à moins de 7 jours.
- Compteur dashboard : Compteur 'Devis en attente' visible sur le tableau de bord et dans la sidebar.
- Journal de statut : Historique complet des changements de statut enregistré (qui, quand, depuis quel état, vers quel état).

### 4.5 Règles de suppression
🔒 **Règle :** Seul un devis au statut Brouillon peut être supprimé, et uniquement par un Admin.
🔒 **Règle :** Un devis Soumis, Accepté ou Converti est en lecture seule et non supprimable. Il peut uniquement être Archivé.

---

## 5. GESTION ET SUIVI DES FACTURES

### 5.1 Règle fondamentale de création
🔒 **Règle :** Une facture ne peut jamais être créée ex nihilo. Elle naît EXCLUSIVEMENT de la conversion d'un devis au statut Accepté. Toute tentative de création directe est bloquée au niveau UI et API.

### 5.2 Cycle de vie et états d'une facture
| Statut | Code couleur | Description | Transitions autorisées |
| :--- | :--- | :--- | :--- |
| **Émise** | ⬤ Bleu | Facture créée, non encore réglée | → Acompte, → Payée, → Annulée |
| **Acompte** | ⬤ Orange | Paiement partiel enregistré | → Payée (solde), → Annulée |
| **Payée** | ⬤ Vert | Règlement total confirmé | Aucune (terminal) |
| **En retard** | ⬤ Rouge | Échéance dépassée, solde restant | → Acompte, → Payée, → Annulée |
| **Annulée (Avoir)** | ⬤ Gris | Avoir émis, facture neutralisée | Aucune (terminal) |

### 5.3 Conversion devis → facture (Facture Miroir)
- La conversion génère une copie intégrale et figée du devis : lignes, quantités, prix unitaires, remises, CSS, TVA.
- Le numéro de facture est auto-généré au même format chronologique que les devis.
- La facture générée est immédiatement en statut Émise.
- Le devis source passe au statut Converti (terminal) et n'est plus modifiable.
- Un lien de référence croisée est enregistré : la facture référence son devis d'origine, et vice-versa.
🔒 **Règle :** Aucune modification des lignes de la facture n'est possible après création. L'intégrité comptable est absolue.

### 5.4 Tableau de bord des factures
**Filtres et recherche**
- Recherche full-text sur numéro de facture, numéro de devis source, client, prestation.
- Filtres : Statut (Émise, Acompte, Payée, En retard, Annulée), Période, Mode de règlement, Utilisateur.
- Tri par colonne : Date d'émission, Échéance, Montant TTC, Reste à payer, Statut.

**Colonnes affichées**
- N° Facture — Devis source — Client — Date d'émission — Échéance — Montant TTC — Réglé — Reste — Statut — Actions

**Indicateurs visuels critiques**
- Retard : Badge 'En retard' rouge sur les factures dont l'échéance est dépassée et le solde non nul.
- Impayés : Compteur 'Impayés' (total XAF) affiché en en-tête du tableau et sur le dashboard.
- Progression : Barre de progression de règlement (montant encaissé vs TTC) sur la vue détail.

### 5.5 Gestion des règlements
| Mode de règlement | Référence requise | Justificatif accepté | Délai de confirmation |
| :--- | :--- | :--- | :--- |
| **Espèces** | N° de reçu interne | Reçu signé | Immédiat |
| **Chèque** | N° de chèque + Banque | Scan chèque (optionnel) | À l'encaissement |
| **Virement Bancaire** | Référence virement | Avis de crédit | 24 – 72 h |

**Règles de saisie**
- Le montant encaissé ne peut pas dépasser le reste à payer.
- La date de règlement est obligatoire et ne peut pas être antérieure à la date d'émission de la facture.
- Le recalcul du reste à payer est immédiat après validation.
- Si le règlement solde la facture (reste = 0), le statut passe automatiquement à Payée.
- Chaque règlement génère une entrée dans le journal d'audit : montant, mode, date, utilisateur.

### 5.6 Gestion des retards et relances
- Détection automatique : Basculement automatique vers le statut En retard à J+1 de l'échéance si solde > 0.
- Dashboard : Compteur d'impayés en temps réel sur le dashboard (total XAF, nombre de factures).
- Filtre rapide : Filtrage rapide 'Afficher les retards uniquement' depuis le tableau des factures.
- Journal de relance : Historique des tentatives de relance enregistrable manuellement (date, canal, commentaire libre).

### 5.7 Annulation et gestion des avoirs
- L'annulation crée un avoir lié à la facture originale. Les deux documents restent visibles et traçables.
- Une facture Payée ne peut pas être annulée. Elle peut uniquement faire l'objet d'un remboursement documenté via un avoir manuel.
- Le motif d'annulation est obligatoire et stocké dans le journal d'audit.
🔒 **Règle :** Il est interdit de supprimer une facture. L'annulation via avoir est le seul mécanisme de neutralisation.

---

## 6. CONFORMITÉ FISCALE GABONAISE (RÈGLES DGI)

### 6.1 Cascade de calcul
| # | Composante | Formule | Exemple (base 100 000 XAF) |
| :--- | :--- | :--- | :--- |
| 1 | **Total Brut HT** | Σ (Qté × Prix Unitaire) | 100 000 XAF |
| 2 | **Net HT** | Total Brut HT − Remise | 95 000 XAF (remise 5%) |
| 3 | **CSS** | % CSS × Net HT | 950 XAF (CSS 1%) |
| 4 | **Base TVA** | Net HT + CSS | 95 950 XAF |
| 5 | **TVA** | 18% × Base TVA | 17 271 XAF |
| 6 | **Net à Payer (TTC)** | Math.round(Net HT + CSS + TVA) | 113 221 XAF |

⚠️ **Tous les montants sont arrondis à l'entier le plus proche (Math.round). Aucune décimale n'apparaît sur les documents imprimés ou à l'écran, conformément à l'usage du Franc CFA (XAF).**

### 6.4 Gestion des Acomptes
- Une facture peut faire l'objet de plusieurs règlements successifs.
- Le document (aperçu et impression) doit afficher dynamiquement :
    - **TOTAL TTC** : Montant initial de la facture.
    - **Montant déjà réglé** : Somme cumulée des paiements validés.
    - **RESTE À PAYER** : Solde débiteur à la date du jour.

### 6.2 Taux et paramètres
- TVA : 18 % (taux standard gabonais) — non modifiable par l'utilisateur.
- CSS : taux variable configurable par l'Admin dans les Paramètres (Options). La valeur par défaut est 1 %.
- Remise : taux libre par ligne (0 % à 100 %), appliquée avant calcul de la CSS et de la TVA.
🔒 **Règle :** Le taux de TVA (18 %) est une constante système. Sa modification requiert une mise à jour applicative.

### 6.3 Numérotation chronologique
- Format : Séquence/CodeEntreprise/Année — ex : 001/GM/2026.
- La séquence s'incrémente de manière indépendante pour les devis et pour les factures.
- Réinitialisation automatique à 001 le 1er janvier de chaque année.
- Le code entreprise est configurable dans les Paramètres (onglet Entreprise).
🔒 **Règle :** La numérotation est séquentielle et sans trou. Toute annulation préserve le numéro (la facture reste visible, statut Annulée).

---

## 7. CATALOGUE DE SERVICES

### 7.1 Structure de la table `services`
- Champs : ID, Désignation, Description (optionnel), Prix Unitaire HT par défaut, Taux CSS par défaut, Actif (booléen).
- Un service désactivé (Actif = false) n'apparaît plus dans les listes déroulantes mais reste en base pour l'historique.

### 7.2 Utilisation dans les documents
- Sélection via liste déroulante filtrée par frappe dans l'éditeur de devis.
- À la sélection d'un service, les champs Prix Unitaire HT et CSS sont pré-remplis avec les valeurs par défaut du catalogue.
- Les valeurs pré-remplies sont modifiables ligne par ligne sans affecter le catalogue.

---

## 8. TABLEAU DE BORD ANALYTIQUE

### 8.1 KPI affichés
- Chiffre d'Affaires TTC (période sélectionnée) — requête SQL temps réel.
- Nombre de factures émises, payées, en retard — compteurs dynamiques.
- Total impayés (XAF) — somme des restes à payer sur factures non soldées.
- Nombre de devis en attente (statut Soumis) et taux de conversion devis → facture.
- Top 5 clients par CA sur la période.

### 8.2 Filtrage temporel
- Segmentation par Mois, Trimestre ou Année via sélecteur en en-tête du dashboard.
- Toutes les requêtes SQL embarquent la clause WHERE sur la période sélectionnée.

### 8.3 Journal d'audit
- Accessible uniquement par l'Admin.
- Enregistre : horodatage UTC, utilisateur, type d'action, identifiant du document, état avant / après.
- Filtrable par utilisateur, type d'action et période. Exportable en CSV.

---

## 9. PARAMÈTRES (ADMIN UNIQUEMENT)

### 9.1 Onglet Entreprise
- Raison sociale, Forme juridique, NIF, RCCM, Adresse complète, Téléphone, Email.
- Code entreprise (utilisé dans la numérotation des documents).
- Logo (fichier image local, affiché sur les PDF générés).
- Mentions légales / Conditions de paiement par défaut (pré-remplissage éditeur de devis).

### 9.2 Onglet Banque
- Nom de la banque, Agence, N° de compte, Code SWIFT/BIC, IBAN (si applicable).
- Ces informations sont affichées sur les factures pour les règlements par virement.

### 9.3 Onglet Options
- Taux CSS par défaut (%).
- Délai de paiement réglementaire par défaut (toggle + saisie en jours, ex : 30 / 45 / 60 jours).
- Délai de validité par défaut des devis (jours).
- Expiration de session (minutes d'inactivité avant déconnexion).

---

## 10. IMPRESSION ET EXPORT PDF

### 10.1 Moteur d'impression
- Impression directe : Utilisation des API d'impression natives Electron — window.print() banni.
- Rendu propre : Pas d'URL de navigateur ni de date de navigateur sur le document imprimé.
- Export PDF : Génération via @react-pdf/renderer avec ouverture du dialogue de sauvegarde Windows natif.

### 10.2 Styles d'impression
- Masquage de la sidebar, des boutons d'action et de la barre de navigation (@media print).
- Inversion de couleurs : fond blanc pur, texte noir pour économie d'encre.
- page-break-inside: avoid appliqué sur les tableaux de prestations et les blocs de totaux.
- Logo entreprise et coordonnées affichés en en-tête de chaque page.
- Pied de page : mention 'Page X / Y', numéro de document, date d'impression.

### 10.3 Contenu du document PDF
**En-tête**
- Logo + Raison sociale + NIF + RCCM + Adresse + Téléphone + Email.
- Type de document (DEVIS / FACTURE) + Numéro + Date d'émission + Date de validité ou Échéance.

**Corps**
- Tableau des prestations : Désignation, Qté, Prix Unitaire HT, Remise (%), Montant HT.
- Bloc de totaux : Total Brut HT, Remise globale, Net HT, CSS, Base TVA, TVA, Net à Payer TTC.
- Mode de règlement acceptés + Coordonnées bancaires (si virement).

**Pied**
- Mentions légales et conditions de paiement.
- Signature et cachet de l'entreprise (espace réservé sur le PDF).

L'Étoile · CDCFT v2.0 · Confidentiel · Mai 2026
