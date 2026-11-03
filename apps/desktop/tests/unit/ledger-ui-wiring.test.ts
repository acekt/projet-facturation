import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Ledger UI Wiring', () => {
  const pagesDir = path.resolve(__dirname, '../../components/pages')
  const layoutDir = path.resolve(__dirname, '../../components/layout')

  it('should have ledger components existing on disk', () => {
    expect(fs.existsSync(path.join(pagesDir, 'ledger.tsx'))).toBe(true)
    expect(fs.existsSync(path.join(pagesDir, 'ledger/LedgerEntryDialog.tsx'))).toBe(true)
  })

  it('should contain required texts and components in ledger.tsx', () => {
    const ledgerContent = fs.readFileSync(path.join(pagesDir, 'ledger.tsx'), 'utf-8')
    expect(ledgerContent).toContain('Livre des Comptes')
    expect(ledgerContent).toContain('Nouvelle Recette')
    expect(ledgerContent).toContain('Nouvelle Dépense')
    expect(ledgerContent).toContain('Sorties / Dépenses')
    expect(ledgerContent).toContain('Entrées / Recettes')
    expect(ledgerContent).toContain('getLedgerEntriesAction')
    expect(ledgerContent).toContain('<CreationSuccessModal')
  })

  it('should integrate Ledger in navigation', () => {
    const navContent = fs.readFileSync(path.join(layoutDir, 'navigation.tsx'), 'utf-8')
    expect(navContent).toContain('Livre des comptes')
    expect(navContent).toContain('id: "ledger"')
  })

  it('should integrate LedgerPage in protected-app-shell', () => {
    const shellContent = fs.readFileSync(path.join(pagesDir, 'protected-app-shell.tsx'), 'utf-8')
    expect(shellContent).toContain('LedgerPage')
    expect(shellContent).toContain('"ledger"')
  })
})
