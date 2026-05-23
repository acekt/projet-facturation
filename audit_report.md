# Audit Logiciel : Gestion de Devis & Facturation PME Gabon

## 1. Diagnostic de l'État Actuel

### Ce qui fonctionne (Le Socle Robuste)
- **Architecture de Données :** L'utilisation de SQLite avec `better-sqlite3` offre une persistance fiable et performante pour une application de bureau/locale. Les migrations de schéma sont gérées proprement.
- **Conformité Fiscale :** Le calcul en cascade (CSS 1% puis TVA 18%) est implémenté avec un arrondi à zéro décimale, respectant la norme FCFA/XAF.
- **Workflow Métier :** Le cycle "Devis -> Facture" est strictement appliqué, empêchant la création de factures orphelines et garantissant la traçabilité.
- **Sécurité :** Authentification active via Middleware Next.js et hachage des mots de passe (SHA-256).
- **Numérotation :** Système de séquençage intelligent par année (`001/CODE/2025`) avec réinitialisation automatique au 1er Janvier.

### Ce qui est "Fragile" / Points de Vigilance
- **Absence de Logs d'Audit :** Bien que les suppressions soient "douces" (soft delete), il n'y a pas de trace des modifications manuelles sur les devis ou des changements de statuts.
- **Gestion des Erreurs :** Les retours API sont parfois génériques (`Erreur serveur`). Une gestion plus fine des exceptions permettrait une meilleure résilience.
- **Concurrence :** SQLite est excellent en lecture, mais une montée en charge avec plusieurs utilisateurs modifiant des données simultanément pourrait atteindre les limites de verrouillage de la base.
- **Sauvegarde :** Aucun mécanisme d'export de la base de données ou de sauvegarde automatisée n'est actuellement en place.

---

## 2. Le "Missing Link" (Priorités Techniques & Métier)

### Priorité Haute (Immédiat)
1. **Export Comptable :** Génération de fichiers CSV/Excel formatés pour les logiciels de comptabilité (ex: Sage, Odoo) pour faciliter le travail du comptable en fin de mois.
2. **Tableau des Flux de Trésorerie :** Vue consolidée des encaissements réels (via la table `payments`) vs CA facturé.

### Priorité Moyenne (Évolution)
3. **Gestion des Acomptes :** Possibilité de lier plusieurs factures d'acompte à un seul devis.
4. **Logs d'Audit Applicatifs :** Table `audit_logs` pour enregistrer qui a fait quoi et quand (crucial pour la conformité).

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
