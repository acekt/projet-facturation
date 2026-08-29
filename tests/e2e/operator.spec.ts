import { test, expect } from '@playwright/test';

test.describe('Opérateur — Tunnel de Vente, Taxes et Cycle de Vie des Transactions', () => {
  test.use({ storageState: './tests/e2e/.auth/operatorState.json' });

  test('Tunnel de vente complet : Devis -> Conversion Facture -> Calcul exact des taxes -> Règlement -> Avoir', async ({ page }) => {
    // ══════════════════════════════════════════════════════════════════════
    // ÉTAPE 1 : CRÉATION DU DEVIS
    // ══════════════════════════════════════════════════════════════════════
    await page.goto('/');
    await expect(page.getByText('Initialisation des modules locaux...')).toBeHidden({ timeout: 15000 });
    await page.getByRole('button', { name: 'Devis', exact: true }).click();
    await expect(page.locator('h1:has-text("Devis")')).toBeVisible();

    await page.getByRole('button', { name: /Nouveau devis/i }).first().click();

    // Sélection du client créé lors du setup (Société Gabonaise de Tech)
    await page.getByRole('button', { name: /Sélectionner un client/i }).click();
    const clientModalRow = page.locator('div[role="dialog"] button:has-text("Société Gabonaise de Tech")');
    await expect(clientModalRow).toBeVisible();
    await clientModalRow.click();

    // Sélection du service du catalogue (Consulting IT Gabonese : 150 000 FCFA)
    await page.locator('button:has-text("Sélectionner un service...")').click();
    await page.getByRole('option', { name: /Consulting IT Gabonese/i }).click();

    // Enregistrement du devis
    await page.getByRole('button', { name: 'Enregistrer le Devis' }).click();
    await expect(page.getByText('Devis enregistré avec succès')).toBeVisible();
    await expect(page.locator('h1:has-text("Devis")')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enregistrer le Devis' })).toBeHidden();
    await page.waitForTimeout(300);
    await expect(page.getByText('Société Gabonaise de Tech').first()).toBeVisible();

    // ══════════════════════════════════════════════════════════════════════
    // ÉTAPE 2 : TRANSFORMATION DU DEVIS EN FACTURE
    // ══════════════════════════════════════════════════════════════════════
    const quoteRow = page.locator('tr:has-text("Société Gabonaise de Tech"), div:has-text("Société Gabonaise de Tech")').first();
    await quoteRow.locator('button').last().click();
    await page.getByRole('menuitem', { name: /Convertir en facture/i }).click();

    await expect(page.getByText('Devis converti en facture avec succès')).toBeVisible();
    await expect(page.locator('table').getByText('Converti', { exact: true })).toBeVisible();

    await page.evaluate(() => {
      document.body.style.removeProperty('pointer-events');
      document.body.removeAttribute('data-scroll-locked');
    });
    await page.waitForTimeout(600);

    // ══════════════════════════════════════════════════════════════════════
    // ÉTAPE 3 : VÉRIFICATION DE LA FACTURE ET DES RÈGLES FISCALES EXACTES
    // ══════════════════════════════════════════════════════════════════════
    await page.getByRole('button', { name: 'Factures', exact: true }).click({ force: true });
    await expect(page.locator('h1:has-text("Factures")')).toBeVisible();
    await page.waitForTimeout(300);

    const invoiceRow = page.locator('tr:has-text("Société Gabonaise de Tech"), div:has-text("Société Gabonaise de Tech")').first();
    await expect(invoiceRow).toBeVisible();

    // Ouverture de l'aperçu du document (DocumentPreview) pour vérifier le calcul du total
    await invoiceRow.locator('button').last().click();
    await page.getByRole('menuitem', { name: /Aperçu/i }).click();

    const previewModal = page.locator('.fixed.inset-0.z-\\[100\\]');
    await expect(previewModal).toBeVisible();

    // Vérification de la logique de calcul sur le montant total exact :
    // Total HT : 150 000 FCFA
    // CSS (1%) sur Total HT (150 000 * 0.01) = 1 500 FCFA
    // Base Imposable (Net HT + CSS) = 151 500 FCFA -> pas affiché
    // TPS (9.5%) sur Base Imposable (151 500 * 0.095) = 14 393 FCFA
    // TVA (18%) sur Base Imposable (151 500 * 0.18) = 27 270 FCFA
    // Total TTC = 150 000 + 1 500 + 14 393 + 27 270 = 193 163 FCFA
    await expect(previewModal.getByText(/150\s*000\s*FCFA/i).first()).toBeVisible();
    await expect(previewModal.getByText(/14\s*393\s*FCFA/i).first()).toBeVisible();
    await expect(previewModal.getByText(/27\s*270\s*FCFA/i).first()).toBeVisible();
    await expect(previewModal.getByText(/1\s*500\s*FCFA/i).first()).toBeVisible();
    await expect(previewModal.getByText(/193\s*163\s*FCFA/i).first()).toBeVisible();

    // Fermeture de l'aperçu
    await page.getByRole('button', { name: /fermer/i }).click();
    await expect(previewModal).toBeHidden();
    await expect(page.locator('div[data-slot="dialog-overlay"]')).toBeHidden();
    await page.evaluate(() => {
      document.body.style.removeProperty('pointer-events');
      document.body.removeAttribute('data-scroll-locked');
    });
    await page.waitForTimeout(600);

    // ══════════════════════════════════════════════════════════════════════
    // ÉTAPE 4 : ENREGISTREMENT D'UN RÈGLEMENT COMPLET
    // ══════════════════════════════════════════════════════════════════════
    await invoiceRow.locator('button').last().click();
    await page.getByRole('menuitem', { name: /Enregistrer un règlement/i }).click();

    const paymentModal = page.locator('div[role="dialog"]:has-text("Confirmer le règlement")');
    await expect(paymentModal).toBeVisible();

    // Sélection du mode de règlement
    await paymentModal.locator('label:has-text("Mode de règlement")').locator('..').locator('button').click();
    await page.getByRole('option', { name: 'Virement Bancaire' }).click();

    // Validation du règlement (montant complet prérempli à 100%)
    await page.getByRole('button', { name: /Valider l'encaissement/i }).click();

    // Vérification de la fermeture de la modale et du passage au statut Soldé
    await expect(paymentModal).toBeHidden();
    await expect(page.locator('div[data-slot="dialog-overlay"]')).toBeHidden();
    await page.evaluate(() => {
      document.body.style.removeProperty('pointer-events');
      document.body.removeAttribute('data-scroll-locked');
    });
    await page.waitForTimeout(600);
    await expect(page.getByText('Soldé')).toBeVisible();

    // ══════════════════════════════════════════════════════════════════════
    // ÉTAPE 5 : GÉNÉRATION D'UN AVOIR VIA ANNULATION DE LA FACTURE
    // ══════════════════════════════════════════════════════════════════════
    await invoiceRow.locator('button').last().click();
    await page.getByRole('menuitem', { name: /Annuler la facture/i }).click();

    const cancelModal = page.locator('div[role="alertdialog"], div[role="dialog"]').filter({ hasText: "Annuler la facture" });
    await expect(cancelModal).toBeVisible();
    await page.getByRole('button', { name: /Confirmer l'annulation/i }).click();

    await expect(cancelModal).toBeHidden();
    await expect(page.locator('div[data-slot="dialog-overlay"], div[data-slot="alert-dialog-overlay"]')).toBeHidden();
    await page.evaluate(() => {
      document.body.style.removeProperty('pointer-events');
      document.body.removeAttribute('data-scroll-locked');
    });
    await page.waitForTimeout(600);
    await expect(page.getByText('Facture annulée avec succès')).toBeVisible();
    await expect(page.getByText('Annulée')).toBeVisible();

    // Vérification dans l'espace Avoirs
    await page.getByRole('button', { name: 'Avoirs', exact: true }).click({ force: true });
    await expect(page.locator('h1:has-text("Avoirs")')).toBeVisible();
    await expect(page.getByText('Société Gabonaise de Tech').first()).toBeVisible();
    await expect(page.getByText('193 163 FCFA').first()).toBeVisible();
  });
});
