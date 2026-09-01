# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: navigation\1-auth.spec.ts >> Navigation Phase 1 : Onboarding et Authentification >> Accès initial : redirection vers /setup si la base est vierge
- Location: tests\e2e\navigation\1-auth.spec.ts:21:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Informations de l\'Administrateur' })
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for getByRole('heading', { name: 'Informations de l\'Administrateur' })

```

```yaml
- text: L'ÉTOILE Gestion Gabonaise
- heading "Gerez votre facturation avec excellence." [level=2]
- paragraph: La solution locale et conforme pour piloter vos devis, factures, règlements et avoirs en toute sérénité au Gabon.
- heading "Conformité DGI locale" [level=4]
- paragraph: Calcul strict des taxes TVA, TPS et CSS
- heading "Résilience 100% Hors-Ligne" [level=4]
- paragraph: Base SQLite locale ultra-rapide et sécurisée
- heading "Suivi financier instantané" [level=4]
- paragraph: Tableaux de bord et état des paiements en temps réel
- paragraph: © 2026 L'Étoile S.A. Tous droits réservés.
- heading "Bon retour parmi nous" [level=1]
- paragraph: Entrez vos identifiants pour accéder à votre espace de gestion.
- text: Identifiant ou Email
- textbox "Identifiant ou Email":
  - /placeholder: nom@letoile.ga
- text: Mot de passe
- button "Mot de passe oublié ?"
- textbox "Mot de passe":
  - /placeholder: ••••••••
