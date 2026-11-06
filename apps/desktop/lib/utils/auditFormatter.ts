import { formatCurrency } from "@/lib/utils"

export interface FormattedAuditLog {
  actionLabel: string
  actionVariant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info"
  entityLabel: string
  humanDetails: string
  rawJson?: Record<string, unknown> | null
}

const ACTION_MAP: Record<string, { label: string; variant: FormattedAuditLog["actionVariant"] }> = {
  CREATE: { label: "Création", variant: "info" },
  UPDATE: { label: "Modification", variant: "warning" },
  DELETE: { label: "Suppression", variant: "destructive" },
  SHARE: { label: "Partage", variant: "default" },
  LOGIN: { label: "Connexion", variant: "success" },
  LOGOUT: { label: "Déconnexion", variant: "secondary" },
  USER_LOGIN: { label: "Connexion", variant: "success" },
  USER_LOGOUT: { label: "Déconnexion", variant: "secondary" },
  PAYMENT_CREATE: { label: "Encaissement", variant: "success" },
  INVOICE_CREATE: { label: "Création", variant: "info" },
  INVOICE_UPDATE: { label: "Modification", variant: "warning" },
  INVOICE_CANCEL: { label: "Modification", variant: "warning" },
  INVOICE_DELETE: { label: "Suppression", variant: "destructive" },
  QUOTE_CREATE: { label: "Création", variant: "info" },
  QUOTE_UPDATE: { label: "Modification", variant: "warning" },
  QUOTE_CONVERT: { label: "Conversion devis", variant: "default" },
  QUOTE_STATUS_UPDATE: { label: "Modification", variant: "warning" },
  QUOTE_DELETE: { label: "Suppression", variant: "destructive" },
  CREDIT_NOTE_CREATE: { label: "Création", variant: "info" },
  CLIENT_CREATE: { label: "Création", variant: "info" },
  CLIENT_UPDATE: { label: "Modification", variant: "warning" },
  CLIENT_DELETE: { label: "Suppression", variant: "destructive" },
  SERVICE_CREATE: { label: "Création", variant: "info" },
  SERVICE_UPDATE: { label: "Modification", variant: "warning" },
  SERVICE_DELETE: { label: "Suppression", variant: "destructive" },
  SETTINGS_UPDATE: { label: "Modification", variant: "warning" },
}

const ENTITY_MAP: Record<string, string> = {
  document: "Document",
  payment: "Règlement",
  invoice: "Facture",
  quote: "Devis",
  creditnote: "Avoir",
  credit_note: "Avoir",
  stock: "Stock",
  stock_movement: "Stock",
  ledger: "Livre des comptes",
  ledger_entry: "Livre des comptes",
  client: "Client",
  service: "Service",
  settings: "Paramètres",
  user: "Utilisateur",
  auth: "Utilisateur",
  tenant: "Espace fiscal",
}

/**
 * Nettoie les numéros de documents en retirant tout suffixe technique UUID/hexadécimal
 * ex: DEV-101/GM/2026-E8EA -> DEV-101/GM/2026
 */
export function cleanDocumentNumber(docNum?: string | null): string {
  if (!docNum) return ""
  return docNum
    .replace(/(\b(?:DEV|FAC|AVR|PRO|CMD|FACTURE|DEVIS|AVOIR)[^\s,;]+?)-[A-Fa-f0-9]{4,8}(?=\s|$|[.,;:()])/gi, (_m, p1) => p1)
    .replace(/(\/\d{4})-[A-Fa-f0-9]{4,8}(?=\s|$|[.,;:()])/gi, (_m, p1) => p1)
}

/**
 * Formate les montants monétaires et normalise les libellés comptables dans un texte d'audit.
 * - Transforme tout motif `(\d+)\s*(?:XAF|FCFA)` en montant formaté (ex: `1072620 XAF` -> `1 072 620 FCFA`).
 * - Transforme "Création écriture OUT de ..." en "Dépense enregistrée : ..."
 * - Transforme "Création écriture IN de ..." en "Recette enregistrée : ..."
 */
