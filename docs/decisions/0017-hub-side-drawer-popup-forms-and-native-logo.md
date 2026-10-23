# ADR-0017: Formulaires Popup en Tiroir Latéral (Side Sheet) et Intégration du Vrai Logo Desktop dans le Hub

## Status

Accepted

## Scope

- Area: Hub Web Super Admin & Client Desktop / Ergonomie des Formulaires Modaux / Identité Visuelle et Logo / Tokens Design Système
- Library or platform: Radix UI Dialog & Sheet (`packages/ui/src/components/sheet.tsx`, `packages/ui/src/components/dialog.tsx`), Next.js 16 Image component
- Installed version: next 16.4.0, react 19.3.0, @radix-ui/react-dialog 1.1.15
- Related files: `packages/ui/src/components/sheet.tsx`, `packages/ui/src/components/dialog.tsx`, `apps/web-hub/src/components/admin/tenants-table.tsx`, `apps/web-hub/src/components/admin/tenant-360-view.tsx`, `apps/web-hub/src/components/admin/licences-management-view.tsx`, `apps/web-hub/src/components/admin/announcements-alerts-view.tsx`, `apps/web-hub/src/components/admin/collapsible-sidebar.tsx`, `apps/web-hub/src/components/admin/mobile-nav.tsx`, `apps/web-hub/src/app/login/page.tsx`

## Documentation Source

- Context7 source: `/shadcn/ui` (Sheet primitive, Radix Dialog side drawer pattern, right-side slide-over form ergonomics)
- Official fallback source: Radix UI Dialog Primitives documentation
- Date checked: 2026-10-21

## Context

Deux exigences ergonomiques et de marque ont été formulées pour le Hub Super Admin :
1. **Positionnement Latéral des Formulaires Popup (Slide-Over / Side Sheet)** :
   - Au lieu de boîtes de dialogue flottantes centrées qui occultent le contexte de la table sous-jacente, les formulaires d'action (Création de tenant, Suspension, Bris de glace, Prolongation de licence, Création de plan SaaS, Diffusion d'annonce) doivent s'ouvrir sur le côté droit de l'écran sous forme de tiroir pleine hauteur (`side="right"`), avec fond assombri, en-tête structuré (icône thématique + titre + description), corps défilant et barre d'actions sticky au bas.
   - Les champs, validations et fonctionnalités métier doivent être intégralement préservés.
   - Les couleurs doivent rigoureusement respecter les tokens du design système institutionnel (Bleu `#003399` en bouton primaire, pas de vert).
2. **Harmonisation de l'Identité Visuelle (Remplacement du Logo Fictif)** :
   - Le Hub affichait un logo fictif (icône `<Layers>` ou lettre « H ») dans la sidebar, la barre mobile et la page de connexion.
   - Le véritable logo officiel de l'application (`/logo.png`), déjà utilisé sur le client desktop, doit être intégré de manière uniforme dans l'ensemble des points d'entrée du Hub.

## Decision

1. **Composant Side Sheet et Support `side="right"` dans `@workspace/ui`** :
   - Création de `packages/ui/src/components/sheet.tsx` basé sur les primitives Radix avec variantes de transition glissante (`slide-in-from-right`, `slide-out-to-right`).
   - Extension de `DialogContent` dans `packages/ui/src/components/dialog.tsx` pour supporter nativement `side="right"`, garantissant la rétrocompatibilité et le basculement aisé de tous les formulaires.
2. **Transformation des Formulaires Modaux en Tiroirs Latéraux** :
   - Mise à niveau de tous les formulaires du Hub (`tenants-table.tsx`, `tenant-360-view.tsx`, `licences-management-view.tsx`, `announcements-alerts-view.tsx`) vers la disposition latérale droite avec labels majuscules espacés (`text-[11px] font-bold text-foreground uppercase tracking-wider`).
   - Application stricte des couleurs du design système : boutons d'action en `bg-primary hover:bg-primary-hover` (Bleu institutionnel) et actions destructives en `bg-destructive`, éliminant tout usage injustifié du vert pour les boutons de validation.
3. **Intégration du Vrai Logo Desktop (`/logo.png`)** :
   - Remplacement des icônes génériques par le composant Next.js `<Image src="/logo.png" ... />` dans la barre latérale rétractable, la navigation mobile et la page d'authentification Super Admin.

## Alternatives Considered

- Forcer un composant modal tiers lourd : Rejeté pour éviter d'augmenter le bundle Turbopack alors que `@radix-ui/react-dialog` gère déjà l'accessibilité ARIA, le piégeage du focus et le défilement.
- Conserver le vert émeraude de la capture d'inspiration : Rejeté suite à l'instruction formelle de l'utilisateur de proscrire le vert et d'appliquer les couleurs de la charte fintech institutionnelle.

## Risks

- Débordement vertical sur petits écrans : Mitigé en configurant le corps du tiroir en `flex-1 overflow-y-auto` avec un conteneur d'actions fixé au bas (`shrink-0 border-t`).

## Verification

- Command: `npm run quality:decisions`, `npm run test` et `npm run typecheck` dans `apps/web-hub` et `apps/desktop`.
- Test: 48 tests Vitest validés à 100%, 0 erreur TypeScript.
- Manual check: Vérification visuelle sur `http://localhost:3001` du glissement fluide des tiroirs latéraux et du rendu net du logo.
