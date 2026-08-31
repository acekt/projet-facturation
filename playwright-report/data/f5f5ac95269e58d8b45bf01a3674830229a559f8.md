# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: api-resilience.spec.ts >> Résilience UI & Contrat d'Erreur API — Module Factures >> devrait maintenir l'UI interactive et préserver l'état Zustand en cas d'erreur 500 (SQLITE_BUSY) sur GET /api/invoices
- Location: tests\e2e\api-resilience.spec.ts:22:7

# Error details

```
TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('text=Nouvelle Facture') to be visible

```

# Page snapshot

```yaml
- generic [ref=f1e1]:
  - generic [ref=f1e2]:
    - complementary [ref=f1e3]:
      - generic [ref=f1e9]:
        - generic [ref=f1e10]: L'ÉTOILE
        - generic [ref=f1e11]: Opérations
      - button "Nouveau devis" [ref=f1e13] [cursor=pointer]
      - generic [ref=f1e15]:
        - generic [ref=f1e16]:
          - paragraph [ref=f1e17]: Système
          - button "Tableau de bord" [ref=f1e18] [cursor=pointer]
        - generic [ref=f1e26]:
          - paragraph [ref=f1e27]: Opérations
          - button "Devis" [ref=f1e28] [cursor=pointer]
          - button "Factures" [active] [ref=f1e33] [cursor=pointer]
          - button "Paiements" [ref=f1e38] [cursor=pointer]
          - button "Avoirs" [ref=f1e42] [cursor=pointer]
      - generic [ref=f1e49]:
        - button "Paramètres" [ref=f1e51] [cursor=pointer]
        - generic [ref=f1e56]:
          - generic [ref=f1e57]: JE
          - generic [ref=f1e59]:
            - paragraph [ref=f1e60]: Jean-Baptiste Moussavou
            - button "Déconnexion" [ref=f1e61] [cursor=pointer]
      - button [ref=f1e65] [cursor=pointer]
    - banner [ref=f1e68]:
      - button "Rechercher... K" [ref=f1e69] [cursor=pointer]:
        - generic [ref=f1e73]: Rechercher...
        - generic [ref=f1e74]: K
      - generic [ref=f1e79]:
        - button "Basculer le theme" [ref=f1e80] [cursor=pointer]
        - button [ref=f1e83] [cursor=pointer]
    - generic [ref=f1e88]:
      - heading "Command Palette" [level=2] [ref=f1e89]
      - paragraph [ref=f1e90]: Search for a command to run...
    - main [ref=f1e91]:
      - generic [ref=f1e93]:
        - generic [ref=f1e95]:
          - heading "Tableau de Bord" [level=1] [ref=f1e96]
          - paragraph [ref=f1e97]: Espace Opérateur
        - generic [ref=f1e98]:
          - generic [ref=f1e99]:
            - generic [ref=f1e100]: Mes Devis Actifs
            - generic [ref=f1e105]:
              - paragraph [ref=f1e106]: "0"
              - paragraph [ref=f1e107]: Non convertis en factures
          - generic [ref=f1e108]:
            - generic [ref=f1e109]: Factures Payées
            - generic [ref=f1e114]:
              - paragraph [ref=f1e115]: "0"
              - paragraph [ref=f1e116]: Règlements complets
          - generic [ref=f1e117]:
            - generic [ref=f1e118]: Factures Partielles
            - generic [ref=f1e123]:
              - paragraph [ref=f1e124]: "0"
              - paragraph [ref=f1e125]: Acomptes reçus
          - generic [ref=f1e126]:
            - generic [ref=f1e127]: Factures Non Payées
            - generic [ref=f1e131]:
              - paragraph [ref=f1e132]: "0"
              - paragraph [ref=f1e133]: En attente de paiement
        - generic [ref=f1e134]:
          - generic [ref=f1e135]:
            - generic [ref=f1e137]:
              - generic [ref=f1e138]: Performance de Facturation
              - generic [ref=f1e139]: Revenus encaissés (XAF)
            - paragraph [ref=f1e146]: Aucune donnée financière générée sur cette période.
          - generic [ref=f1e147]:
            - generic [ref=f1e148]: Performance
            - generic [ref=f1e154]:
              - generic [ref=f1e155]:
                - generic [ref=f1e156]:
                  - generic [ref=f1e157]: Croissance
                  - generic [ref=f1e158]: +0.0%
                - paragraph [ref=f1e159]: vs mois précédent
              - generic [ref=f1e160]:
                - generic [ref=f1e161]:
                  - generic [ref=f1e162]: Chiffre d'Affaires
                  - generic [ref=f1e163]: Mois
                - paragraph [ref=f1e164]: 0 FCFA
        - generic [ref=f1e166]:
          - generic [ref=f1e167]:
            - generic [ref=f1e168]: Activité Récente
            - generic [ref=f1e169]: Derniers documents émis
          - button "TOUT VOIR" [ref=f1e170] [cursor=pointer]
  - region "Notifications alt+T"
  - alert [ref=f1e171]
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | /**
  4   |  * TEST DE RÉSILIENCE UI FACE AUX PANNES API (Playwright E2E)
  5   |  * 
  6   |  * Objectif : Vérifier que le Front-end ne crashe jamais, maintient l'interactivité,
  7   |  * ne vide pas silencieusement l'état Zustand et informe clairement l'utilisateur
  8   |  * via des notifications (Toasts) lors des défaillances serveur (HTTP 500 SQLITE_BUSY ou 400).
  9   |  */
  10  | test.describe('Résilience UI & Contrat d\'Erreur API — Module Factures', () => {
  11  | 
  12  |   // Fonction utilitaire de connexion Opérateur standard (operateur@letoile.ga) avant chaque test
  13  |   async function loginAsUser(page: any) {
  14  |     await page.goto('/login');
  15  |     await page.waitForSelector('#username');
  16  |     await page.fill('#username', 'operateur@letoile.ga');
  17  |     await page.fill('#password', 'operateur123');
  18  |     await page.click('button[type="submit"]');
  19  |     await page.waitForSelector('button:has-text("Factures")', { timeout: 15000 });
  20  |   }
  21  | 
  22  |   test('devrait maintenir l\'UI interactive et préserver l\'état Zustand en cas d\'erreur 500 (SQLITE_BUSY) sur GET /api/invoices', async ({ page }) => {
  23  |     // ── Logique d'interception réseau Playwright ──
  24  |     // On intercepte AVANT le login pour attraper la requête initiale du DataSync
  25  |     await page.route('**/api/invoices*', async (route) => {
  26  |       if (route.request().method() === 'GET') {
  27  |         await route.fulfill({
  28  |           status: 500,
  29  |           contentType: 'application/json',
  30  |           body: JSON.stringify({ error: 'SQLITE_BUSY: database is locked' }),
  31  |         });
  32  |       } else {
  33  |         await route.continue();
  34  |       }
  35  |     });
  36  | 
  37  |     await loginAsUser(page);
  38  | 
  39  |     // Navigation initiale vers la page des factures
  40  |     await page.click('button:has-text("Factures")');
> 41  |     await page.waitForSelector('text=Nouvelle Facture');
      |                ^ TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
  42  | 
  43  |     // 1. Assertion Toast : l'utilisateur doit être notifié explicitement de l'erreur serveur
  44  |     const errorToast = page.locator('text=/Erreur serveur \\(500\\)|SQLITE_BUSY|Impossible de charger/i').first();
  45  |     await expect(errorToast).toBeVisible({ timeout: 10000 });
  46  | 
  47  |     // 2. Assertion Interactivité : l'application ne doit en aucun cas crasher sur une page blanche
  48  |     const newInvoiceBtn = page.locator('button:has-text("Nouvelle Facture")');
  49  |     await expect(newInvoiceBtn).toBeVisible();
  50  |     await expect(newInvoiceBtn).toBeEnabled();
  51  | 
  52  |     // 3. Assertion État Zustand : la liste ne doit pas crasher l'interface ni déclencher d'exception fatale React
  53  |     const pageHeader = page.locator('h1:has-text("Factures"), h2:has-text("Factures")').first();
  54  |     await expect(pageHeader).toBeVisible();
  55  |   });
  56  | 
  57  |   test('devrait garder le formulaire ouvert, préserver les saisies et afficher un toast lors d\'une erreur 500 sur POST /api/invoices', async ({ page }) => {
  58  |     await loginAsUser(page);
  59  | 
  60  |     // Navigation vers l'éditeur de factures
  61  |     await page.click('button:has-text("Factures")');
  62  |     await page.click('button:has-text("Nouvelle Facture")');
  63  |     await page.waitForSelector('text=Informations de la Facture');
  64  | 
  65  |     // Remplissage des champs obligatoires (Client et Article)
  66  |     await page.click('text=Sélectionner un client');
  67  |     await page.waitForSelector('text=CGA – Compagnie Gabonaise d\'Assurances');
  68  |     await page.click('text=CGA – Compagnie Gabonaise d\'Assurances');
  69  | 
  70  |     await page.click('text=Sélectionner un service...');
  71  |     await page.click('text=Maintenance Préventive');
  72  | 
  73  |     // Vérification que le client et le service sont bien sélectionnés dans l'UI
  74  |     await expect(page.locator('text=CGA – Compagnie Gabonaise d\'Assurances')).toBeVisible();
  75  | 
  76  |     // ── Logique d'interception réseau Playwright ──
  77  |     // Interception de la mutation POST /api/invoices pour simuler un échec critique d'insertion
  78  |     // (ex: erreur de validation 400 ou verrouillage de transaction SQLITE_BUSY HTTP 500).
  79  |     await page.route('**/api/invoices', async (route) => {
  80  |       if (route.request().method() === 'POST') {
  81  |         await route.fulfill({
  82  |           status: 500,
  83  |           contentType: 'application/json',
  84  |           body: JSON.stringify({ error: 'SQLITE_BUSY: database is locked during insert' }),
  85  |         });
  86  |       } else {
  87  |         await route.continue();
  88  |       }
  89  |     });
  90  | 
  91  |     // Tentative d'enregistrement de la facture
  92  |     const submitBtn = page.locator('button:has-text("Créer la Facture")');
  93  |     await submitBtn.click();
  94  | 
  95  |     // 1. Assertion Toast : message d'erreur explicite affiché à l'opérateur
  96  |     const toastError = page.locator('text=/Erreur lors de l\'enregistrement|SQLITE_BUSY/i').first();
  97  |     await expect(toastError).toBeVisible({ timeout: 10000 });
  98  | 
  99  |     // 2. Assertion Résilience Formulaire : l'éditeur NE DOIT PAS se fermer après une erreur API
  100 |     await expect(page.locator('text=Informations de la Facture')).toBeVisible();
  101 | 
  102 |     // 3. Assertion Protection Anti-Perte (No Silent Wipe) : les saisies de l'opérateur doivent rester intactes
  103 |     await expect(page.locator('text=CGA – Compagnie Gabonaise d\'Assurances')).toBeVisible();
  104 | 
  105 |     // 4. Assertion Ré-interactivité : le bouton d'action ne doit pas rester bloqué en chargement infini
  106 |     await expect(submitBtn).toBeEnabled();
  107 |   });
  108 | });
  109 | 
```