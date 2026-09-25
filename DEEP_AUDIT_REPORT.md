# 🚨 DEEP AUDIT REPORT - FACTURIER APP 🚨

## ANALYSE ARCHITECTURALE ET QUALITÉ DE CODE

En tant que Lead QA Engineer, j'ai audité le projet Facturier en m'assurant que la qualité, la sécurité et l'architecture répondent aux plus hauts standards. La médiocrité n'a pas sa place ici. Le code source n'a pas été altéré pendant l'audit, mais voici le diagnostic détaillé et intransigeant.

---

### 1. QUALITÉ DU CODE STATIQUE ET TYPAGE (TYPESCRIPT)

**⚠️ DANGER : Utilisation de `any` et Contournement du Typage**
Le recours à `any` ruine la sécurité de type offerte par TypeScript, ouvrant la porte à des erreurs au runtime impossibles à détecter à la compilation.

*   **Fichier :** `app/page.tsx`
*   **Ligne :** `25`
*   **Problème :** Cast explicite avec `as any` sur un retour de requête base de données (`const user = db.prepare(...).get(...) as any`).
*   **Refactorisation exigée :** Utiliser les types générés (par ex. `DbUser`) pour valider la sortie.
    ```typescript
    import type { DbUser } from '@/lib/types/api';
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.userId) as DbUser | undefined;
    ```

*   **Fichier :** `app/api/settings/route.ts`
*   **Ligne :** `102` et `119`
*   **Problème :** Catch d'erreurs en utilisant `any` (`} catch (dbError: any) {`). C'est un anti-pattern TypeScript critique.
*   **Refactorisation exigée :** Utiliser `unknown` et vérifier le type (Narrowing).
    ```typescript
    } catch (dbError: unknown) {
      if (dbError instanceof Error) {
        // Traitement sécurisé
      }
    }
    ```

---

### 2. LOGIQUE REACT ET ANTI-PATTERNS UI

**⚠️ DANGER : Hooks Dangereux et "Ghost Data"**

*   **Fichier :** `components/pages/invoice-editor.tsx`
*   **Ligne :** `103` (Dépendances du `useEffect` pour le nettoyage/initialisation)
*   **Problème :** L'objet asynchrone `settings.mentionsLegales` est inclus dans le tableau de dépendances du `useEffect` qui initialise et réinitialise le brouillon local. Lorsque les paramètres finissent de charger (hydration), le hook est redéclenché, effaçant silencieusement la saisie en cours de l'utilisateur.
*   **Refactorisation exigée :** Retirer `settings.mentionsLegales` du tableau de dépendances ou structurer l'initialisation pour qu'elle ne se déclenche qu'au premier montage valide de l'éditeur en mode "New".
    ```typescript
    React.useEffect(() => {
      // ... setup
      if (isNew) {
        clearInvoiceDraft();
        setLocalDraft(blankDraft);
      }
      return () => {
        // cleanup
      };
    }, [isNew, clearInvoiceDraft]); // Retrait explicite de settings.mentionsLegales
    ```

**⚠️ MÉDIOCRITÉ : Gestion Silencieuse des Erreurs (Ignorance Délibérée)**

*   **Fichier :** `components/data-sync.tsx`
*   **Ligne :** `58`
*   **Problème :** Au sein de `Promise.allSettled`, les rejets d'API (fetch network errors) sont silencieusement catchés (`.catch(() => null)`). L'utilisateur n'a aucun retour visuel si l'une des requêtes de synchronisation (ex: paramètres, factures) échoue, ce qui laisse l'application dans un état partiellement synchronisé.
*   **Refactorisation exigée :** Remonter les erreurs individuelles ou marquer les états comme invalides pour prévenir l'utilisateur de l'échec de synchronisation spécifique.

---

### 3. ARCHITECTURE ELECTRON ET IPC SÉCURITÉ

**⚠️ DANGER : IPC Types et Gestion d'Erreur Faible**

*   **Fichier :** `components/fullscreen-document-viewer.tsx`
*   **Ligne :** `165`
*   **Problème :** La gestion de l'appel IPC `window.electron.exportPDF` catch avec `any` (`} catch (err: any) {`). De plus, contrairement à `lib/electron-print.ts`, il ne filtre pas activement l'annulation de la boîte de dialogue utilisateur, ce qui peut potentiellement déclencher de faux toasts d'erreur.
*   **Refactorisation exigée :** Filtrer l'erreur `unknown` et ignorer l'action d'annulation bénigne du système d'exploitation.
    ```typescript
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (!errorMsg.toLowerCase().includes('cancel') && !errorMsg.toLowerCase().includes('annul')) {
        toast.error(`Échec critique de l'export: ${errorMsg}`);
      }
    }
    ```

---

### 4. BASE DE DONNÉES ET PERFORMANCES (SQLITE)

**⚠️ DANGER : SQLITE_BUSY & Anti-pattern de Compilation Dynamique**

*   **Fichiers :** `app/api/settings/route.ts` (Ligne 22), `app/api/services/route.ts` (Ligne 28), et virtuellement tous les route handlers.
*   **Problème :** SQLite via `better-sqlite3` compile la requête via `db.prepare(...)` *à l'intérieur* de la fonction du handler à chaque appel HTTP. Cela consomme des ressources CPU inutilement et sature le lock de la DB lors de charges simultanées, favorisant les erreurs `SQLITE_BUSY`.
*   **Refactorisation exigée :** "Hoister" les requêtes préparées (les déclarer au niveau du module) pour qu'elles ne soient compilées qu'une seule fois au démarrage.
    ```typescript
    // En dehors de la fonction GET/POST (Niveau du module)
    const getSettingsStmt = db.prepare('SELECT * FROM settings WHERE id = 1');

    export async function GET() {
      // À l'intérieur du handler
      const settings = getSettingsStmt.get() as DbSettings | undefined;
      // ...
    }
    ```

---
**STATUT FINAL :** Rapport généré avec succès. Les équipes doivent implémenter ces correctifs pour garantir la pérennité du produit.
