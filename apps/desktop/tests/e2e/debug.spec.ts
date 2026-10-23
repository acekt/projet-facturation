import { test, expect } from '@playwright/test';

test('debug login', async ({ page }) => {
  page.on('response', async res => {
    if (res.url().includes('login')) {
       console.log('Login Response Status:', res.status());
       console.log('Login Response Body:', await res.text());
    }
  });

  await page.goto('http://localhost:3050/login');
  await page.fill('#username', 'admin@facturier.ga');
  await page.fill('#password', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
});
