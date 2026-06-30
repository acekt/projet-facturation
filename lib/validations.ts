import * as z from "zod";

// ============================================================================
// CLIENT SCHEMAS
// ============================================================================

export const clientSchema = z.object({
  name: z.string()
    .min(2, "Le nom doit contenir au moins 2 caractères")
    .max(255, "Le nom ne peut pas dépasser 255 caractères"),
  email: z.string()
    .email("Adresse email invalide")
    .max(255, "L'email ne peut pas dépasser 255 caractères"),
  phone: z.string()
    .max(255, "Le numéro de téléphone ne peut pas dépasser 255 caractères")
    .optional()
    .refine(val => !val || val.length >= 6, "Numéro de téléphone invalide"),
  address: z.string()
    .max(1000, "L'adresse ne peut pas dépasser 1000 caractères")
    .optional()
    .refine(val => !val || val.length >= 5, "L'adresse doit contenir au moins 5 caractères"),
});

export const clientUpdateSchema = z.object({
  name: z.string()
    .min(2, "Le nom doit contenir au moins 2 caractères")
    .max(255, "Le nom ne peut pas dépasser 255 caractères"),
  email: z.string()
    .email("Adresse email invalide")
    .max(255, "L'email ne peut pas dépasser 255 caractères"),
  phone: z.string()
    .max(255, "Le numéro de téléphone ne peut pas dépasser 255 caractères")
    .optional()
    .refine(val => !val || val.length >= 6, "Numéro de téléphone invalide"),
  address: z.string()
    .max(1000, "L'adresse ne peut pas dépasser 1000 caractères")
    .optional()
    .refine(val => !val || val.length >= 5, "L'adresse doit contenir au moins 5 caractères"),
});

// ============================================================================
// ITEM SCHEMAS
// ============================================================================

export const invoiceItemSchema = z.object({
  id: z.string().max(255).optional(), // Optional: generated server-side for new invoices
  description: z.string()
    .min(1, "La description est requise")
    .max(1000, "La description ne peut pas dépasser 1000 caractères"),
  quantity: z.number().min(0.01, "La quantité doit être supérieure à 0"),
  unitPrice: z.number().min(0, "Le prix unitaire ne peut pas être négatif"),
  total: z.number().optional(), // Ignored server-side: computed from quantity × unitPrice
});

export const quoteItemSchema = z.object({
  description: z.string()
    .min(1, "La description est requise")
    .max(1000, "La description ne peut pas dépasser 1000 caractères"),
  quantity: z.number().min(0.01, "La quantité doit être supérieure à 0"),
  unitPrice: z.number().min(0, "Le prix unitaire ne peut pas être négatif"),
  total: z.number().optional(), // Ignored server-side: computed from quantity × unitPrice
});

// ============================================================================
// DOCUMENT SCHEMAS (INVOICE & QUOTE)
// ============================================================================

export const invoiceSchema = z.object({
  clientId: z.string()
    .min(1, "Client requis")
    .max(255),
  clientName: z.string()
    .max(255, "Le nom du client ne peut pas dépasser 255 caractères"),
  clientEmail: z.string()
    .max(255, "L'email du client ne peut pas dépasser 255 caractères"),
  discount: z.number().min(0).default(0),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date invalide"),
  items: z.array(invoiceItemSchema).min(1, "Au moins un article est requis"),
  notes: z.string()
    .max(5000, "Les notes ne peuvent pas dépasser 5000 caractères")
    .optional(),
  quoteId: z.string()
    .max(255)
    .optional(),
});

export const quoteSchema = z.object({
  clientId: z.string()
    .min(1, "Client requis")
    .max(255),
  clientName: z.string()
    .max(255, "Le nom du client ne peut pas dépasser 255 caractères"),
  clientEmail: z.string()
    .max(255, "L'email du client ne peut pas dépasser 255 caractères"),
  discount: z.number().min(0).default(0),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date invalide"),
  items: z.array(quoteItemSchema).min(1, "Au moins un article est requis"),
  notes: z.string()
    .max(5000, "Les notes ne peuvent pas dépasser 5000 caractères")
    .optional(),
});

