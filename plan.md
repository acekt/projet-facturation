1. **Modifier les fichiers sources pour corriger les problèmes**
   - Modifier `components/pages/protected-app-shell.tsx` pour inclure les optimisations d'hydratation.
   - Modifier `lib/store.ts` pour corriger les problèmes de persistance `partialize` et documenter.
   - Modifier `components/pages/quotes.tsx` et `components/pages/invoices.tsx` pour encadrer les appels IPC (comme l'export Excel) avec des try/catch appropriés si ce n'est pas déjà le cas.
2. **Tester les modifications**
   - Lancer les tests pour s'assurer que les changements n'introduisent pas de régressions critiques (compte tenu que des tests existants échouaient déjà).
3. **Pre commit checks**
   - Complete pre commit steps to ensure proper testing, verification, review, and reflection are done.
4. **Soumettre les changements**
