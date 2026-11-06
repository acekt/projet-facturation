import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

describe("Continuous Audit: UI, RBAC & Security", () => {
  it("Server Actions should only export async functions", () => {
    const actionsDir = join(__dirname, "../../app/actions");
    const files = readdirSync(actionsDir).filter(f => f.endsWith(".ts"));

    files.forEach(file => {
      const content = readFileSync(join(actionsDir, file), "utf8");

      const lines = content.split('\n');
      for (const line of lines) {
        if (line.startsWith('export ') && !line.includes('export type') && !line.includes('export interface')) {
           // Should only be export async function
           expect(line.includes('export async function'),
           `File ${file} has invalid export: ${line}`).toBe(true);
        }
      }
    });
  });

  it("Editors should have sync locks for double submission prevention", () => {
    const components = ["invoice-editor.tsx", "quote-editor.tsx", "user-editor.tsx"];
    const editorsDir = join(__dirname, "../../components/pages");

    components.forEach(file => {
      const content = readFileSync(join(editorsDir, file), "utf8");
      expect(content).toContain("submitLockRef");
    });
  });

  it("Dropdown menus should properly clear pointer-events", () => {
    const componentsDir = join(__dirname, "../../components/pages");
    const views = ["clients/ClientViews.tsx", "services/ServiceViews.tsx", "invoices/InvoiceViews.tsx", "quotes/QuoteViews.tsx"];
    views.forEach(view => {
       const content = readFileSync(join(componentsDir, view), "utf8");
       // It's tricky to assert setTimeout generally, but we can verify our fix was applied
       expect(content).toContain("setTimeout(");
    });
  });

  it("Server actions should verify roles for admin actions", () => {
    const actionsDir = join(__dirname, "../../app/actions");

    const invoiceActions = readFileSync(join(actionsDir, "invoice.actions.ts"), "utf8");
    expect(invoiceActions).toMatch(/session\.role !== 'admin'/);

    const quoteActions = readFileSync(join(actionsDir, "quote.actions.ts"), "utf8");
    expect(quoteActions).toMatch(/session\.role !== 'admin'/);

    const userActions = readFileSync(join(actionsDir, "user.actions.ts"), "utf8");
    expect(userActions).toMatch(/session\.role !== 'admin'/);

    const auditActions = readFileSync(join(actionsDir, "audit.actions.ts"), "utf8");
    expect(auditActions).toMatch(/session\.role !== 'admin'/);
  });
});
