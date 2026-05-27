# Audit Logiciel : Gestion de Devis & Facturation PME Gabon

## 1. Diagnostic de l'État Actuel

### Ce qui fonctionne (Le Socle Robuste)
- **Architecture de Données :** L'utilisation de SQLite avec `better-sqlite3` offre une persistance fiable et performante pour une application de bureau/locale. Les migrations de schéma sont gérées proprement.
- **Conformité Fiscale :** Le calcul en cascade (CSS 1% puis TVA 18%) est implémenté avec un arrondi à zéro décimale, respectant la norme FCFA/XAF.
- **Workflow Métier :** Le cycle "Devis -> Facture" est strictement appliqué, empêchant la création de factures orphelines et garantissant la traçabilité.
- **Sécurité :** Authentification active via Middleware Next.js et hachage des mots de passe (SHA-256).
- **Numérotation :** Système de séquençage intelligent par année (`001/CODE/2025`) avec réinitialisation automatique au 1er Janvier.

### Ce qui est "Fragile" / Points de Vigilance
- **Concurrence :** SQLite est excellent en lecture, mais une montée en charge avec plusieurs utilisateurs distants modifiant des données simultanément pourrait atteindre les limites de verrouillage (non critique pour un usage monoposte).
- **Sauvegarde :** Aucun mécanisme de sauvegarde automatisée sur le Cloud ou support externe n'est actuellement en place.

---

## 2. Réalisations Post-Audit (Stabilisation & Conformité)

### 2.1 Sécurité & Gouvernance (RBAC)
- **Étanchéité des Rôles :** Séparation stricte entre le compte `Admin` (paramétrage, audit) et le compte `User` (opérations métier). L'Admin ne peut pas polluer les données comptables.
- **Journal d'Audit :** Implémentation d'une table `audit_logs` traçant chaque création, modification et suppression (qui, quoi, quand).

### 2.2 Intelligence Métier & Fiscalité
- **Cascade DGI Certifiée :** Calcul HT -> CSS 1% -> Base TVA -> TVA 18% -> TTC arrondi à l'entier.
- **Gestion des Acomptes :** Possibilité d'encaisser des règlements partiels avec mise à jour du statut (Acompte / Payée) et affichage du "Reste à payer" sur les factures.
- **Numérotation Annuelle :** Réinitialisation automatique du séquençage au 1er Janvier (`001/.../2026`).

### 2.3 UX & Export
- **Export Comptable :** Bouton d'export CSV intégré sur les listes Clients et Factures.
- **Prévisualisation Réaliste :** Templates PDF et styles d'impression optimisés pour les formats A4 (DGI standard).

---

## 3. Roadmap en 3 Phases

### Phase 1 : Stabilisation & Transparence (Cœur)
- Implémentation du système de Logs d'Audit.
- Amélioration de la gestion des erreurs et validation des entrées (Zod renforcé).
- Mise en place d'un outil d'export/sauvegarde de la base SQLite.

### Phase 2 : Modules Métiers Avancés (Expansion)
- Module de gestion des avoirs (Credit Notes) - *Initialisé mais à finaliser*.
- Gestion des acomptes et paiements partiels.
- Personnalisation avancée des templates PDF (mentions spécifiques par secteur).

### Phase 3 : Optimisation & Scalabilité (Marché)
- Migration vers PostgreSQL (optionnel, si déploiement Cloud multisite).
- Tableaux de bord analytiques (Evolution CA, Top Clients).
- Préparation à l'interfaçage avec la DGI (E-facture).

---

## Action Immédiate
**La toute première chose à faire :** Implémenter le module d'exportation des données (Clients, Factures, Paiements) en format CSV/Excel. C'est le lien critique qui manque pour que le logiciel soit réellement utile à un gérant de PME gabonaise pour sa clôture comptable.
