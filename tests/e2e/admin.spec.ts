import { test, expect } from '@playwright/test';

test.describe('Admin — Référentiel Commun (Clients & Services)', () => {
  test.use({ storageState: './tests/e2e/.auth/adminState.json' });

  test('CRUD Clients : création, vérification liste, modification et suppression', async ({ page }) => {
    // 1. Navigation vers la section Clients
    await page.goto('/');
    await expect(page.getByText('Initialisation des modules locaux...')).toBeHidden({ timeout: 15000 });
    await page.getByRole('button', { name: 'Clients', exact: true }).click();
    await expect(page.locator('h1:has-text("Clients")')).toBeVisible();

    // 2. Création d'un nouveau client
    await page.getByRole('button', { name: /Nouveau client/i }).first().click();
    await page.fill('#name', 'Client Admin Spec');
    await page.fill('#email', 'adminclient@facturier.ga');
    await page.fill('#phone', '+241 01 11 22 33');
    await page.fill('#address', 'Quartier Louis, Libreville');
    await page.getByRole('button', { name: /Enregistrer le client/i }).click();
    await expect(page.locator('div[role="dialog"]')).toBeHidden();
    await expect(page.locator('div[data-slot="dialog-overlay"]')).toBeHidden();
    await page.waitForTimeout(600);

    // Vérification dans la liste et toast
    await expect(page.getByText('Client Admin Spec')).toBeVisible();

    // 3. Modification du client
    const clientRow = page.locator('tr:has-text("Client Admin Spec"), div:has-text("Client Admin Spec")').first();
    await clientRow.locator('button').last().click();
    await page.getByRole('menuitem', { name: /Modifier/i }).click();

    await page.fill('#edit-name', 'Client Admin Spec Modifié');
    await page.getByRole('button', { name: /Enregistrer les modifications/i }).click();
    await expect(page.locator('div[role="dialog"]')).toBeHidden();
    await expect(page.locator('div[data-slot="dialog-overlay"]')).toBeHidden();
    await page.waitForTimeout(600);

    // Vérification de la mise à jour
    await expect(page.getByText('Client Admin Spec Modifié')).toBeVisible();

    // 4. Suppression du client (Soft Delete via modale de confirmation)
    const updatedRow = page.locator('tr:has-text("Client Admin Spec Modifié"), div:has-text("Client Admin Spec Modifié")').first();
    await updatedRow.locator('button').last().click();
    const deleteMenuItem = page.getByRole('menuitem', { name: /Supprimer/i });
    await expect(deleteMenuItem).toBeVisible();
    await deleteMenuItem.click();

    // Confirmation dans l'AlertDialog
    const alertDialog = page.locator('div[role="alertdialog"]');
    await expect(alertDialog).toBeVisible();
    await alertDialog.getByRole('button', { name: /^Supprimer$/ }).click();
    await expect(alertDialog).toBeHidden();
    await expect(page.locator('div[data-slot="dialog-overlay"]')).toBeHidden();
    await page.waitForTimeout(600);
    await expect(page.getByText('Client Admin Spec Modifié')).toBeHidden();
  });

  test('CRUD Services : création d\'une prestation standard et modification', async ({ page }) => {
    // 1. Navigation vers la section Services
    await page.goto('/');
    await expect(page.getByText('Initialisation des modules locaux...')).toBeHidden({ timeout: 15000 });
    await page.getByRole('button', { name: 'Services', exact: true }).click();
    await expect(page.locator('h1:has-text("Catalogue de services")')).toBeVisible();

    // 2. Création d'un nouveau service
    await page.getByRole('button', { name: /Nouveau service/i }).first().click();
    await page.fill('#service-name', 'Audit Sécurité Cloud');
    await page.fill('#service-category', 'Cybersecurity');
    await page.fill('#service-price', '350000');
    await page.fill('#service-description', 'Audit complet des infrastructures et rapports');
    await page.getByRole('button', { name: /Enregistrer dans le catalogue/i }).click();
    await expect(page.locator('div[role="dialog"]')).toBeHidden();
    await expect(page.locator('div[data-slot="dialog-overlay"]')).toBeHidden();
    await page.waitForTimeout(600);

    // Vérification de la présence de la carte/ligne de service
    await expect(page.getByText('Audit Sécurité Cloud')).toBeVisible();
    await expect(page.getByText('350 000 FCFA')).toBeVisible();

    // 3. Modification du service
    const serviceRow = page.locator('tr:has-text("Audit Sécurité Cloud"), div:has-text("Audit Sécurité Cloud")').first();
    await serviceRow.locator('button').last().click();
    await page.getByRole('menuitem', { name: /Modifier/i }).click();

    await page.fill('#service-name', 'Audit Sécurité Cloud Modifié');
    await page.getByRole('button', { name: /Enregistrer dans le catalogue/i }).click();
    await expect(page.locator('div[role="dialog"]')).toBeHidden();
    await expect(page.locator('div[data-slot="dialog-overlay"]')).toBeHidden();
    await page.waitForTimeout(600);

    // Vérification de la mise à jour
    await expect(page.getByText('Audit Sécurité Cloud Modifié')).toBeVisible();
  });
});

test.describe('Isolation RBAC — Opérateur (Vérification d\'étanchéité)', () => {
  test.use({ storageState: './tests/e2e/.auth/operatorState.json' });

  test('Vérifie qu\'un opérateur n\'a pas accès aux actions de gestion du référentiel', async ({ page }) => {
    await page.goto('/');

    // 1. Vérification dans la barre de navigation : absence des onglets Clients et Services
    await expect(page.locator('nav button:has-text("Clients")')).toBeHidden();
    await expect(page.locator('nav button:has-text("Services")')).toBeHidden();

    // 2. Vérification par accès direct URL à /clients : absence du bouton "Nouveau client"
    await page.goto('/clients');
    await expect(page.getByRole('button', { name: /Nouveau client/i })).toBeHidden();

    // 3. Vérification par accès direct URL à /services : absence du bouton "Nouveau service"
    await page.goto('/services');
    await expect(page.getByRole('button', { name: /Nouveau service/i })).toBeHidden();
  });
});
