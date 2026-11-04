"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form"
import { Input } from "@workspace/ui/components/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { Textarea } from "@workspace/ui/components/textarea"
import { ledgerEntryCreateSchema, type LedgerEntryCreateRequest } from "@/app/actions/ledger.actions"
import { createLedgerEntryAction } from "@/app/actions/ledger.actions"
import type { LedgerEntry } from "@/lib/repositories/LedgerRepository"

interface LedgerEntryDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  defaultType?: 'IN' | 'OUT'
  onSuccess: (entry: LedgerEntry) => void
}

const CATEGORIES = [
  "Ventes & Facturation",
  "Loyer & Charges",
  "Électricité & Eau",
  "Internet & Télécom",
  "Transport & Carburant",
  "Fournitures & Matériel",
  "Salaires & Rémunérations",
  "Impôts & Taxes",
  "Approvisionnement Stock",
  "Autre"
]

const PAYMENT_METHODS = [
  "Espèces",
  "Airtel Money",
  "Moov Money",
  "Virement",
  "Chèque"
]

export function LedgerEntryDialog({ isOpen, onOpenChange, defaultType = 'IN', onSuccess }: LedgerEntryDialogProps) {
  const form = useForm<LedgerEntryCreateRequest>({
    resolver: zodResolver(ledgerEntryCreateSchema),
    defaultValues: {
      type: defaultType,
      date: new Date().toISOString().split('T')[0],
      category: "",
      description: "",
      amount: 0,
      paymentMethod: "",
      reference: "",
      counterparty: "",
    }
  })

  // Synchroniser le type par défaut quand la modale s'ouvre
  React.useEffect(() => {
    if (isOpen) {
      form.reset({
        type: defaultType,
        date: new Date().toISOString().split('T')[0],
        category: "",
        description: "",
        amount: 0,
        paymentMethod: "",
        reference: "",
        counterparty: "",
      })
    }
  }, [isOpen, defaultType, form])

  const onSubmit = async (data: LedgerEntryCreateRequest) => {
    try {
      const res = await createLedgerEntryAction(data)
      if (res.success && res.data) {
        onSuccess(res.data)
        onOpenChange(false)
      } else {
        toast.error(res.error || "Impossible d'enregistrer l'écriture.");
      }
    } catch (e) {
      toast.error("Une erreur inattendue est survenue.");
    }
  }

  const isIncome = form.watch("type") === "IN"

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isIncome ? "Nouvelle Recette (Entrée)" : "Nouvelle Dépense (Sortie)"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nature</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className={isIncome ? "border-emerald-200 bg-emerald-50/50" : "border-rose-200 bg-rose-50/50"}>
                          <SelectValue placeholder="Nature" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="IN">Entrée / Recette</SelectItem>
                        <SelectItem value="OUT">Sortie / Dépense</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Montant (FCFA)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        {...field}
                        onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Catégorie</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CATEGORIES.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mode de paiement</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PAYMENT_METHODS.map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Libellé / Motif</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Entrez le motif de l'opération" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="counterparty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tiers / Bénéficiaire (Optionnel)</FormLabel>
                    <FormControl>
                      <Input placeholder="Client, fournisseur, employé..." {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Référence (Optionnel)</FormLabel>
                    <FormControl>
                      <Input placeholder="N° chèque, N° facture..." {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={form.formState.isSubmitting}>
                Annuler
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Enregistrer
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
