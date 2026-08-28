# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: user-journey\3-transactions.spec.ts >> Phase 3 : User Journey (Transaction Operator) >> Parcours Opérateur complet (Devis -> Facture -> Paiement)
- Location: tests\e2e\user-journey\3-transactions.spec.ts:67:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: /Aperçu du Facture - FAC-/ })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByRole('heading', { name: /Aperçu du Facture - FAC-/ })

```

```yaml
- complementary:
  - text: L'ÉTOILE Opérations
  - button "Nouveau devis"
  - paragraph: Système
  - button "Tableau de bord"
  - paragraph: Opérations
  - button "Devis"
  - button "Factures"
  - button "Paiements"
  - button "Avoirs"
  - button "Paramètres"
  - text: JO
  - paragraph: John Operator
  - button "Déconnexion"
  - button
- banner:
  - button "Rechercher... K"
  - button "Basculer le theme"
  - button
- heading "Command Palette" [level=2]
- paragraph: Search for a command to run...
- main:
  - heading "Factures" [level=1]
  - paragraph: Gérez vos factures et suivez vos paiements
  - button "Export CSV"
  - button "Nouvelle Facture"
  - textbox "Rechercher une facture..."
  - button
  - button
  - button
  - table:
    - rowgroup:
      - row "Facture Client Date Statut Total Actions":
        - columnheader "Facture"
        - columnheader "Client"
        - columnheader "Date"
        - columnheader "Statut"
        - columnheader "Total"
        - columnheader "Actions"
    - rowgroup:
      - 'row "FAC-001/null/2026 Client Phase 3 25/08/2026 Partiel — Payé: 50 000 FCFA | Reste: 114 250 FCFA 164 250 FCFA"':
        - cell "FAC-001/null/2026"
        - cell "Client Phase 3"
        - cell "25/08/2026"
        - 'cell "Partiel — Payé: 50 000 FCFA | Reste: 114 250 FCFA"'
        - cell "164 250 FCFA"
        - cell:
          - button
  - button "Fermer l'aperçu"
  - text: Facture N° FAC-001/null/2026
  - button
  - button "100%"
  - button
  - button "Imprimer"
  - button "Télécharger PDF"
  - text: LOGO
  - paragraph: Phase 3 Corp
  - paragraph: FACTURE
  - paragraph: N° FAC-FAC-001/null/2026
  - paragraph: "Date d'émission : 25/08/2026"
  - paragraph: Émetteur
  - paragraph: Phase 3 Corp
  - paragraph: Destinataire
  - paragraph: Client Phase 3
  - paragraph: client@phase3.com
  - paragraph: "Objet : Prestations de services"
  - table:
    - rowgroup:
      - row "Désignation Qté P.U (HT) Total (HT)":
        - columnheader "Désignation"
        - columnheader "Qté"
        - columnheader "P.U (HT)"
        - columnheader "Total (HT)"
    - rowgroup:
      - row "Consulting IT Gabonese 1 150 000 FCFA 150 000 FCFA":
        - cell "Consulting IT Gabonese"
        - cell "1"
        - cell "150 000 FCFA"
        - cell "150 000 FCFA"
      - row:
        - cell
        - cell
        - cell
      - row:
        - cell
        - cell
        - cell
      - row:
        - cell
        - cell
        - cell
      - row:
        - cell
        - cell
        - cell
      - row:
        - cell
        - cell
        - cell
      - row:
        - cell
        - cell
        - cell
      - row:
        - cell
        - cell
        - cell
  - paragraph: Coordonnées pour Virement Bancaire
  - paragraph: "Règlement : Espèces · Chèques · Virements"
  - paragraph: "Délais : Au comptant"
  - paragraph: La Direction
  - paragraph: Cachet & Signature
  - text: Brut HT 150 000 FCFA Net HT 150 000 FCFA CSS (1%) 0 FCFA TPS (9.5%) 14 250 FCFA TVA (18%) 0 FCFA Total TTC 164 250 FCFA Réglé 50 000 FCFA Reste à Payer 114 250 FCFA
  - paragraph: Phase 3 Corp
  - paragraph: DGI-VAL-1B73-9175-742