export function formatAuditMoneyAndPhrases(text?: string | null): string {
  if (!text) return "";
  let res = text
    .replace(/Création écriture OUT de\s+/gi, "Dépense enregistrée : ")
    .replace(/Création écriture IN de\s+/gi, "Recette enregistrée : ");

  res = res.replace(/\b(\d{1,3}(?:[\s\u00a0\u202f]\d{3})*|\d+)\s*(?:XAF|FCFA)\b/gi, (_match, numStr) => {
    const rawDigits = numStr.replace(/[\s\u00a0\u202f]/g, "");
    const val = Math.round(Number(rawDigits));
    if (isNaN(val)) return _match;
    const formatted = val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return `${formatted} FCFA`;
  });

  return res;
}

/**
 * Nettoie toute occurrence de numéro de document au sein d'un texte ou d'une phrase d'audit
 */
export function cleanDocumentNumbersInText(text?: string | null): string {
  if (!text) return ""
  const withCleanDocs = text
    .replace(/(\b(?:DEV|FAC|AVR|PRO|CMD|FACTURE|DEVIS|AVOIR)[^\s,;]+?)-[A-Fa-f0-9]{4,8}(?=\s|$|[.,;:()])/gi, (_m, p1) => p1)
    .replace(/(\/\d{4})-[A-Fa-f0-9]{4,8}(?=\s|$|[.,;:()])/gi, (_m, p1) => p1);
  return formatAuditMoneyAndPhrases(withCleanDocs);
}

export function formatAuditDateTimeFr(dateString?: string | null): string {
  if (!dateString) return "—"
  const raw = dateString.trim()
  // Support SQLite UTC strings "YYYY-MM-DD HH:MM:SS" or ISO strings
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T") + (raw.endsWith("Z") ? "" : "Z")
  const d = new Date(normalized)
  if (isNaN(d.getTime())) {
    const fallback = new Date(raw)
    if (isNaN(fallback.getTime())) return raw
    return formatDateObj(fallback)
  }
  return formatDateObj(d)
}

/**
 * Format court pour timeline et widgets : "DD/MM à HH:mm" (ex: "05/11 à 08:21")
 */
export function formatAuditShortDateTimeFr(dateString?: string | null): string {
  if (!dateString) return "—"
  const raw = dateString.trim()
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T") + (raw.endsWith("Z") ? "" : "Z")
  const d = new Date(normalized)
  const validDate = isNaN(d.getTime()) ? new Date(raw) : d
  if (isNaN(validDate.getTime())) return raw
  const day = String(validDate.getDate()).padStart(2, "0")
  const month = String(validDate.getMonth() + 1).padStart(2, "0")
  const hours = String(validDate.getHours()).padStart(2, "0")
  const mins = String(validDate.getMinutes()).padStart(2, "0")
  return `${day}/${month} à ${hours}:${mins}`
}

function formatDateObj(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0")
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const year = d.getFullYear()
  const hours = String(d.getHours()).padStart(2, "0")
  const mins = String(d.getMinutes()).padStart(2, "0")
  const secs = String(d.getSeconds()).padStart(2, "0")
  return `${day}/${month}/${year} à ${hours}:${mins}:${secs}`
}

