import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Navigation Phase 1 : Onboarding et Authentification', () => {

  // Ce hook s'assure qu'on part d'une base vierge avant chaque test de setup

  test.beforeEach(async ({ request }) => {
    const res = await request.post('/api/e2e-reset', {
      headers: {
        'Authorization': `Bearer super-secret-key-for-playwright-e2e-tests-32-chars!!`
      }
    });
    if (!res.ok) {
      console.error('Failed to reset DB:', await res.text());
    }
  });


  test('Accès initial : redirection vers /setup si la base est vierge', async ({ page }) => {
    // L'application n'a pas encore de configuration
    await page.goto('/');

    // Attendre la redirection
    await expect(page.getByRole('heading', { name: "Informations de l'Administrateur" })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Étape suivante : Profil Entreprise' })).toBeVisible();
  });

  test('Flux de Setup complet et redirection vers /dashboard', async ({ page }) => {
    await page.goto('/setup');

    // Étape 1 : Admin
    await page.getByLabel('Nom complet *').fill('Admin Test');
    await page.getByLabel('Adresse email *').fill('admin@test.com');
    await page.getByLabel('Mot de passe (min. 6 caractères) *').fill('password123');
    await page.getByRole('button', { name: 'Étape suivante : Profil Entreprise' }).click();

    // Étape 2 : Entreprise
    await expect(page.getByRole('heading', { name: "Informations de l'Entreprise" })).toBeVisible();
    await page.getByLabel("Nom de l'entreprise *").fill('Entreprise Test');

    // Validation du setup
    const responsePromise = page.waitForResponse(response => response.url().includes('/api/setup') && response.status() === 201);
    await page.getByRole('button', { name: "Initialiser Facturier et se connecter" }).click();
    await responsePromise;

    // Vérifier la redirection
    await expect(page.getByRole('heading', { name: /Tableau de Bord/i })).toBeVisible({ timeout: 15000 });
  });

  test('Login avec succès et Logout', async ({ page }) => {
    // D'abord, on effectue le setup pour avoir un compte
    await page.goto('/setup');
    await page.getByLabel('Nom complet *').fill('Admin Test 2');
    await page.getByLabel('Adresse email *').fill('admin2@test.com');
    await page.getByLabel('Mot de passe (min. 6 caractères) *').fill('password123');
    await page.getByRole('button', { name: 'Étape suivante : Profil Entreprise' }).click();
    await page.getByLabel("Nom de l'entreprise *").fill('Entreprise Test 2');
    await page.getByRole('button', { name: "Initialiser Facturier et se connecter" }).click();
    await page.waitForURL('**/dashboard');

    // Maintenant, on se déconnecte
    // Le bouton de déconnexion est typiquement dans la sidebar ou le header
    // Cherchons-le et cliquons dessus
    await page.getByRole('button', { name: /déconnexion/i }).click();

    // Vérifier la redirection vers login
    await page.waitForURL('**/login');

    // Tenter de se connecter avec des mauvais identifiants
    await expect(page.getByRole('heading', { name: 'Bon retour parmi nous' })).toBeVisible({ timeout: 15000 });
    await page.getByLabel('Identifiant ou Email').fill('admin2@test.com');
    await page.getByLabel('Mot de passe', { exact: true }).fill('wrongpassword');
    await page.getByRole('button', { name: 'Se connecter' }).click();

    // Vérifier qu'on reste sur la page et qu'un message d'erreur apparait (le toast de Shadcn/Sonner)
    await expect(page.getByText(/invalides|incorrect/i)).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveURL(/.*\/login/);

    // Tenter de se connecter avec les bons identifiants
    await page.getByLabel('Mot de passe (min. 6 caractères) *').fill('password123');
    await page.getByRole('button', { name: 'Se connecter' }).click();

    // Vérifier la redirection vers dashboard
    await expect(page.getByRole('heading', { name: /Tableau de Bord/i })).toBeVisible({ timeout: 15000 });
  });

  test('Accès initial : redirection vers /login si la base est configurée', async ({ page }) => {
    // 1. Initialiser l'application
    await page.goto('/setup');
    await page.getByLabel('Nom complet *').fill('Admin Configuré');
    await page.getByLabel('Adresse email *').fill('admin3@test.com');
    await page.getByLabel('Mot de passe (min. 6 caractères) *').fill('password123');
    await page.getByRole('button', { name: 'Étape suivante : Profil Entreprise' }).click();
    await page.getByLabel("Nom de l'entreprise *").fill('Entreprise Test 3');
    await page.getByRole('button', { name: "Initialiser Facturier et se connecter" }).click();
    await page.waitForURL('**/dashboard');

    // 2. Se déconnecter pour effacer le cookie de session de ce contexte
    await page.getByRole('button', { name: /déconnexion/i }).click();
    await page.waitForURL('**/login');

    // 3. Essayer d'aller à la racine (qui devrait rediriger vers login car non connecté et déjà setup)
    await page.goto('/');

    // Vérifier la redirection
    await expect(page.getByRole('heading', { name: 'Bon retour parmi nous' })).toBeVisible({ timeout: 15000 });

    // 4. Essayer d'aller au setup alors qu'on est déjà configuré
    await page.goto('/setup');
    // Le serveur renverra probablement vers login ou affichera une erreur, selon l'implémentation.
    // L'implémentation actuelle renvoie vers login car on n'est pas authentifié et l'app est setup.
    await page.waitForURL('**/login');
  });
});
