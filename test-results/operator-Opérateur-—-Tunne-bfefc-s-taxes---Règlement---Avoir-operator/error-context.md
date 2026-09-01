# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: operator.spec.ts >> Opérateur — Tunnel de Vente, Taxes et Cycle de Vie des Transactions >> Tunnel de vente complet : Devis -> Conversion Facture -> Calcul exact des taxes -> Règlement -> Avoir
- Location: tests\e2e\operator.spec.ts:6:7

# Error details

```
TimeoutError: locator.click: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Devis', exact: true })

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - generic [ref=e9]:
        - generic [ref=e10]: L'ÉTOILE
        - text: Gestion Gabonaise
      - generic [ref=e11]:
        - heading "Gerez votre facturation avec excellence." [level=2] [ref=e12]
        - paragraph [ref=e13]: La solution locale et conforme pour piloter vos devis, factures, règlements et avoirs en toute sérénité au Gabon.
        - generic [ref=e14]:
          - generic [ref=e19]:
            - heading "Conformité DGI locale" [level=4] [ref=e20]
            - paragraph [ref=e21]: Calcul strict des taxes TVA, TPS et CSS
          - generic [ref=e26]:
            - heading "Résilience 100% Hors-Ligne" [level=4] [ref=e27]
            - paragraph [ref=e28]: Base SQLite locale ultra-rapide et sécurisée
          - generic [ref=e33]:
            - heading "Suivi financier instantané" [level=4] [ref=e34]
            - paragraph [ref=e35]: Tableaux de bord et état des paiements en temps réel
      - paragraph [ref=e37]: © 2026 L'Étoile S.A. Tous droits réservés.
    - generic [ref=e38]:
      - generic [ref=e39]:
        - generic [ref=e40]:
          - heading "Bon retour parmi nous" [level=1] [ref=e41]
          - paragraph [ref=e42]: Entrez vos identifiants pour accéder à votre espace de gestion.
        - generic [ref=e43]:
          - generic [ref=e44]:
            - generic [ref=e45] [cursor=pointer]: Identifiant ou Email
            - textbox "Identifiant ou Email" [ref=e50]:
              - /placeholder: nom@letoile.ga
          - generic [ref=e51]:
            - generic [ref=e52]:
              - generic [ref=e53] [cursor=pointer]: Mot de passe
              - button "Mot de passe oublié ?" [ref=e54] [cursor=pointer]
            - generic [ref=e55]:
              - textbox "Mot de passe" [ref=e59]:
                - /placeholder: ••••••••
              - button [ref=e60] [cursor=pointer]
          - button "Se connecter" [ref=e64] [cursor=pointer]
        - generic [ref=e65]: ou
        - button "Utiliser un compte de démonstration" [ref=e70] [cursor=pointer]
      - generic [ref=e71]: Connexion locale sécurisée • Chiffrement cryptographique
  - region "Notifications alt+T"
  - alert [ref=e76]
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('Opérateur — Tunnel de Vente, Taxes et Cycle de Vie des Transactions', () => {
  4   |   test.use({ storageState: './tests/e2e/.auth/operatorState.json' });
  5   | 
  6   |   test('Tunnel de vente complet : Devis -> Conversion Facture -> Calcul exact des taxes -> Règlement -> Avoir', async ({ page }) => {
  7   |     // ══════════════════════════════════════════════════════════════════════
  8   |     // ÉTAPE 1 : CRÉATION DU DEVIS
  9   |     // ══════════════════════════════════════════════════════════════════════
  10  |     await page.goto('/');
  11  |     await expect(page.getByText('Initialisation des modules locaux...')).toBeHidden({ timeout: 15000 });
> 12  |     await page.getByRole('button', { name: 'Devis', exact: true }).click();
      |                                                                    ^ TimeoutError: locator.click: Timeout 10000ms exceeded.
  13  |     await expect(page.locator('h1:has-text("Devis")')).toBeVisible();
  14  | 
  15  |     await page.getByRole('button', { name: /Nouveau devis/i }).first().click();
  16  | 
  17  |     // Sélection du client créé lors du setup (Société Gabonaise de Tech)
  18  |     await page.getByRole('button', { name: /Sélectionner un client/i }).click();
  19  |     const clientModalRow = page.locator('div[role="dialog"] button:has-text("Société Gabonaise de Tech")');
  20  |     await expect(clientModalRow).toBeVisible();
  21  |     await clientModalRow.click();
  22  | 
  23  |     // Sélection du service du catalogue (Consulting IT Gabonese : 150 000 FCFA)
  24  |     await page.locator('button:has-text("Sélectionner un service...")').click();
  25  |     await page.getByRole('option', { name: /Consulting IT Gabonese/i }).click();
  26  | 
  27  |     // Enregistrement du devis
  28  |     await page.getByRole('button', { name: 'Enregistrer le Devis' }).click();
  29  |     await expect(page.getByText('Devis enregistré avec succès')).toBeVisible();
  30  |     await expect(page.locator('h1:has-text("Devis")')).toBeVisible();
  31  |     await expect(page.getByRole('button', { name: 'Enregistrer le Devis' })).toBeHidden();
  32  |     await page.waitForTimeout(300);
  33  |     await expect(page.getByText('Société Gabonaise de Tech').first()).toBeVisible();
  34  | 
  35  |     // ══════════════════════════════════════════════════════════════════════
  36  |     // ÉTAPE 2 : TRANSFORMATION DU DEVIS EN FACTURE
  37  |     // ══════════════════════════════════════════════════════════════════════
  38  |     const quoteRow = page.locator('tr:has-text("Société Gabonaise de Tech"), div:has-text("Société Gabonaise de Tech")').first();
  39  |     await quoteRow.locator('button').last().click();
  40  |     await page.getByRole('menuitem', { name: /Convertir en facture/i }).click();
  41  | 
  42  |     await expect(page.getByText('Devis converti en facture avec succès')).toBeVisible();
  43  |     await expect(page.getByText('Converti', { exact: true })).toBeVisible();
  44  | 
  45  |     await page.evaluate(() => {
  46  |       document.body.style.removeProperty('pointer-events');
  47  |       document.body.removeAttribute('data-scroll-locked');
  48  |     });
  49  |     await page.waitForTimeout(600);
  50  | 
  51  |     // ══════════════════════════════════════════════════════════════════════
  52  |     // ÉTAPE 3 : VÉRIFICATION DE LA FACTURE ET DES RÈGLES FISCALES EXACTES
  53  |     // ══════════════════════════════════════════════════════════════════════
  54  |     await page.getByRole('button', { name: 'Factures', exact: true }).click({ force: true });
  55  |     await expect(page.locator('h1:has-text("Factures")')).toBeVisible();
  56  |     await page.waitForTimeout(300);
  57  | 
  58  |     const invoiceRow = page.locator('tr:has-text("Société Gabonaise de Tech"), div:has-text("Société Gabonaise de Tech")').first();
  59  |     await expect(invoiceRow).toBeVisible();
  60  | 
  61  |     // Ouverture de l'aperçu du document (DocumentPreview) pour vérifier le calcul du total
  62  |     await invoiceRow.locator('button').last().click();
  63  |     await page.getByRole('menuitem', { name: /Aperçu/i }).click();
  64  | 
  65  |     const previewModal = page.locator('div[role="dialog"]:has-text("Base Imposable")');
  66  |     await expect(previewModal).toBeVisible();
  67  | 
  68  |     // Vérification de la logique de calcul sur le montant total exact :
  69  |     // Total HT : 150 000 FCFA
  70  |     // CSS (1%) sur Total HT (150 000 * 0.01) = 1 500 FCFA
  71  |     // Base Imposable (Net HT + CSS) = 151 500 FCFA
  72  |     // TPS (9.5%) sur Base Imposable (151 500 * 0.095) = 14 393 FCFA
  73  |     // TVA (18%) sur Base Imposable (151 500 * 0.18) = 27 270 FCFA
  74  |     // Total TTC = 150 000 + 1 500 + 14 393 + 27 270 = 193 163 FCFA
  75  |     await expect(previewModal.getByText('150 000 FCFA', { exact: true }).first()).toBeVisible();
  76  |     await expect(previewModal.getByText('151 500 FCFA').first()).toBeVisible();
  77  |     await expect(previewModal.getByText('14 393 FCFA').first()).toBeVisible();
  78  |     await expect(previewModal.getByText('27 270 FCFA').first()).toBeVisible();
  79  |     await expect(previewModal.getByText('1 500 FCFA', { exact: true }).first()).toBeVisible();
  80  |     await expect(previewModal.getByText('193 163 FCFA').first()).toBeVisible();
  81  | 
  82  |     // Fermeture de l'aperçu
  83  |     await page.keyboard.press('Escape');
  84  |     await expect(previewModal).toBeHidden();
  85  |     await expect(page.locator('div[data-slot="dialog-overlay"]')).toBeHidden();
  86  |     await page.evaluate(() => {
  87  |       document.body.style.removeProperty('pointer-events');
  88  |       document.body.removeAttribute('data-scroll-locked');
  89  |     });
  90  |     await page.waitForTimeout(600);
  91  | 
  92  |     // ══════════════════════════════════════════════════════════════════════
  93  |     // ÉTAPE 4 : ENREGISTREMENT D'UN RÈGLEMENT COMPLET
  94  |     // ══════════════════════════════════════════════════════════════════════
  95  |     await invoiceRow.locator('button').last().click();
  96  |     await page.getByRole('menuitem', { name: /Enregistrer un règlement/i }).click();
  97  | 
  98  |     const paymentModal = page.locator('div[role="dialog"]:has-text("Confirmer le règlement")');
  99  |     await expect(paymentModal).toBeVisible();
  100 | 
  101 |     // Sélection du mode de règlement
  102 |     await paymentModal.locator('label:has-text("Mode de règlement")').locator('..').locator('button').click();
  103 |     await page.getByRole('option', { name: 'Virement Bancaire' }).click();
  104 | 
  105 |     // Validation du règlement (montant complet prérempli à 100%)
  106 |     await page.getByRole('button', { name: /Valider l'encaissement/i }).click();
  107 | 
  108 |     // Vérification de la fermeture de la modale et du passage au statut Soldé
  109 |     await expect(paymentModal).toBeHidden();
  110 |     await expect(page.locator('div[data-slot="dialog-overlay"]')).toBeHidden();
  111 |     await page.evaluate(() => {
  112 |       document.body.style.removeProperty('pointer-events');
```