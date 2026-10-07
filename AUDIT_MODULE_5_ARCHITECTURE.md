# AUDIT_MODULE_5_ARCHITECTURE: Architecture d'État & Intégration Electron

## 1. Hydratation du Store et Goulots d'Étranglement au Démarrage

### Analyse
L'hydratation du store au démarrage de l'application "Facturier" s'effectue dans un composant dédié `DataSync` (situé dans `components/data-sync.tsx`), appelé depuis la coquille applicative `ProtectedAppShell`.
Ce mécanisme a été bien conçu pour éviter de bloquer le rendu initial.

**Points forts de l'implémentation actuelle :**
- **Parallélisation `Promise.allSettled` :** `DataSync` charge toutes les entités lourdes (`clients`, `quotes`, `invoices`, `services`, `payments`, `settings`, `credit-notes`) de manière asynchrone et en parallèle. Ceci est optimal pour une application offline-first qui interroge sa base SQLite locale via des API Next.js.
- **Gestion du Spinner :** Le flag `isDataLoaded` de Zustand contrôle l'affichage de l'écran de chargement (`Spinner`) dans `ProtectedAppShell`.
- **Anti-Flicker :** `DataSync` intègre un délai artificiel de `600ms` via `setTimeout(() => { setIsDataLoaded(true) }, 600)` pour laisser le temps aux transitions UI de s'opérer et éviter un clignotement ("flicker") inesthétique lorsque la base de données répond instantanément. De plus, `ProtectedAppShell` utilise `AnimatePresence` (framer-motion) avec une durée de transition de `0.4s` pour un fondu enchaîné fluide.
- **Microtask Queue :** `ProtectedAppShell` gère intelligemment la synchronisation initiale de l'utilisateur. Pour éviter l'erreur React *"Cannot update a component while rendering a different component"*, l'hydratation de l'utilisateur (si le store diffère de l'utilisateur injecté initialement par le serveur) est encapsulée dans `queueMicrotask(() => { setUser(initialUser) })`.

**Risques et Limitations Potentiels :**
- Les requêtes dans `DataSync` s'exécutent avec `Promise.allSettled`. Cependant, si l'une échoue silencieusement (ce qui est rattrapé par les `.catch(() => null)`), l'utilisateur pourrait se retrouver sur le Dashboard avec des données incomplètes, bien qu'un toast.error général signale une défaillance réseau.
- Le délai artificiel de 600ms, bien que souhaitable pour masquer les flickers, force un délai minimal de chargement même sur les machines très performantes.

### Solution Optimisée pour `ProtectedAppShell` (Déjà en place dans la codebase)
L'implémentation dans `ProtectedAppShell` est déjà robuste :
```tsx
  // Synchronisation prioritaire :
  // On utilise useRef pour garder trace de l'initialisation afin de ne déclencher le setState
  // qu'une seule fois si le store ne correspond pas au Server Component.
  const hasInitialized = React.useRef(false)

  if (!hasInitialized.current) {
    if (initialUser && (!user || user.id !== initialUser.id || user.role !== initialUser.role)) {
      // Encapsulation dans queueMicrotask pour éviter le flickering et les warnings React
      queueMicrotask(() => {
        setUser(initialUser)
      })
    }
    hasInitialized.current = true
  }
```
L'écran de chargement est propre avec `framer-motion` :
```tsx
        <AnimatePresence mode="wait">
          {!effectiveUser || !isDataLoaded ? (
            <motion.div
              // ... spinner et styles
            >
              <div className="relative flex items-center justify-center">
                <div className="w-16 h-16 border-4 border-primary/20 rounded-full"></div>
                <div className="absolute w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <FileText className="absolute w-6 h-6 text-primary animate-pulse" />
              </div>
              <p className="mt-6 text-sm text-muted-foreground font-medium animate-pulse">
                Initialisation de Facturier... Veuillez patienter
              </p>
            </motion.div>
          ) : (
             // Content
          )}
        </AnimatePresence>
```


## 2. Optimisation Zustand (`lib/store.ts`)

### Analyse de `lib/store.ts`
- **Persistance :** Le store utilise `persist` de Zustand, configuré pour sauvegarder uniquement un sous-ensemble minimal de l'état (`user`, `permissions`, `isAuthenticated`, `viewFormat`) dans `sessionStorage`. Cela évite intelligemment de persister des données massives comme la liste des factures, qui sont synchronisées par l'API via `DataSync` (évitant ainsi les données obsolètes et l'inflation de l'utilisation mémoire du navigateur). Les `settings` sont intentionnellement exclus pour forcer un re-chargement via la DB.
- **Immuabilité :** Les actions CRUD (ex: `addClient`, `updateClient`, `removeClient`) utilisent des mises à jour fonctionnelles `set((state) => ({ ... }))` respectant strictement l'immuabilité et évitant le problème de *stale closures*.
- **Documentation et Maintenance :** Des commentaires JSDoc sont massivement présents et standardisent les descriptions pour l'ensemble des entités.
- **Risques de Fuites de Mémoire :** La non-persistance des grosses listes (via `partialize`) permet de garder le `sessionStorage` léger.

### Version Optimisée de `store.ts` (Aperçu)
L'implémentation est actuellement saine. Les recommandations de nommage (`set*` vs mutateurs atomiques) sont respectées.
```typescript
      /**
       * @function addClient
       * @description Ajoute un nouveau client de manière strictement immuable au store.
       * @param {Client} client - L'objet client à ajouter.
       */
      addClient: (client) =>
        set((state) => ({ clients: [...state.clients, client] })),
      /**
       * @function removeClient
       * @description Supprime un client existant en filtrant par ID de façon immuable.
       * @param {string} id - L'identifiant unique du client.
       */
      removeClient: (id) =>
        set((state) => ({ clients: state.clients.filter((c) => c.id !== id) })),
```

## 3. Synergie Electron (IPC)

### Analyse de l'intégration IPC
L'application communique avec le Processus Principal d'Electron via `window.electron` pour des tâches natives lourdes : `printDocument` et `exportPDF`.

**Points forts de l'implémentation :**
- L'objet global `window.electron` est injecté proprement par un preload script (s'assurant du respect des normes de sécurité de contextIsolation).
- Les appels comme `await window.electron.exportPDF(htmlDoc, filename)` sont encapsulés dans des blocs `try...catch` asynchrones.
- **Filtrage des erreurs bénignes :** Si l'utilisateur annule la boîte de dialogue d'enregistrement native (qui renvoie souvent une erreur avec le mot "cancel"), cette erreur est filtrée.

