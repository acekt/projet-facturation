import { z } from "zod";

export const ledgerEntryCreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date invalide (YYYY-MM-DD)"),
  type: z.enum(["IN", "OUT"], { required_error: "Le type (IN/OUT) est requis" }),
  category: z.string().min(1, "La catégorie est requise").max(255),
  description: z.string().min(1, "La description est requise").max(1000),
  amount: z.number().int("Le montant doit être un entier en XAF (pas de décimales)").min(0, "Le montant doit être supérieur ou égal à 0"),
  paymentMethod: z.string().min(1, "La méthode de paiement est requise").max(255),
  reference: z.string().max(255).optional().nullable(),
  counterparty: z.string().max(255).optional().nullable(),
});

export type LedgerEntryCreateRequest = z.infer<typeof ledgerEntryCreateSchema>;