// ============================================================================
// SETTINGS SCHEMA
// ============================================================================

export const settingsSchema = z.object({
  companyName: z.string()
    .min(1, "Le nom de l'entreprise est requis")
    .max(255, "Le nom de l'entreprise ne peut pas dépasser 255 caractères"),
  legalForm: z.string()
    .min(1, "La forme juridique est requise")
    .max(255, "La forme juridique ne peut pas dépasser 255 caractères"),
  nif: z.string().max(255, "Le NIF ne peut pas dépasser 255 caractères"),
  rccm: z.string().max(255, "Le RCCM ne peut pas dépasser 255 caractères"),
  address: z.string().max(1000, "L'adresse ne peut pas dépasser 1000 caractères"),
  email: z.string()
    .email("Adresse email invalide")
    .max(255, "L'email ne peut pas dépasser 255 caractères"),
  phone: z.string().max(255, "Le téléphone ne peut pas dépasser 255 caractères"),
  bankName: z.string().max(255, "Le nom de la banque ne peut pas dépasser 255 caractères"),
  bankAgency: z.string().max(255, "L'agence bancaire ne peut pas dépasser 255 caractères"),
  accountNumber: z.string().max(255, "Le numéro de compte ne peut pas dépasser 255 caractères"),
  swiftCode: z.string().max(255, "Le code SWIFT ne peut pas dépasser 255 caractères"),
  iban: z.string().max(255, "L'IBAN ne peut pas dépasser 255 caractères"),
  tvaRate: z.number().min(0),
  tpsRate: z.number().min(0).optional(),
  cssRate: z.number().min(0),
  sessionTimeout: z.number().min(1),
  invoicePrefix: z.string()
    .min(1, "Le préfixe de facture est requis")
    .max(255, "Le préfixe de facture ne peut pas dépasser 255 caractères"),
  quotePrefix: z.string()
    .min(1, "Le préfixe de devis est requis")
    .max(255, "Le préfixe de devis ne peut pas dépasser 255 caractères"),
  companyCode: z.string()
    .min(1, "Le code de l'entreprise est requis")
    .max(255, "Le code de l'entreprise ne peut pas dépasser 255 caractères"),
  mentionsLegales: z.string()
    .max(5000, "Les mentions légales ne peuvent pas dépasser 5000 caractères")
    .nullable()
    .optional(),
  logo: z.string()
    .max(2 * 1024 * 1024, "Le logo est trop volumineux (max 2 Mo encodé)")
    .nullable()
    .optional(),
});

// ============================================================================
// SERVICE SCHEMAS
// ============================================================================

export const serviceSchema = z.object({
  name: z.string()
    .min(1, "Le nom est requis")
    .max(255, "Le nom ne peut pas dépasser 255 caractères"),
  description: z.string()
    .max(5000, "La description ne peut pas dépasser 5000 caractères")
    .optional(),
  category: z.string()
    .max(255, "La catégorie ne peut pas dépasser 255 caractères")
    .optional(),
  unitPrice: z.number().min(0, "Le prix ne peut pas être négatif"),
});

export const serviceUpdateSchema = z.object({
  name: z.string()
    .min(1, "Le nom est requis")
    .max(255, "Le nom ne peut pas dépasser 255 caractères"),
  description: z.string()
    .max(5000, "La description ne peut pas dépasser 5000 caractères")
    .optional(),
  category: z.string()
    .max(255, "La catégorie ne peut pas dépasser 255 caractères")
    .optional(),
  unitPrice: z.number().min(0, "Le prix ne peut pas être négatif"),
});

// ============================================================================
// AUTHENTICATION SCHEMAS
// ============================================================================

