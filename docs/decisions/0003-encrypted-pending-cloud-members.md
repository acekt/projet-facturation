# ADR-0003: Chiffrement AES-256-GCM des mots de passe en file Cloud

## Status

Accepted

## Scope

- Area: Sécurité locale / synchronisation Desktop -> Supabase
- Library or platform: Node.js `crypto` (natif), SQLite
- Installed version: Node.js 24
- Related files: `apps/desktop/lib/crypto/secretStore.ts`, `apps/desktop/lib/sync/cloudMembers.ts`, `apps/desktop/app/actions/user.actions.ts`, `apps/desktop/app/actions/auth.actions.ts`

## Documentation Source

- Context7 source: non requis (API native Node `crypto`)
- Official fallback source: https://nodejs.org/api/crypto.html (aes-256-gcm)
- Date checked: 2026-10-20

## Context

`pending_cloud_members` conserve le mot de passe temporaire d'un membre créé hors-ligne jusqu'à la création du compte Supabase. Il était stocké en clair dans SQLite.

## Decision

Chiffrer avec AES-256-GCM (IV aléatoire 12 octets, tag d'authentification), clé = SHA-256 dérivé de `SESSION_SECRET`. Format `enc:v1:iv:tag:data`. Déchiffrement uniquement dans `processPendingMembers`. Les anciennes lignes en clair restent lisibles (rétro-compatibilité).

## Alternatives Considered

- Hash bcrypt du mot de passe : impossible, Supabase `signUp` exige le mot de passe clair.
- Invitation par email / magic link : hors périmètre offline-first.

## Risks

- Risk: Changement de `SESSION_SECRET` rend les lignes en file indéchiffrables.
- Mitigation: l'erreur est consignée dans `last_error`; recréer le membre ré-enfile un mot de passe valide.

## Verification

- Command: `npm test tests/unit/cloud-members-crypto.test.ts`
- Test: aller-retour, altération rejetée, absence de clair en base
- Manual check: `SELECT password FROM pending_cloud_members` ne montre que `enc:v1:...`