- button
- button "Se connecter"
- text: ou
- button "Utiliser un compte de démonstration"
- text: Connexion locale sécurisée • Chiffrement cryptographique
- region "Notifications alt+T"
- alert
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import fs from 'fs';
  3   | import path from 'path';
  4   | 
  5   | test.describe('Navigation Phase 1 : Onboarding et Authentification', () => {
  6   | 
  7   |   // Ce hook s'assure qu'on part d'une base vierge avant chaque test de setup
  8   | 
  9   |   test.beforeEach(async ({ request }) => {
  10  |     const res = await request.post('/api/e2e-reset', {
  11  |       headers: {
  12  |         'Authorization': `Bearer super-secret-key-for-playwright-e2e-tests-32-chars!!`
  13  |       }
  14  |     });
  15  |     if (!res.ok) {
  16  |       console.error('Failed to reset DB:', await res.text());
  17  |     }
  18  |   });
  19  | 
  20  | 
  21  |   test('Accès initial : redirection vers /setup si la base est vierge', async ({ page }) => {
  22  |     // L'application n'a pas encore de configuration
  23  |     await page.goto('/');
  24  | 
  25  |     // Attendre la redirection
> 26  |     await expect(page.getByRole('heading', { name: "Informations de l'Administrateur" })).toBeVisible({ timeout: 15000 });
      |                                                                                           ^ Error: expect(locator).toBeVisible() failed
  27  |     await expect(page.getByRole('button', { name: 'Étape suivante : Profil Entreprise' })).toBeVisible();
  28  |   });
  29  | 
  30  |   test('Flux de Setup complet et redirection vers /dashboard', async ({ page }) => {
  31  |     await page.goto('/setup');
  32  | 
  33  |     // Étape 1 : Admin
  34  |     await page.getByLabel('Nom complet *').fill('Admin Test');
  35  |     await page.getByLabel('Adresse email *').fill('admin@test.com');
  36  |     await page.getByLabel('Mot de passe (min. 6 caractères) *').fill('password123');
  37  |     await page.getByRole('button', { name: 'Étape suivante : Profil Entreprise' }).click();
  38  | 
  39  |     // Étape 2 : Entreprise
  40  |     await expect(page.getByRole('heading', { name: "Informations de l'Entreprise" })).toBeVisible();
  41  |     await page.getByLabel("Nom de l'entreprise *").fill('Entreprise Test');
  42  | 
  43  |     // Validation du setup
  44  |     const responsePromise = page.waitForResponse(response => response.url().includes('/api/setup') && response.status() === 201);
  45  |     await page.getByRole('button', { name: "Initialiser L'Étoile et se connecter" }).click();
  46  |     await responsePromise;
  47  | 
  48  |     // Vérifier la redirection
  49  |     await expect(page.getByRole('heading', { name: /Tableau de Bord/i })).toBeVisible({ timeout: 15000 });
  50  |   });
  51  | 
  52  |   test('Login avec succès et Logout', async ({ page }) => {
  53  |     // D'abord, on effectue le setup pour avoir un compte
  54  |     await page.goto('/setup');
  55  |     await page.getByLabel('Nom complet *').fill('Admin Test 2');
  56  |     await page.getByLabel('Adresse email *').fill('admin2@test.com');
  57  |     await page.getByLabel('Mot de passe (min. 6 caractères) *').fill('password123');
  58  |     await page.getByRole('button', { name: 'Étape suivante : Profil Entreprise' }).click();
  59  |     await page.getByLabel("Nom de l'entreprise *").fill('Entreprise Test 2');
  60  |     await page.getByRole('button', { name: "Initialiser L'Étoile et se connecter" }).click();
  61  |     await page.waitForURL('**/dashboard');
  62  | 
  63  |     // Maintenant, on se déconnecte
  64  |     // Le bouton de déconnexion est typiquement dans la sidebar ou le header
  65  |     // Cherchons-le et cliquons dessus
  66  |     await page.getByRole('button', { name: /déconnexion/i }).click();
  67  | 
  68  |     // Vérifier la redirection vers login
  69  |     await page.waitForURL('**/login');
  70  | 
  71  |     // Tenter de se connecter avec des mauvais identifiants
  72  |     await expect(page.getByRole('heading', { name: 'Bon retour parmi nous' })).toBeVisible({ timeout: 15000 });
  73  |     await page.getByLabel('Identifiant ou Email').fill('admin2@test.com');
  74  |     await page.getByLabel('Mot de passe', { exact: true }).fill('wrongpassword');
  75  |     await page.getByRole('button', { name: 'Se connecter' }).click();
  76  | 
  77  |     // Vérifier qu'on reste sur la page et qu'un message d'erreur apparait (le toast de Shadcn/Sonner)
  78  |     await expect(page.getByText(/invalides|incorrect/i)).toBeVisible({ timeout: 15000 });
  79  |     await expect(page).toHaveURL(/.*\/login/);
  80  | 
  81  |     // Tenter de se connecter avec les bons identifiants
  82  |     await page.getByLabel('Mot de passe (min. 6 caractères) *').fill('password123');
  83  |     await page.getByRole('button', { name: 'Se connecter' }).click();
  84  | 
  85  |     // Vérifier la redirection vers dashboard
  86  |     await expect(page.getByRole('heading', { name: /Tableau de Bord/i })).toBeVisible({ timeout: 15000 });
  87  |   });
  88  | 
  89  |   test('Accès initial : redirection vers /login si la base est configurée', async ({ page }) => {
  90  |     // 1. Initialiser l'application
  91  |     await page.goto('/setup');
  92  |     await page.getByLabel('Nom complet *').fill('Admin Configuré');
  93  |     await page.getByLabel('Adresse email *').fill('admin3@test.com');
  94  |     await page.getByLabel('Mot de passe (min. 6 caractères) *').fill('password123');
  95  |     await page.getByRole('button', { name: 'Étape suivante : Profil Entreprise' }).click();
  96  |     await page.getByLabel("Nom de l'entreprise *").fill('Entreprise Test 3');
  97  |     await page.getByRole('button', { name: "Initialiser L'Étoile et se connecter" }).click();
  98  |     await page.waitForURL('**/dashboard');
  99  | 
  100 |     // 2. Se déconnecter pour effacer le cookie de session de ce contexte
  101 |     await page.getByRole('button', { name: /déconnexion/i }).click();
  102 |     await page.waitForURL('**/login');
  103 | 
  104 |     // 3. Essayer d'aller à la racine (qui devrait rediriger vers login car non connecté et déjà setup)
  105 |     await page.goto('/');
  106 | 
  107 |     // Vérifier la redirection
  108 |     await expect(page.getByRole('heading', { name: 'Bon retour parmi nous' })).toBeVisible({ timeout: 15000 });
  109 | 
  110 |     // 4. Essayer d'aller au setup alors qu'on est déjà configuré
  111 |     await page.goto('/setup');
  112 |     // Le serveur renverra probablement vers login ou affichera une erreur, selon l'implémentation.
  113 |     // L'implémentation actuelle renvoie vers login car on n'est pas authentifié et l'app est setup.
  114 |     await page.waitForURL('**/login');
  115 |   });
  116 | });
  117 | 
```