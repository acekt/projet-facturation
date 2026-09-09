# ARCHITECTURE ET ÉTAT AUDIT - Facturier

## 1. Hydratation du Store et Optimisation de la Coquille Applicative

- **Composant concerné:** `components/pages/protected-app-shell.tsx` & `components/data-sync.tsx`
- **Analyse des goulots d'étranglement:**
  L'application est chargée de multiples entités asynchrones au démarrage (Clients, Paramètres, Devis, etc). `DataSync` utilise avec succès `Promise.allSettled` pour requêter ces données en parallèle.
  L'interface de l'application est bloquée par un joli *loading spinner* à états variables via `framer-motion` (`AnimatePresence`) empêchant d'entrer dans l'application avec un état inconsistant. L'UX est complété par un léger timeout paramétré à `600ms` sur le hook `setIsDataLoaded`, empêchant ainsi tout clignotement ou "flicker" de la vue lorsque la requête API locale en environnement desktop s'exécute beaucoup trop rapidement.
- **Verdict:** La coquille applicative était déjà structurellement sécurisée et son *spinner* très performant et agréable. Aucune ré-ingénierie visuelle n'a été jugée nécessaire.

## 2. Optimisation Zustand (`lib/store.ts`)

- **Problématiques d'immuabilité et de performances:**
  La gestion de l'immuabilité (CRUD dans le store) a été examinée et elle était respectée via l'utilisation stricte de callbacks avec copie sécurisée de l'état (ex: `set((state) => ({ clients: [...state.clients, client] }))`). Par conséquent, les anti-patterns habituels de mutations profondes sans recréation de pointeur en mémoire (pouvant aboutir à des bugs d'optimisation Next.js/React) étaient prévenus.
  De plus, la persistance dans `sessionStorage` à l'aide de l'outil Zustand `partialize` permet d'exclure efficacement les `settings`, afin de forcer un *fresh fetch* des données provenant du connecteur natif SQLite.
- **Action de maintenance appliquée:**
  Nous avons ajouté plusieurs tags JSDoc dans l'interface `AppState` (`addClient`, `removeClient`, `updateClient`, `replaceClient`, etc.) du fichier `lib/store.ts`. Cela contribue considérablement à l'accélération du *developer experience* (DX), uniformise les annotations du document par rapport aux méthodes et sécurise la base applicative en garantissant des repères explicites.
- **Résolution collatérale de Test Unitaire:**
  Nous avons réglé le conflit "Ghost Data" observé via l'audit pour empêcher que des types incorrects ou un objet avec des clés redondantes / non prévues viennent faire échouer nos tests de la suite E2E de purge d'éditeur (`tests/integration/quote-editor-mount.test.tsx`).

## 3. Synergie Electron - Gestion native et Inter-Process Communication (IPC)

- **Composant concerné:** `components/fullscreen-document-viewer.tsx`
- **Analyse du risque:**
  L'application Electron utilise la communication `window.electron.exportPDF(htmlDoc, filename)` via IPC pour interagir entre le processus de rendu (React) et le processus Main (Node/Chromium caché). Historiquement, ce point de contact crucial de l'application (l'export) n'englobait pas de façon atomique la réponse attendue en cas d'échec silencieux (e.g., mémoire Chromium insuffisante, process natif indisponible, fichier bloqué par Windows/Acrobat Reader).
- **Remédiation appliquée:**
  Un conteneur d'exception (bloc `try...catch` spécifique) a été rajouté autour de l'appel `window.electron.exportPDF`. Si ce dernier retourne une exception ou est avorté de force, un `toast.error` explicite et utilisateur (`Échec critique de l'export...`) informera le client du dysfonctionnement sans crasher l'UI de l'application, résolvant du même coup "l'Anomalie 2" soulevée par l'audit structurel préalable.

---
**Date de l'Audit**: `Automated - Facturier V4 Desktop Env.`
