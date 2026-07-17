import { test, expect } from '@playwright/test';

/**
 * TEST DE RÉSILIENCE UI FACE AUX PANNES API (Playwright E2E)
 * 
 * Objectif : Vérifier que le Front-end ne crashe jamais, maintient l'interactivité,
 * ne vide pas silencieusement l'état Zustand et informe clairement l'utilisateur
 * via des notifications (Toasts) lors des défaillances serveur (HTTP 500 SQLITE_BUSY ou 400).
 */
test.describe('Résilience UI & Contrat d\'Erreur API — Module Factures', () => {

  // Fonction utilitaire de connexion Opérateur standard (operateur@letoile.ga) avant chaque test
  async function loginAsUser(page: any) {
    await page.goto('/login');
    await page.waitForSelector('#username');
    await page.fill('#username', 'operateur@letoile.ga');
    await page.fill('#password', 'operateur123');
    await page.click('button[type="submit"]');
    await page.waitForSelector('button:has-text("Factures")', { timeout: 15000 });
  }

  test('devrait maintenir l\'UI interactive et préserver l\'état Zustand en cas d\'erreur 500 (SQLITE_BUSY) sur GET /api/invoices', async ({ page }) => {
    // ── Logique d'interception réseau Playwright ──
    // On intercepte AVANT le login pour attraper la requête initiale du DataSync
    await page.route('**/api/invoices*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'SQLITE_BUSY: database is locked' }),
        });
      } else {
        await route.continue();
      }
    });

    await loginAsUser(page);

    // Navigation initiale vers la page des factures
    await page.click('button:has-text("Factures")');
    await page.waitForSelector('text=Nouvelle Facture');

    // 1. Assertion Toast : l'utilisateur doit être notifié explicitement de l'erreur serveur
    const errorToast = page.locator('text=/Erreur serveur \\(500\\)|SQLITE_BUSY|Impossible de charger/i').first();
    await expect(errorToast).toBeVisible({ timeout: 10000 });

    // 2. Assertion Interactivité : l'application ne doit en aucun cas crasher sur une page blanche
    const newInvoiceBtn = page.locator('button:has-text("Nouvelle Facture")');
    await expect(newInvoiceBtn).toBeVisible();
    await expect(newInvoiceBtn).toBeEnabled();

    // 3. Assertion État Zustand : la liste ne doit pas crasher l'interface ni déclencher d'exception fatale React
    const pageHeader = page.locator('h1:has-text("Factures"), h2:has-text("Factures")').first();
    await expect(pageHeader).toBeVisible();
  });

  test('devrait garder le formulaire ouvert, préserver les saisies et afficher un toast lors d\'une erreur 500 sur POST /api/invoices', async ({ page }) => {
    await loginAsUser(page);

    // Navigation vers l'éditeur de factures
    await page.click('button:has-text("Factures")');
    await page.click('button:has-text("Nouvelle Facture")');
    await page.waitForSelector('text=Informations de la Facture');

    // Remplissage des champs obligatoires (Client et Article)
    await page.click('text=Sélectionner un client');
    await page.waitForSelector('text=CGA – Compagnie Gabonaise d\'Assurances');
    await page.click('text=CGA – Compagnie Gabonaise d\'Assurances');

    await page.click('text=Sélectionner un service...');
    await page.click('text=Maintenance Préventive');

    // Vérification que le client et le service sont bien sélectionnés dans l'UI
    await expect(page.locator('text=CGA – Compagnie Gabonaise d\'Assurances')).toBeVisible();

    // ── Logique d'interception réseau Playwright ──
    // Interception de la mutation POST /api/invoices pour simuler un échec critique d'insertion
    // (ex: erreur de validation 400 ou verrouillage de transaction SQLITE_BUSY HTTP 500).
    await page.route('**/api/invoices', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'SQLITE_BUSY: database is locked during insert' }),
        });
      } else {
        await route.continue();
      }
    });

    // Tentative d'enregistrement de la facture
    const submitBtn = page.locator('button:has-text("Créer la Facture")');
    await submitBtn.click();

    // 1. Assertion Toast : message d'erreur explicite affiché à l'opérateur
    const toastError = page.locator('text=/Erreur lors de l\'enregistrement|SQLITE_BUSY/i').first();
    await expect(toastError).toBeVisible({ timeout: 10000 });

    // 2. Assertion Résilience Formulaire : l'éditeur NE DOIT PAS se fermer après une erreur API
    await expect(page.locator('text=Informations de la Facture')).toBeVisible();

    // 3. Assertion Protection Anti-Perte (No Silent Wipe) : les saisies de l'opérateur doivent rester intactes
    await expect(page.locator('text=CGA – Compagnie Gabonaise d\'Assurances')).toBeVisible();

    // 4. Assertion Ré-interactivité : le bouton d'action ne doit pas rester bloqué en chargement infini
    await expect(submitBtn).toBeEnabled();
  });
});
