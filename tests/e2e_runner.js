const { chromium } = require('playwright');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3050;
const URL = `http://localhost:${PORT}`;
const SCREENSHOT_DIR = path.join('C:', 'Users', 'LENOVO', '.gemini', 'antigravity', 'brain', 'a645faa8-9665-4697-b108-c833fdc25c39', 'screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function waitServer(timeout = 45000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(() => {
      if (Date.now() - start > timeout) {
        clearInterval(interval);
        reject(new Error('Next.js dev server failed to start within timeout'));
      }
      http.get(`${URL}/login`, (res) => {
        if (res.statusCode === 200 || res.statusCode === 302) {
          clearInterval(interval);
          resolve();
        }
      }).on('error', () => {
        // Keep waiting
      });
    }, 1500);
  });
}

async function run() {
  console.log('🚀 Starting Next.js Dev Server...');
  const server = spawn('npm', ['run', 'dev'], {
    shell: true,
    env: { ...process.env, PORT: PORT.toString() }
  });

  server.stdout.on('data', (data) => {
    // console.log(`[Next.js] ${data}`);
  });

  server.stderr.on('data', (data) => {
    console.error(`[Next.js Error] ${data}`);
  });

  let browser;
  try {
    await waitServer();
    console.log('✅ Next.js Dev Server is ready!');

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 }
    });
    const page = await context.newPage();

    // ==========================================
    // 1. ADMIN USER E2E AUDIT
    // ==========================================
    console.log('🔑 Navigating to Login Page...');
    await page.goto(`${URL}/login`);
    await page.waitForSelector('#username');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_login_page.png') });

    console.log('🔑 Logging in as Admin...');
    await page.fill('#username', 'admin@lfacturier.ga');
    await page.fill('#password', 'admin123');
    await page.click('button[type="submit"]');

    console.log('📊 Verifying Admin Strategic Dashboard...');
    await page.waitForURL(`${URL}/`);
    await page.waitForTimeout(2000); // Wait for animations
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_admin_dashboard.png') });

    console.log('👥 Verifying Users Page...');
    await page.click('button:has-text("Utilisateurs")');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_admin_users.png') });

    console.log('📜 Verifying Audit Logs Page...');
    await page.click('button:has-text("Journal Audit")');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_admin_audit_logs.png') });

    console.log('🔑 Logging out Admin...');
    await page.click('text=Déconnexion');
    await page.waitForURL(`${URL}/login`);

    // ==========================================
    // 2. STANDARD OPERATOR USER E2E AUDIT
    // ==========================================
    console.log('🔑 Logging in as Standard Operator...');
    await page.fill('#username', 'user@lfacturier.ga');
    await page.fill('#password', 'admin123');
    await page.click('button[type="submit"]');

    console.log('📊 Verifying User Operational Dashboard...');
    await page.waitForURL(`${URL}/`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_user_dashboard.png') });

    console.log('📝 Navigating to Quotes List...');
    await page.click('button:has-text("Devis")');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_quotes_list.png') });

    console.log('➕ Creating a New Quote...');
    await page.click('button:has-text("Nouveau devis")');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_quote_editor_empty.png') });

    console.log('👤 Selecting Client in Dialog...');
    await page.click('text=Sélectionner un client');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07_5_client_search_modal.png') });
    await page.waitForSelector('text=CGA Gabon');
    await page.click('text=CGA Gabon');
    await page.waitForTimeout(500);

    console.log('💼 Selecting Service Split AC Maintenance...');
    await page.click('text=Sélectionner un service...');
    await page.click('text=Maintenance Climatisation Split');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08_quote_editor_filled.png') });

    console.log('💾 Saving Quote as Draft...');
    await page.click('text=Enregistrer en brouillon');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09_quotes_list_with_draft.png') });

    console.log('🎉 E2E Audit Completed Successfully!');

  } catch (error) {
    console.error('❌ E2E Audit Failed:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
    console.log('🛑 Shutting down Next.js Server...');
    server.kill();
    process.exit(0);
  }
}

run();
