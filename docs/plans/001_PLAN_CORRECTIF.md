# 001 - PLAN CORRECTIF (URGENCES & STABILITÉ)

Cette feuille de route liste les actions correctives immédiates, ordonnées par priorité critique (P0 à P2). Ces correctifs réparent des bugs bloquants, préviennent la corruption de base de données et stoppent les fuites de mémoire.

## PRIORITÉ P0 : Intégrité Transactionnelle et Pertes de Données

### 1. Sécurisation QuoteService (Atomicité)
*   **Fichier** : `apps/desktop/lib/services/QuoteService.ts`
*   **Problème** : La création de facture (`InvoiceRepository.create`) et la mise à jour du devis (`UPDATE quotes SET status='CONVERTI'`) ne sont pas encapsulées dans une transaction.
*   **Code Correctif à appliquer** :
    ```typescript
    const conversionTx = db.transaction(() => {
       const invoiceId = InvoiceRepository.create(newInvoice, quoteItems);
       db.prepare("UPDATE quotes SET status = 'CONVERTI' WHERE id = ?").run(quoteId);
       return invoiceId;
    });
    return conversionTx();
    ```

### 2. Réparation Modale de Paiement (UI)
*   **Fichiers** : `apps/desktop/components/pages/invoices.tsx` et `apps/desktop/components/pages/invoices/PaymentDialog.tsx`
*   **Problème** : L'accolade orpheline (ligne 172 environ) casse `confirmPayment`. Les props Date et Référence sont ignorées.
*   **Code Correctif à appliquer** :
    *   *invoices.tsx* : Nettoyer l'accolade orpheline. Passer `paymentDate={paymentDate} onPaymentDateChange={setPaymentDate}` au `<PaymentDialog />`.
    *   *PaymentDialog.tsx* : Ajouter les `<Input type="date">` et `<Input type="text">` pour capter la date et la référence et les relier aux props ajoutées.

### 3. Protection Brouillon (Ghost Data Editor)
*   **Fichier** : `apps/desktop/components/pages/invoice-editor.tsx`
*   **Problème** : Hydratation agressive écrasant la saisie en cours.
*   **Code Correctif à appliquer** :
    Stocker les settings requis à l'initialisation dans un `useRef` pour l'exclure du tableau de dépendances du `useEffect` initial.
    ```typescript
    const initialMentions = React.useRef(settings.mentionsLegales);
    // ... dans le useEffect
    notes: initialMentions.current || ""
    ```

## PRIORITÉ P1 : Zombis et Sur-Sollicitation

### 4. Désamorçage de la Boucle CloudSync
*   **Fichier** : `apps/desktop/components/cloud-sync-runner.tsx`
*   **Problème** : `setInterval(..., 60000)` surcharge la RAM et le réseau, bloquant le runtime.
*   **Code Correctif à appliquer** :
    Remplacer par une gestion événementielle sur le Focus de la fenêtre, ou le retour réseau.
    ```typescript
    // Remplacer setInterval par :
    window.addEventListener("online", () => sync(true));
    window.addEventListener("focus", () => sync(true));
    ```

### 5. Nettoyage des processus Next.js Fantômes (Windows)
*   **Fichier** : `apps/desktop/main/server.js`
*   **Problème** : `taskkill` peut échouer et laisser le port 3000 bloqué.
*   **Code Correctif à appliquer** :
    Utiliser les capacités natives d'`utilityProcess.kill()`.
    ```javascript
    if (nextProcess && !nextProcess.killed) {
        nextProcess.kill();
        nextProcess = null;
    }
    ```

### 6. Correction Déconnexion Bloquante (UI)
*   **Fichier** : `apps/desktop/components/layout/navigation.tsx`
*   **Problème** : La modale `setShowLogoutDialog` n'est jamais remise à `false` si l'API crash.
*   **Code Correctif à appliquer** :
    ```typescript
    const handleConfirmLogout = async () => {
      setIsLoggingOut(true);
      try {
        await supabaseSession.logout();
        await logoutUser();
      } catch (e) {
        console.warn("Erreur logout:", e);
      } finally {
        setUser(null);
        setIsLoggingOut(false);
        setShowLogoutDialog(false);
        window.location.href = '/login';
      }
    }
    ```

## PRIORITÉ P2 : Débuggage Mineur

### 7. Patch Validation Service
*   **Fichier** : `apps/desktop/components/pages/services.tsx`
*   **Problème** : `unitPrice < 0` check est fait sur un champ qui peut valoir `NaN` si vide.
*   **Code Correctif à appliquer** :
    Assurer un typage entier robuste avant validation manuelle, ou déléguer intégralement la vérification au schéma Zod `serviceSchema`.

### 8. Patch Setup Forme Juridique
*   **Fichier** : `apps/desktop/app/setup/components/StepIdentity.tsx`
*   **Problème** : Les valeurs textuelles Custom "Autre" disparaissent de l'état.
*   **Code Correctif à appliquer** :
    Garder le state synchronisé avec l'Input conditionnel de manière bidirectionnelle avec `setLegalForm(e.target.value)`.