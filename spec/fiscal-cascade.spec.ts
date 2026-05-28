import { describe, it, expect } from 'vitest'

// Taux de la fiscalité gabonaise
const GABON_CSS_RATE = 0.01 // 1% de CSS (Contribution Spéciale de Solidarité)
const GABON_TVA_RATE = 0.18 // 18% de TVA (Taxe sur la Valeur Ajoutée)

// Fonction pure simulant la cascade fiscale DGI du système
function computeGabonFiscalCascade(subtotal: number, discount: number) {
  const netHT = Math.max(0, subtotal - Math.round(discount))
  const cssAmount = Math.round(netHT * GABON_CSS_RATE)
  const taxBase = netHT + cssAmount
  const tvaAmount = Math.round(taxBase * GABON_TVA_RATE)
  const total = netHT + cssAmount + tvaAmount
  
  return {
    netHT,
    cssAmount,
    taxBase,
    tvaAmount,
    total
  }
}

describe('Cascade Fiscale Gabonaise (Règles DGI Gabon)', () => {
  it('devrait calculer la cascade standard sur 1 000 000 FCFA avec 100 000 FCFA de remise', () => {
    const subtotal = 1000000
    const discount = 100000
    
    const results = computeGabonFiscalCascade(subtotal, discount)
    
    // Net HT = 1 000 000 - 100 000 = 900 000 FCFA
    expect(results.netHT).toBe(900000)
    
    // CSS = 900 000 * 1% = 9 000 FCFA
    expect(results.cssAmount).toBe(9000)
    
    // Base taxable à la TVA = Net HT (900 000) + CSS (9 000) = 909 000 FCFA
    expect(results.taxBase).toBe(909000)
    
    // TVA = 909 000 * 18% = 163 620 FCFA
    expect(results.tvaAmount).toBe(163620)
    
    // Total TTC = Base taxable (909 000) + TVA (163 620) = 1 072 620 FCFA
    expect(results.total).toBe(1072620)
  })

  it('devrait gérer correctement les arrondis à l\'entier FCFA', () => {
    const subtotal = 543210 // Montant complexe
    const discount = 12345
    
    const results = computeGabonFiscalCascade(subtotal, discount)
    
    // Net HT = 543 210 - 12 345 = 530 865 FCFA
    expect(results.netHT).toBe(530865)
    
    // CSS = 530 865 * 1% = 5 308.65 => arrondi à 5 309 FCFA
    expect(results.cssAmount).toBe(5309)
    
    // Base taxable = 530 865 + 5 309 = 536 174 FCFA
    expect(results.taxBase).toBe(536174)
    
    // TVA = 536 174 * 18% = 96 511.32 => arrondi à 96 511 FCFA
    expect(results.tvaAmount).toBe(96511)
    
    // Total TTC = 536 174 + 96 511 = 632 685 FCFA
    expect(results.total).toBe(632685)
  })

  it('devrait retourner zéro si le montant brut HT est à zéro', () => {
    const results = computeGabonFiscalCascade(0, 0)
    expect(results.netHT).toBe(0)
    expect(results.cssAmount).toBe(0)
    expect(results.taxBase).toBe(0)
    expect(results.tvaAmount).toBe(0)
    expect(results.total).toBe(0)
  })
})
