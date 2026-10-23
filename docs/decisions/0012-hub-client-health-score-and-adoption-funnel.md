# ADR-0012: Modèle d'Adoption SaaS, Funnel d'Activation et Health Score Prédictif

## Status

Accepted

## Scope

- Area: Hub Web / Adoption SaaS / Funnel d'Activation / Scoring Santé Client / Détection du Churn
- Library or platform: Next.js 16, Supabase SSR, Recharts 2.15, Vitest 4
- Installed version: next 16.4.0, @supabase/ssr 0.12.7, recharts 2.15.0, vitest 4.1.11
- Related files: `apps/web-hub/src/app/admin/adoption/page.tsx`, `apps/web-hub/src/lib/kpi/adoptionQueries.ts`, `apps/web-hub/src/components/admin/adoption-funnel-view.tsx`, `apps/web-hub/tests/adoption-health.test.ts`

## Documentation Source

- Context7 source: `/vitest-dev/vitest` (Testing scoring algorithms and conversion rates), Next.js 16 Server Components architecture
- Official fallback source: Documentation Supabase & Vitest
- Date checked: 2026-10-21

## Context

Dans un modèle SaaS B2B Local-First avec abonnement mensuel/annuel, l'acquisition de nouveaux tenants ne suffit pas pour assurer la pérennité financière. Le Super Admin doit disposer d'une visibilité instantanée sur :
1. **L'efficacité du funnel d'onboarding** : Mesure du taux de conversion entre l'inscription de l'entreprise, le premier appairage d'un poste Desktop SQLite, la création de la première facture et la réception du premier paiement effectif.
2. **L'état de santé opérationnel (Health Score de 0 à 100)** : Algorithme multi-critères prédictif permettant d'anticiper le désengagement (churn) bien avant l'expiration de la licence ou de l'essai.
3. **L'adoption des fonctionnalités avancées** : Multi-postes, devis préalables, avoirs et exports comptables.

## Decision

1. **Algorithme composite de Health Score (0 à 100 points)** :
   - **Activité & Fraîcheur de synchronisation (30 points)** :
     * Synchronisation < 24h : 30 pts
     * Synchronisation entre 24h et 7j : 15 pts
     * Synchronisation > 7j : 0 pt
   - **Volume d'usage et facturation (25 points)** :
     * Plus de 5 factures sur 30 jours : 25 pts
     * 1 à 4 factures : 15 pts
     * 0 facture : 0 pt
   - **Fiabilité technique de la réplication (25 points)** :
     * Taux de succès sync >= 95% : 25 pts
     * Taux de succès entre 80% et 94% : 15 pts
     * Taux de succès < 80% ou zéro cycle : 5 pts
   - **Performance financière & recouvrement (20 points)** :
     * Taux de recouvrement >= 80% : 20 pts
     * Taux de recouvrement entre 50% et 79% : 10 pts
     * Taux < 50% : 0 pt
   - **Segmentation** :
     * `Champion` (80-100 pts) : Entreprise modèle, forte valeur.
     * `Stable` (60-79 pts) : Utilisation régulière et saine.
     * `À Surveiller` (40-59 pts) : Risque naissant de délaissement.
     * `Critique / Risque de Churn` (0-39 pts) : Action proactive immédiate requise.

2. **Pipeline d'Adoption & Funnel d'Activation** :
   - Étape 1 : *Entreprises Créées* (Total tenants).
   - Étape 2 : *Poste Desktop Appairé* (Au moins un `sync_device` enregistré).
   - Étape 3 : *Premier Document Émis* (Au moins une facture ou un devis créé).
   - Étape 4 : *Premier Encaissement Réalisé* (Au moins un paiement enregistré).
   - Calcul des taux d'abandon (drop-off) à chaque étape du funnel.

3. **Radar de Rétention & Détection de Churn** :
   - Liste dédiée des entreprises en danger (score < 50 ou inactives depuis plus de 14 jours).
   - Raccourcis d'action : accès direct à la fiche 360°, historique des incidents, et notes de suivi.

## Alternatives Considered

- Calculer le score via un trigger PostgreSQL en temps réel à chaque écriture : rejeté pour ne pas surcharger la base de données transactionnelle de facturation ; le score est calculé à la volée côté serveur dans le DAL avec mise en cache Next.js.
- Utiliser un système de scoring externe tiers (ex: Mixpanel/Amplitude) : rejeté par souci de souveraineté des données financières et respect de la vie privée des clients B2B.

## Risks

- Des tenants nouvellement créés pourraient être marqués abusivement à risque élevé : atténué en accordant un statut de grâce aux comptes créés il y a moins de 7 jours.

## Verification

- Command: `npm run quality:decisions`
- Test: Validation de l'algorithme de scoring et des conversions de funnel dans `apps/web-hub/tests/adoption-health.test.ts`
- Manual check: Consultation de la page `/admin/adoption` et filtrage des tenants à risque
