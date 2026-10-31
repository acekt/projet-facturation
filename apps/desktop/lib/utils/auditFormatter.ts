import { formatCurrency } from "@/lib/utils"

export interface FormattedAuditLog {
  actionLabel: string
  actionVariant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info"
  entityLabel: string
  humanDetails: string
  rawJson?: Record<string, unknown> | null
}

const ACTION_MAP: Record<string, { label: string; variant: FormattedAuditLog["actionVariant"] }> = {
  PAYMENT_CREATE: { label: "Encaissement", variant: "success" },
  INVOICE_CREATE: { label: "Création facture", variant: "info" },
  INVOICE_CANCEL: { label: "Annulation facture", variant: "warning" },
  INVOICE_DELETE: { label: "Suppression facture", variant: "destructive" },
  QUOTE_CREATE: { label: "Création devis", variant: "info" },
  QUOTE_CONVERT: { label: "Conversion devis", variant: "default" },
  QUOTE_STATUS_UPDATE: { label: "Mise à jour statut", variant: "secondary" },
  QUOTE_DELETE: { label: "Suppression devis", variant: "destructive" },
  CREDIT_NOTE_CREATE: { label: "Émission avoir", variant: "default" },
  CLIENT_CREATE: { label: "Nouveau client", variant: "info" },
  CLIENT_UPDATE: { label: "Modification client", variant: "secondary" },
  CLIENT_DELETE: { label: "Suppression client", variant: "destructive" },
  SERVICE_CREATE: { label: "Nouvelle prestation", variant: "info" },
  SERVICE_UPDATE: { label: "Modification prestation", variant: "secondary" },
  SERVICE_DELETE: { label: "Suppression prestation", variant: "destructive" },
  SETTINGS_UPDATE: { label: "Paramètres modifiés", variant: "secondary" },
  USER_LOGIN: { label: "Connexion", variant: "success" },
  USER_LOGOUT: { label: "Déconnexion", variant: "secondary" },
  CREATE: { label: "Création", variant: "info" },
  UPDATE: { label: "Modification", variant: "secondary" },
  DELETE: { label: "Suppression", variant: "destructive" },
}

const ENTITY_MAP: Record<string, string> = {
  payment: "Règlement",
  invoice: "Facture",
  quote: "Devis",
  creditnote: "Avoir",
  credit_note: "Avoir",
  client: "Client",
  service: "Prestation",
  settings: "Paramètres",
  user: "Utilisateur",
  auth: "Authentification",
  tenant: "Espace fiscal",
}

export function formatAuditAction(action: string): { label: string; variant: FormattedAuditLog["actionVariant"] } {
  const normalized = (action || "").trim().toUpperCase()
  if (ACTION_MAP[normalized]) {
    return ACTION_MAP[normalized]
  }
  return {
    label: action ? action.replace(/_/g, " ").toLowerCase() : "Action",
    variant: "secondary",
  }
}

export function formatAuditEntity(entityType: string): string {
  const normalized = (entityType || "").trim().toLowerCase()
  return ENTITY_MAP[normalized] || entityType || "Système"
}

export function formatAuditDetails(rawDetails?: string | null): { humanText: string; rawJson: Record<string, unknown> | null } {
  if (!rawDetails || !rawDetails.trim()) {
    return { humanText: "—", rawJson: null }
  }

  const trimmed = rawDetails.trim()
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return { humanText: trimmed, rawJson: null }
  }

  try {
    const data = JSON.parse(trimmed)
    if (typeof data !== "object" || data === null) {
      return { humanText: String(data), rawJson: null }
    }

    const d = data as Record<string, any>
    const parts: string[] = []

    // 1. Paiement / Encaissement
    if (d.amount !== undefined && (d.invoiceNumber || d.paymentMethod)) {
      const formattedAmount = typeof d.amount === "number" ? formatCurrency(d.amount) : `${d.amount} FCFA`
      let p = `Règlement de ${formattedAmount}`
      if (d.invoiceNumber) p += ` sur ${d.invoiceNumber}`
      if (d.paymentMethod) p += ` (${d.paymentMethod})`
      if (d.reference) p += ` · Réf: ${d.reference}`
      return { humanText: p, rawJson: d }
    }

    // 2. Facture
    if (d.invoiceNumber) {
      let p = `Facture ${d.invoiceNumber}`
      if (d.client || d.clientName) p += ` pour ${d.client || d.clientName}`
      if (d.total !== undefined) p += ` · ${formatCurrency(Number(d.total))}`
      if (d.status) p += ` · Statut: ${d.status}`
      return { humanText: p, rawJson: d }
    }

    // 3. Devis
    if (d.quoteNumber) {
      let p = `Devis ${d.quoteNumber}`
      if (d.client || d.clientName) p += ` pour ${d.client || d.clientName}`
      if (d.total !== undefined) p += ` · ${formatCurrency(Number(d.total))}`
      if (d.invoiceNumber) p += ` converti en ${d.invoiceNumber}`
      return { humanText: p, rawJson: d }
    }

    // 4. Avoir
    if (d.creditNoteNumber || d.number) {
      const num = d.creditNoteNumber || d.number
      let p = `Avoir ${num}`
      if (d.clientName || d.client) p += ` émis pour ${d.clientName || d.client}`
      if (d.total !== undefined) p += ` · ${formatCurrency(Number(d.total))}`
      if (d.reason) p += ` · Motif: ${d.reason}`
      return { humanText: p, rawJson: d }
    }

    // 5. Client
    if (d.clientName || d.name) {
      let p = `Client « ${d.clientName || d.name} »`
      if (d.email) p += ` (${d.email})`
      if (d.nif) p += ` · NIF: ${d.nif}`
      return { humanText: p, rawJson: d }
    }

    // 6. Generic key-values in clean readable French
    for (const [k, v] of Object.entries(d)) {
      if (k === "action" || k === "tenant_id" || k === "deletedAt") continue
      if (v !== undefined && v !== null && v !== "") {
        const keyLabel = k === "reason" ? "Motif" : k === "notes" ? "Note" : k === "message" ? "Détail" : k
        parts.push(`${keyLabel}: ${v}`)
      }
    }

    return {
      humanText: parts.length > 0 ? parts.join(" · ") : "Opération enregistrée",
      rawJson: d,
    }
  } catch {
    return { humanText: trimmed, rawJson: null }
  }
}

