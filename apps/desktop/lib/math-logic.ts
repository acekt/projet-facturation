// lib/math-logic.ts
export {
  type ITaxRates,
  type ITaxSelectionOptions,
  type IInvoiceItemInput,
  type IComputedTotals,
  type IRegimeTotals,
  type TaxRegime,
  type TaxRates,
  type InvoiceItemInput,
  type ComputedTotals,
  computeItemTotal,
  computeTotals,
  calculateGabonTaxes,
  computeTotalsByRegime,
} from '@workspace/database/fiscal';