- region "Notifications alt+T"
- alert
```

# Test source

```ts
  42  |     const bcrypt = require('bcryptjs');
  43  |     const operatorId = crypto.randomUUID();
  44  |     const operatorHash = bcrypt.hashSync('operator123', 10);
  45  |     db.prepare(`
  46  |       INSERT INTO users (id, username, email, password, role, name, is_active, created_at)
  47  |       VALUES (?, ?, ?, ?, 'user', ?, 1, CURRENT_TIMESTAMP)
  48  |     `).run(operatorId, 'operator@phase3.com', 'operator@phase3.com', operatorHash, 'John Operator');
  49  | 
  50  |     // SEED CLIENT IN DB SO OPERATOR DOES NOT NEED TO ACCESS /clients
  51  |     const clientId = crypto.randomUUID();
  52  |     db.prepare(`
  53  |       INSERT INTO clients (id, name, email, phone, address, status, createdAt)
  54  |       VALUES (?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
  55  |     `).run(clientId, 'Client Phase 3', 'client@phase3.com', '', '');
  56  | 
  57  |     // SEED A SERVICE TO AVOID UI ISSUES
  58  |     const serviceId = crypto.randomUUID();
  59  |     db.prepare(`
  60  |       INSERT INTO services (id, name, description, category, unitPrice, createdAt)
  61  |       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  62  |     `).run(serviceId, 'Consulting IT Gabonese', 'Prestation de conseil IT et architecture', 'Consulting', 150000);
  63  | 
  64  |     db.close();
  65  |   });
  66  | 
  67  |   test('Parcours Opérateur complet (Devis -> Facture -> Paiement)', async ({ page }) => {
  68  |     await page.goto('/login');
  69  | 
  70  |     await expect(page).toHaveURL(/.*\/login/);
  71  | 
  72  |     await page.getByLabel('Identifiant ou Email').fill('operator@phase3.com');
  73  |     await page.getByLabel('Mot de passe', { exact: true }).fill('operator123');
  74  |     await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  75  | 
  76  |     await expect(page).toHaveURL('/', { timeout: 15000 });
  77  | 
  78  |     await expect(page.getByRole('heading', { name: 'Tableau de Bord', exact: true })).toBeVisible({ timeout: 15000 });
  79  | 
  80  |     // Go straight to Devis
  81  |     await page.getByRole('button', { name: 'Devis', exact: true }).click();
  82  |     await expect(page.getByRole('heading', { name: 'Devis', exact: true })).toBeVisible();
  83  | 
  84  |     // Select the button that is inside the empty state to avoid resolving to both header and empty state
  85  |     await page.locator('.border-dashed').getByRole('button', { name: 'Nouveau devis', exact: true }).click();
  86  | 
  87  |     await page.getByText('Sélectionner un client').click();
  88  |     const clientDialog = page.locator('[role="dialog"]:has-text("Rechercher un client")');
  89  |     await expect(clientDialog).toBeVisible();
  90  |     await clientDialog.getByText('Client Phase 3').click();
  91  | 
  92  |     await page.getByText('Sélectionner un service...').click();
  93  |     await page.getByRole('option', { name: 'Consulting IT Gabonese' }).click();
  94  | 
  95  |     // 1. Intégrité Financière (Devis) : Vérifier que le montant total s'affiche à l'écran (avec regex pour gérer l'espace insécable potentiel)
  96  |     await expect(page.getByText(/164\s*250\s*FCFA/)).toBeVisible();
  97  | 
  98  |     await page.getByRole('button', { name: 'Enregistrer le Devis', exact: true }).click();
  99  |     await expect(page.locator('text=Devis enregistré avec succès')).toBeVisible({ timeout: 10000 });
  100 | 
  101 |     // Conversion en facture
  102 |     // Quotes list, wait for item to appear
  103 |     await expect(page.locator('text=Client Phase 3')).toBeVisible();
  104 |     // Since there is only one item in the list and we want to click its row's menu:
  105 |     // We target the table cell or the direct button inside the row.
  106 |     // The button has a MoreVertical icon, no visible text label ("Actions du document" might not be its actual name).
  107 |     // The previous timeout occurred because `name: 'Actions du document'` didn't match anything.
  108 |     await page.locator('table').locator('tr').filter({ hasText: 'Client Phase 3' }).getByRole('button').click();
  109 |     await page.getByRole('menuitem', { name: 'Convertir en facture' }).click();
  110 | 
  111 |     // 2. Feedback Utilisateur (Conversion) : Toast de succès
  112 |     await expect(page.locator('text=Devis converti en facture avec succès')).toBeVisible();
  113 | 
  114 |     await page.getByRole('button', { name: 'Factures', exact: true }).click();
  115 |     await expect(page.getByRole('heading', { name: 'Factures', exact: true })).toBeVisible();
  116 | 
  117 |     await expect(page.locator('text=Client Phase 3')).toBeVisible();
  118 |     await page.locator('table').locator('tr').filter({ hasText: 'Client Phase 3' }).getByRole('button').click();
  119 |     await page.getByRole('menuitem', { name: 'Enregistrer un règlement' }).click();
  120 | 
  121 |     const paymentDialog = page.locator('[role="dialog"]:has-text("Confirmer le règlement")');
  122 |     await expect(paymentDialog).toBeVisible();
  123 | 
  124 |     // Multiple comboboxes might exist (Type of payment, Payment method)
  125 |     // Select the first one (Type of payment)
  126 |     await paymentDialog.getByRole('combobox').first().click();
  127 |     await page.getByRole('option', { name: 'Acompte / Partiel', exact: true }).click();
  128 | 
  129 |     await paymentDialog.locator('#payment-amount').fill('50000');
  130 | 
  131 |     await paymentDialog.getByRole('button', { name: 'Valider l\'encaissement', exact: true }).click();
  132 |     await expect(page.locator('text=Paiement enregistré')).toBeVisible({ timeout: 10000 });
  133 | 
  134 |     // Check partial status (the badge has label "Partiel — Payé: X | Reste: Y")
  135 |     await expect(page.getByText(/Partiel\s*—\s*Payé/)).toBeVisible();
  136 | 
  137 |     // We can open the invoice to view details
  138 |     await page.locator('table').locator('tr').filter({ hasText: 'Client Phase 3' }).getByRole('button').click();
  139 |     await page.getByRole('menuitem', { name: 'Aperçu' }).click();
  140 | 
  141 |     // 3. Traçabilité (Facture) : numéro de la facture dans l'en-tête (Dialog title ou composant d'aperçu)
> 142 |     await expect(page.getByRole('heading', { name: /Aperçu du Facture - FAC-/ })).toBeVisible();
      |                                                                                   ^ Error: expect(locator).toBeVisible() failed
  143 | 
  144 |     // 4. Cohérence des Paiements : Reste à payer mis à jour
  145 |     // 164 250 - 50 000 = 114 250 FCFA
  146 |     await expect(page.getByText('RESTE À PAYER', { exact: true })).toBeVisible();
  147 |     await expect(page.getByRole('dialog').getByText('114\u202F250 FCFA', { exact: true }).first()).toBeVisible();
  148 |   });
  149 | });
  150 | 
```