export function formatAuditAction(action: string): { label: string; variant: FormattedAuditLog["actionVariant"] } {
  const normalized = (action || "").trim().toUpperCase()
  if (ACTION_MAP[normalized]) {
    return ACTION_MAP[normalized]
  }
  if (normalized.includes("CREATE")) return { label: "Création", variant: "info" }
  if (normalized.includes("UPDATE")) return { label: "Modification", variant: "warning" }
  if (normalized.includes("DELETE")) return { label: "Suppression", variant: "destructive" }
  if (normalized.includes("SHARE")) return { label: "Partage", variant: "default" }
  if (normalized.includes("LOGIN")) return { label: "Connexion", variant: "success" }
  if (normalized.includes("LOGOUT")) return { label: "Déconnexion", variant: "secondary" }
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
    return { humanText: cleanDocumentNumbersInText(trimmed), rawJson: null }
  }

  try {
    const data = JSON.parse(trimmed)
    if (typeof data !== "object" || data === null) {
      return { humanText: cleanDocumentNumbersInText(String(data)), rawJson: null }
    }

    const d = data as Record<string, any>
    const parts: string[] = []

    // 1. Paiement / Encaissement
    if (d.amount !== undefined && (d.invoiceNumber || d.paymentMethod)) {
      const formattedAmount = typeof d.amount === "number" ? formatCurrency(d.amount) : `${d.amount} FCFA`
      let p = `Règlement de ${formattedAmount}`
      if (d.invoiceNumber) p += ` sur ${cleanDocumentNumber(d.invoiceNumber)}`
      if (d.paymentMethod) p += ` (${d.paymentMethod})`
      if (d.reference) p += ` · Réf: ${d.reference}`
      return { humanText: cleanDocumentNumbersInText(p), rawJson: d }
    }

    // 2. Facture
    if (d.invoiceNumber) {
      const invNum = cleanDocumentNumber(d.invoiceNumber)
      let p = `Facture ${invNum}`
      if (d.client || d.clientName) p += ` pour ${d.client || d.clientName}`
      if (d.total !== undefined) p += ` · ${formatCurrency(Number(d.total))}`
      if (d.status) p += ` · Statut: ${d.status}`
      return { humanText: cleanDocumentNumbersInText(p), rawJson: d }
    }

    // 3. Devis
    if (d.quoteNumber) {
      const qNum = cleanDocumentNumber(d.quoteNumber)
      let p = `Devis ${qNum}`
      if (d.client || d.clientName) p += ` pour ${d.client || d.clientName}`
      if (d.total !== undefined) p += ` · ${formatCurrency(Number(d.total))}`
      if (d.invoiceNumber) p += ` converti en ${cleanDocumentNumber(d.invoiceNumber)}`
      return { humanText: cleanDocumentNumbersInText(p), rawJson: d }
    }

    // 4. Avoir
    if (d.creditNoteNumber || d.number) {
      const num = cleanDocumentNumber(d.creditNoteNumber || d.number)
      let p = `Avoir ${num}`
      if (d.clientName || d.client) p += ` émis pour ${d.clientName || d.client}`
      if (d.total !== undefined) p += ` · ${formatCurrency(Number(d.total))}`
      if (d.reason) p += ` · Motif: ${d.reason}`
      return { humanText: cleanDocumentNumbersInText(p), rawJson: d }
    }

    // 5. Client
    if (d.clientName || d.name) {
      let p = `Client « ${d.clientName || d.name} »`
      if (d.email) p += ` (${d.email})`
      if (d.nif) p += ` · NIF: ${d.nif}`
      return { humanText: cleanDocumentNumbersInText(p), rawJson: d }
    }

    // 6. Generic key-values in clean readable French
    for (const [k, v] of Object.entries(d)) {
      if (k === "action" || k === "tenant_id" || k === "deletedAt") continue
      if (v !== undefined && v !== null && v !== "") {
        const keyLabel = k === "reason" ? "Motif" : k === "notes" ? "Note" : k === "message" ? "Détail" : k
        const valStr = typeof v === "string" ? cleanDocumentNumbersInText(v) : v
        parts.push(`${keyLabel}: ${valStr}`)
      }
    }

    return {
      humanText: parts.length > 0 ? formatAuditMoneyAndPhrases(parts.join(" · ")) : "Opération enregistrée",
      rawJson: d,
    }
  } catch {
    return { humanText: cleanDocumentNumbersInText(trimmed), rawJson: null }
  }
}