Extrait validé dans `components/fullscreen-document-viewer.tsx` :
```typescript
      try {
        const result = await window.electron.exportPDF(htmlDoc, filename)

        if (result.saved) {
          toast.success('PDF enregistré avec succès !', {
            id: toastId,
            description: result.filePath
              ? `Fichier : ${result.filePath.split(/[\\/]/).pop()}`
              : undefined,
            duration: 4000,
          })
        } else {
          // L'utilisateur a annulé la boîte de dialogue → pas d'erreur
          toast.dismiss(toastId)
        }
      } catch (err: any) {
        console.error('[FullScreenViewer] IPC exportPDF error:', err);
        toast.error(`Échec critique de l'export: ${err.message || 'Erreur inconnue'}`, { id: toastId });
      }
```

Extrait validé dans `lib/electron-print.ts` :
```typescript
  try {
    await window.electron.printDocument(htmlDoc);
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Erreur inconnue";
    // Ignorer les erreurs d'annulation de dialogue par l'utilisateur
    if (!errorMsg.toLowerCase().includes('cancel') && !errorMsg.toLowerCase().includes('annul')) {
      console.error('[printElement] Erreur critique IPC lors de l\\'impression:', error);
      toast.error("Échec de l'impression native", {
        description: "Veuillez vérifier votre imprimante ou relancer l'application."
      });
    }
  }
```
L'implémentation actuelle respecte scrupuleusement les exigences de qualité et de sécurité dictées, et offre des retours d'expérience fiables à l'utilisateur tout en garantissant que l'interface ne soit pas bloquée (par ex. en s'assurant que `isExporting` et `isPrinting` sont repassés à `false` via le bloc `finally`).

## Conclusion de l'Audit

L'architecture Zustand et l'intégration Electron sont saines :
1. **Démarrage optimal :** `DataSync` gère les requêtes lourdes asynchrones et l'UX est protégée par un spinner élégant et un délai anti-flicker de 600ms.
2. **Store performant :** L'usage de `partialize` évite de saturer `sessionStorage`. Les mutations respectent l'immuabilité pour éviter les *stale closures*.
3. **Appels Electron résilients :** Le pont IPC capture les erreurs avec précision et filtre les retours "cancel" de l'OS.

Aucune modification structurelle supplémentaire du code source n'est requise. L'état actuel de `lib/store.ts` et `components/pages/protected-app-shell.tsx` est conforme aux attentes strictes de performance et robustesse.
