"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, ImagePlus, Trash2, RefreshCw } from "lucide-react"
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
import { DatePicker } from "@workspace/ui/components/date-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { Textarea } from "@workspace/ui/components/textarea"
import { EditableSelect } from "@/components/features/common/EditableSelect"
import { ledgerEntryCreateSchema, type LedgerEntryCreateRequest } from "@/lib/validations"
import { createLedgerEntryAction } from "@/app/actions/ledger.actions"
import type { LedgerEntry } from "@/lib/repositories/LedgerRepository"

interface LedgerEntryDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  defaultType?: "IN" | "OUT"
  onSuccess: (entry: LedgerEntry) => void
}

const INCOME_CATEGORIES = [
  "Ventes & Facturation",
  "Prestation de services",
  "Apport en compte courant",
  "Subvention / Aide",
  "Autre recette",
]

const EXPENSE_CATEGORIES = [
  "Loyer & Charges",
  "Électricité & Eau",
  "Internet & Télécom",
  "Transport & Carburant",
  "Fournitures & Matériel",
  "Salaires & Rémunérations",
  "Impôts & Taxes",
  "Approvisionnement Stock",
  "Maintenance & Réparations",
  "Autre dépense",
]

const PAYMENT_METHODS = [
  "Espèces",
  "Airtel Money",
  "Moov Money",
  "Virement Bancaire",
  "Chèque",
  "Carte Bancaire",
]

function generateLedgerReference(type: "IN" | "OUT", dateStr?: string): string {
  const prefix = type === "IN" ? "REC" : "DEP"
  const cleanDate = (dateStr || new Date().toISOString().slice(0, 10))
    .slice(0, 10)
    .replace(/-/g, "")
  const rand = String(Math.floor(1000 + Math.random() * 9000))
  return `${prefix}-${cleanDate}-${rand}`
}

