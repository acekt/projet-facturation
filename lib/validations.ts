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
  nif: z.string(),
  rccm: z.string(),
  address: z.string(),
  email: z.string().email(),
  phone: z.string(),
  bankName: z.string(),
  iban: z.string(),
  tvaRate: z.number().min(0),
  cssRate: z.number().min(0),
  defaultDueDateDays: z.number().min(0),
  invoicePrefix: z.string().min(1),
  quotePrefix: z.string().min(1),
  mentionsLegales: z.string().nullable().optional(),
  logo: z.string().nullable().optional(),
});

export const serviceSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  description: z.string().optional(),
  category: z.string().optional(),
  unitPrice: z.number().min(0, "Le prix ne peut pas être négatif"),
});
