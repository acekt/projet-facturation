import * as z from "zod";

export const clientSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Adresse email invalide"),
  phone: z.string().optional().refine(val => !val || val.length >= 6, "Numéro de téléphone invalide"),
  address: z.string().optional().refine(val => !val || val.length >= 5, "L'adresse doit contenir au moins 5 caractères"),
});

export const invoiceItemSchema = z.object({
  id: z.string(),
  description: z.string().min(1, "La description est requise"),
  quantity: z.number().min(0.01, "La quantité doit être supérieure à 0"),
  unitPrice: z.number().min(0, "Le prix unitaire ne peut pas être négatif"),
  total: z.number(),
});

export const invoiceSchema = z.object({
  clientId: z.string().min(1, "Client requis"),
  clientName: z.string(),
  clientEmail: z.string(),
  subtotal: z.number().min(0),
  discount: z.number().min(0),
  taxBase: z.number().min(0),
  tpsAmount: z.number().min(0).optional(),
  tvaAmount: z.number().min(0),
  cssAmount: z.number().min(0),
  total: z.number().min(0),
  status: z.enum(['PAID', 'PARTIALLY_PAID', 'UNPAID', 'overdue', 'draft', 'cancelled', 'pending']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date invalide"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date d'échéance invalide"),
  items: z.array(invoiceItemSchema).min(1, "Au moins un article est requis"),
  notes: z.string().optional(),
  quoteId: z.string().optional(),
});

export const quoteSchema = z.object({
  clientId: z.string().min(1, "Client requis"),
  clientName: z.string(),
  clientEmail: z.string(),
  subtotal: z.number().min(0),
  discount: z.number().min(0),
  taxBase: z.number().min(0),
  tpsAmount: z.number().min(0).optional(),
  tvaAmount: z.number().min(0),
  cssAmount: z.number().min(0),
  total: z.number().min(0),
  status: z.enum(['draft', 'sent', 'invoiced', 'rejected']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date invalide"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date d'échéance invalide"),
  items: z.array(invoiceItemSchema).min(1, "Au moins un article est requis"),
  notes: z.string().optional(),
});

export const settingsSchema = z.object({
  companyName: z.string().min(1),
  legalForm: z.string().min(1),
  nif: z.string(),
  rccm: z.string(),
  address: z.string(),
  email: z.string().email(),
  phone: z.string(),
  bankName: z.string(),
  bankAgency: z.string(),
  accountNumber: z.string(),
  swiftCode: z.string(),
  iban: z.string(),
  tvaRate: z.number().min(0),
  tpsRate: z.number().min(0).optional(),
  cssRate: z.number().min(0),
  sessionTimeout: z.number().min(1),
  invoicePrefix: z.string().min(1),
  quotePrefix: z.string().min(1),
  companyCode: z.string().min(1),
  mentionsLegales: z.string().nullable().optional(),
  logo: z.string().nullable().optional(),
});

export const serviceSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  description: z.string().optional(),
  category: z.string().optional(),
  unitPrice: z.number().min(0, "Le prix ne peut pas être négatif"),
});

// ============================================================================
// AUTHENTICATION SCHEMAS
// ============================================================================

export const loginSchema = z.object({
  username: z.string().min(1, "L'identifiant est requis"),
  password: z.string().min(1, "Le mot de passe est requis"),
});

// ============================================================================
// USER SCHEMAS
// ============================================================================

export const userCreateSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Adresse email invalide"),
  username: z.string().min(1, "L'identifiant est requis"),
  role: z.enum(['admin', 'user']),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  phone: z.string().optional(),
  force_password_change: z.boolean().default(true),
  is_active: z.boolean().default(true),
});

export const userUpdateSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Adresse email invalide"),
  role: z.enum(['admin', 'user']),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères").optional(),
  phone: z.string().optional(),
  force_password_change: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

// ============================================================================
// PAYMENT SCHEMAS
// ============================================================================

export const paymentCreateSchema = z.object({
  invoiceId: z.string().min(1, "L'ID de la facture est requis"),
  amount: z.number().min(0.01, "Le montant doit être supérieur à 0"),
  paymentMethod: z.string().min(1, "La méthode de paiement est requise"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date invalide (YYYY-MM-DD)"),
  reference: z.string().optional(),
});