export function LedgerEntryDialog({
  isOpen,
  onOpenChange,
  defaultType = "IN",
  onSuccess,
}: LedgerEntryDialogProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const form = useForm<LedgerEntryCreateRequest>({
    resolver: zodResolver(ledgerEntryCreateSchema),
    defaultValues: {
      type: defaultType,
      date: new Date().toISOString().split("T")[0],
      category: defaultType === "IN" ? "Ventes & Facturation" : "Fournitures & Matériel",
      description: "",
      amount: 0,
      paymentMethod: "Espèces",
      reference: generateLedgerReference(defaultType),
      counterparty: "",
      proofImage: null,
    },
  })

  React.useEffect(() => {
    if (isOpen) {
      const today = new Date().toISOString().split("T")[0]
      form.reset({
        type: defaultType,
        date: today,
        category: defaultType === "IN" ? "Ventes & Facturation" : "Fournitures & Matériel",
        description: "",
        amount: 0,
        paymentMethod: "Espèces",
        reference: generateLedgerReference(defaultType, today),
        counterparty: "",
        proofImage: null,
      })
    }
  }, [isOpen, defaultType, form])

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez sélectionner une image valide (.png, .jpg, .jpeg, .webp)")
      return
    }

    if (file.size > 3.5 * 1024 * 1024) {
      toast.error("L'image justificative ne doit pas dépasser 3,5 Mo")
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== "string") return
      const dataUrl = reader.result

      const img = new window.Image()
      img.onload = () => {
        try {
          const MAX_WIDTH = 1200
          const MAX_HEIGHT = 1200
          let width = img.width
          let height = img.height

          if (width > MAX_WIDTH || height > MAX_HEIGHT) {
            if (width >= height) {
              height = Math.round((height * MAX_WIDTH) / width)
              width = MAX_WIDTH
            } else {
              width = Math.round((width * MAX_HEIGHT) / height)
              height = MAX_HEIGHT
            }
          }

          const canvas = document.createElement("canvas")
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext("2d")
          if (!ctx) {
            form.setValue("proofImage", dataUrl, { shouldDirty: true })
            return
          }
          ctx.drawImage(img, 0, 0, width, height)

          let compressed = canvas.toDataURL("image/webp", 0.75)
          if (!compressed.startsWith("data:image/webp")) {
            compressed = canvas.toDataURL("image/jpeg", 0.75)
          }
          form.setValue("proofImage", compressed, { shouldDirty: true })
        } catch {
          form.setValue("proofImage", dataUrl, { shouldDirty: true })
        }
      }
      img.onerror = () => {
        form.setValue("proofImage", dataUrl, { shouldDirty: true })
      }
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
  }

  const onSubmit = async (data: LedgerEntryCreateRequest) => {
    try {
      const res = await createLedgerEntryAction(data)
      if (res.success && res.data) {
        onSuccess(res.data)
        onOpenChange(false)
      } else {
        toast.error(res.error || "Impossible d'enregistrer l'écriture.")
      }
    } catch {
      toast.error("Une erreur inattendue est survenue.")
    }
  }

  const isIncome = form.watch("type") === "IN"
  const proofImage = form.watch("proofImage")

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
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
                    <Select
                      onValueChange={(val: "IN" | "OUT") => {
                        field.onChange(val)
                        form.setValue(
                          "category",
                          val === "IN" ? "Ventes & Facturation" : "Fournitures & Matériel"
                        )
                        form.setValue(
                          "reference",
                          generateLedgerReference(val, form.getValues("date"))
                        )
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="border-input bg-background">
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
                      <DatePicker
                        value={field.value}
                        onChange={(iso) => field.onChange(iso)}
                        placeholder="JJ/MM/AAAA"
                        className="bg-background border-input"
                      />
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
                        placeholder="Ex: 50000"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
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
                    <FormControl>
                      <EditableSelect
                        groupKey={isIncome ? "ledger_income_category" : "ledger_expense_category"}
                        value={field.value}
                        onChange={field.onChange}
                        defaultOptions={isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES}
                        placeholder="Sélectionner une catégorie..."
                        addPlaceholder="Nouvelle catégorie..."
                      />
                    </FormControl>
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
                  <FormControl>
                    <EditableSelect
                      groupKey="payment_method"
                      value={field.value}
                      onChange={field.onChange}
                      defaultOptions={PAYMENT_METHODS}
                      placeholder="Sélectionner un mode de paiement..."
                      addPlaceholder="Nouveau mode de paiement..."
                    />
                  </FormControl>
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
                    <Textarea
                      placeholder="Décrivez l'opération (ex: Règlement facture client, achat ramettes papier, carburant...)"
                      {...field}
                    />
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
                      <Input
                        placeholder="Ex: SEEG, M. Ndong, Entreprise ABC..."
                        {...field}
                        value={field.value || ""}
                      />
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
                    <FormLabel>Référence</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-1.5">
                        <Input
                          placeholder="Référence auto ou N° pièce"
                          {...field}
                          value={field.value || ""}
                          className="font-mono text-xs"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          title="Régénérer la référence"
                          onClick={() =>
                            field.onChange(
                              generateLedgerReference(
                                form.getValues("type"),
                                form.getValues("date")
                              )
                            )
                          }
                          className="shrink-0"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Champ Pièce justificative / Reçu (Image optionnelle) */}
            <div className="space-y-2 pt-1">
              <FormLabel className="flex items-center justify-between">
                <span>Pièce justificative / Reçu (Image optionnelle)</span>
                <span className="text-[11px] font-normal text-muted-foreground">
                  PNG, JPG, WEBP (max 3,5 Mo)
                </span>
              </FormLabel>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={handleImageUpload}
              />
              {!proofImage ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg border border-dashed border-border bg-secondary/30 hover:bg-secondary/60 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <ImagePlus className="w-4 h-4 text-primary" />
                  <span>Joindre la photo d&apos;un reçu, ticket ou facture fournisseur...</span>
                </button>
              ) : (
                <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border bg-secondary/30">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={proofImage}
                      alt="Aperçu du reçu"
                      className="h-12 w-12 rounded object-cover border border-border shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">
                        Justificatif image joint
                      </p>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[11px] text-primary hover:underline"
                      >
                        Remplacer l&apos;image
                      </button>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => form.setValue("proofImage", null)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={form.formState.isSubmitting}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Enregistrer
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
