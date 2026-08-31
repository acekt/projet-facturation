# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin.spec.ts >> Admin — Référentiel Commun (Clients & Services) >> CRUD Clients : création, vérification liste, modification et suppression
- Location: tests\e2e\admin.spec.ts:6:7

# Error details

```
TimeoutError: locator.click: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Clients', exact: true })

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
  3   | test.describe('Admin — Référentiel Commun (Clients & Services)', () => {
  4   |   test.use({ storageState: './tests/e2e/.auth/adminState.json' });
  5   | 
  6   |   test('CRUD Clients : création, vérification liste, modification et suppression', async ({ page }) => {
  7   |     // 1. Navigation vers la section Clients
  8   |     await page.goto('/');
  9   |     await expect(page.getByText('Initialisation des modules locaux...')).toBeHidden({ timeout: 15000 });
> 10  |     await page.getByRole('button', { name: 'Clients', exact: true }).click();
      |                                                                      ^ TimeoutError: locator.click: Timeout 10000ms exceeded.
  11  |     await expect(page.locator('h1:has-text("Clients")')).toBeVisible();
  12  | 
  13  |     // 2. Création d'un nouveau client
  14  |     await page.getByRole('button', { name: /Nouveau client/i }).first().click();
  15  |     await page.fill('#name', 'Client Admin Spec');
  16  |     await page.fill('#email', 'adminclient@letoile.ga');
  17  |     await page.fill('#phone', '+241 01 11 22 33');
  18  |     await page.fill('#address', 'Quartier Louis, Libreville');
  19  |     await page.getByRole('button', { name: /Enregistrer le client/i }).click();
  20  |     await expect(page.locator('div[role="dialog"]')).toBeHidden();
  21  |     await expect(page.locator('div[data-slot="dialog-overlay"]')).toBeHidden();
  22  |     await page.waitForTimeout(600);
  23  | 
  24  |     // Vérification dans la liste et toast
  25  |     await expect(page.getByText('Client Admin Spec')).toBeVisible();
  26  | 
  27  |     // 3. Modification du client
  28  |     const clientRow = page.locator('tr:has-text("Client Admin Spec"), div:has-text("Client Admin Spec")').first();
  29  |     await clientRow.locator('button').last().click();
  30  |     await page.getByRole('menuitem', { name: /Modifier/i }).click();
  31  | 
  32  |     await page.fill('#edit-name', 'Client Admin Spec Modifié');
  33  |     await page.getByRole('button', { name: /Enregistrer les modifications/i }).click();
  34  |     await expect(page.locator('div[role="dialog"]')).toBeHidden();
  35  |     await expect(page.locator('div[data-slot="dialog-overlay"]')).toBeHidden();
  36  |     await page.waitForTimeout(600);
  37  | 
  38  |     // Vérification de la mise à jour
  39  |     await expect(page.getByText('Client Admin Spec Modifié')).toBeVisible();
  40  | 
  41  |     // 4. Suppression du client (Soft Delete via modale de confirmation)
  42  |     const updatedRow = page.locator('tr:has-text("Client Admin Spec Modifié"), div:has-text("Client Admin Spec Modifié")').first();
  43  |     await updatedRow.locator('button').last().click();
  44  |     const deleteMenuItem = page.getByRole('menuitem', { name: /Supprimer/i });
  45  |     await expect(deleteMenuItem).toBeVisible();
  46  |     await deleteMenuItem.click();
  47  | 
  48  |     // Confirmation dans l'AlertDialog
  49  |     const alertDialog = page.locator('div[role="alertdialog"]');
  50  |     await expect(alertDialog).toBeVisible();
  51  |     await alertDialog.getByRole('button', { name: /^Supprimer$/ }).click();
  52  |     await expect(alertDialog).toBeHidden();
  53  |     await expect(page.locator('div[data-slot="dialog-overlay"]')).toBeHidden();
  54  |     await page.waitForTimeout(600);
  55  |     await expect(page.getByText('Client Admin Spec Modifié')).toBeHidden();
  56  |   });
  57  | 
  58  |   test('CRUD Services : création d\'une prestation standard et modification', async ({ page }) => {
  59  |     // 1. Navigation vers la section Services
  60  |     await page.goto('/');
  61  |     await expect(page.getByText('Initialisation des modules locaux...')).toBeHidden({ timeout: 15000 });
  62  |     await page.getByRole('button', { name: 'Services', exact: true }).click();
  63  |     await expect(page.locator('h1:has-text("Catalogue de services")')).toBeVisible();
  64  | 
  65  |     // 2. Création d'un nouveau service
  66  |     await page.getByRole('button', { name: /Nouveau service/i }).first().click();
  67  |     await page.fill('#service-name', 'Audit Sécurité Cloud');
  68  |     await page.fill('#service-category', 'Cybersecurity');
  69  |     await page.fill('#service-price', '350000');
  70  |     await page.fill('#service-description', 'Audit complet des infrastructures et rapports');
  71  |     await page.getByRole('button', { name: /Enregistrer dans le catalogue/i }).click();
  72  |     await expect(page.locator('div[role="dialog"]')).toBeHidden();
  73  |     await expect(page.locator('div[data-slot="dialog-overlay"]')).toBeHidden();
  74  |     await page.waitForTimeout(600);
  75  | 
  76  |     // Vérification de la présence de la carte/ligne de service
  77  |     await expect(page.getByText('Audit Sécurité Cloud')).toBeVisible();
  78  |     await expect(page.getByText('350 000 FCFA')).toBeVisible();
  79  | 
  80  |     // 3. Modification du service
  81  |     const serviceRow = page.locator('tr:has-text("Audit Sécurité Cloud"), div:has-text("Audit Sécurité Cloud")').first();
  82  |     await serviceRow.locator('button').last().click();
  83  |     await page.getByRole('menuitem', { name: /Modifier/i }).click();
  84  | 
  85  |     await page.fill('#service-name', 'Audit Sécurité Cloud Modifié');
  86  |     await page.getByRole('button', { name: /Enregistrer dans le catalogue/i }).click();
  87  |     await expect(page.locator('div[role="dialog"]')).toBeHidden();
  88  |     await expect(page.locator('div[data-slot="dialog-overlay"]')).toBeHidden();
  89  |     await page.waitForTimeout(600);
  90  | 
  91  |     // Vérification de la mise à jour
  92  |     await expect(page.getByText('Audit Sécurité Cloud Modifié')).toBeVisible();
  93  |   });
  94  | });
  95  | 
  96  | test.describe('Isolation RBAC — Opérateur (Vérification d\'étanchéité)', () => {
  97  |   test.use({ storageState: './tests/e2e/.auth/operatorState.json' });
  98  | 
  99  |   test('Vérifie qu\'un opérateur n\'a pas accès aux actions de gestion du référentiel', async ({ page }) => {
  100 |     await page.goto('/');
  101 | 
  102 |     // 1. Vérification dans la barre de navigation : absence des onglets Clients et Services
  103 |     await expect(page.locator('nav button:has-text("Clients")')).toBeHidden();
  104 |     await expect(page.locator('nav button:has-text("Services")')).toBeHidden();
  105 | 
  106 |     // 2. Vérification par accès direct URL à /clients : absence du bouton "Nouveau client"
  107 |     await page.goto('/clients');
  108 |     await expect(page.getByRole('button', { name: /Nouveau client/i })).toBeHidden();
  109 | 
  110 |     // 3. Vérification par accès direct URL à /services : absence du bouton "Nouveau service"
```