export const loginSchema = z.object({
  username: z.string()
    .min(1, "L'identifiant est requis")
    .max(255, "L'identifiant ne peut pas dépasser 255 caractères"),
  password: z.string()
    .min(1, "Le mot de passe est requis")
    .max(255, "Le mot de passe ne peut pas dépasser 255 caractères"),
});

// ============================================================================
// USER SCHEMAS
// ============================================================================

export const userCreateSchema = z.object({
  name: z.string()
    .min(2, "Le nom doit contenir au moins 2 caractères")
    .max(255, "Le nom ne peut pas dépasser 255 caractères"),
  email: z.string()
    .email("Adresse email invalide")
    .max(255, "L'email ne peut pas dépasser 255 caractères"),
  username: z.string()
    .min(1, "L'identifiant est requis")
    .max(255, "L'identifiant ne peut pas dépasser 255 caractères"),
  role: z.enum(['admin', 'user']),
  password: z.string()
    .min(8, "Le mot de passe doit contenir au moins 8 caractères")
    .max(255, "Le mot de passe ne peut pas dépasser 255 caractères")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre"),
  phone: z.string()
    .max(255, "Le téléphone ne peut pas dépasser 255 caractères")
    .optional(),
  force_password_change: z.boolean().default(true),
  is_active: z.boolean().default(true),
});

export const userUpdateSchema = z.object({
  name: z.string()
    .min(2, "Le nom doit contenir au moins 2 caractères")
    .max(255, "Le nom ne peut pas dépasser 255 caractères"),
  email: z.string()
    .email("Adresse email invalide")
    .max(255, "L'email ne peut pas dépasser 255 caractères"),
  role: z.enum(['admin', 'user']),
  password: z.string()
    .min(8, "Le mot de passe doit contenir au moins 8 caractères")
    .max(255, "Le mot de passe ne peut pas dépasser 255 caractères")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre")
    .optional(),
  phone: z.string()
    .max(255, "Le téléphone ne peut pas dépasser 255 caractères")
    .optional(),
  force_password_change: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

// ============================================================================
// PAYMENT SCHEMAS
// ============================================================================

export const paymentCreateSchema = z.object({
  invoiceId: z.string()
    .min(1, "L'ID de la facture est requis")
    .max(255),
  amount: z.number().min(0.01, "Le montant doit être supérieur à 0"),
  paymentMethod: z.string()
    .min(1, "La méthode de paiement est requise")
    .max(255, "La méthode de paiement ne peut pas dépasser 255 caractères"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date invalide (YYYY-MM-DD)"),
});

// ============================================================================
// CREDIT NOTE SCHEMAS
// ============================================================================

export const creditNoteItemSchema = z.object({
  description: z.string()
    .min(1, "La description est requise")
    .max(1000, "La description ne peut pas dépasser 1000 caractères"),
  quantity: z.number().min(0.01, "La quantité doit être supérieure à 0"),
  unitPrice: z.number().min(0, "Le prix unitaire ne peut pas être négatif"),
});

export const creditNoteCreateSchema = z.object({
  invoiceId: z.string()
    .min(1, "L'ID de la facture est requis")
    .max(255),
  reason: z.string()
    .min(1, "La raison est requise")
    .max(1000, "La raison ne peut pas dépasser 1000 caractères"),
  items: z.array(creditNoteItemSchema).min(1, "Au moins un article est requis"),
});

// ============================================================================
// DASHBOARD SCHEMAS
// ============================================================================

export const dashboardMetricsQuerySchema = z.object({
  range: z.enum(['month', 'quarter', 'year']).optional(),
});

// ============================================================================
// QUOTE MUTATION SCHEMAS
// ============================================================================

export const quoteConvertSchema = z.object({
  quoteId: z.string()
    .min(1, "L'ID du devis est requis")
    .max(255),
});

export const quoteDuplicateSchema = z.object({
  quoteId: z.string()
    .min(1, "L'ID du devis est requis")
    .max(255),
});
