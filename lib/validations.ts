import * as z from "zod";

export const clientSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Adresse email invalide"),
  phone: z.string().min(6, "Numéro de téléphone invalide"),
  address: z.string().min(5, "L'adresse doit contenir au moins 5 caractères"),
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
  amount: z.number().min(0),
  status: z.enum(['paid', 'pending', 'overdue', 'draft']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date invalide"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date d'échéance invalide"),
  items: z.array(invoiceItemSchema).min(1, "Au moins un article est requis"),
  notes: z.string().optional(),
});
