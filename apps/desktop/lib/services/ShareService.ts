import { formatCurrency, formatDate } from "@/lib/utils";
import { amountInWordsFCFA } from "@/lib/utils/amount-in-words";
import type { Quote, Invoice, CreditNote } from "@/lib/store";

export type ShareDocumentType =
  | "quote"
  | "invoice"
  | "credit_note"
  | "devis"
  | "facture"
  | "avoir";

export type ShareChannel = "whatsapp" | "email";

function resolveDocKind(type: ShareDocumentType): "quote" | "invoice" | "credit_note" {
  const t = (type || "").toLowerCase();
  if (t === "quote" || t === "devis") return "quote";
  if (t === "credit_note" || t === "avoir") return "credit_note";
  return "invoice";
}

function escapeHtml(str: string): string {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export class ShareService {
  /**
   * Normalise un numéro de téléphone pour WhatsApp.
   * Rejette strictement toute adresse email (contenant '@') ou chaîne alphabétique.
   * Retire les espaces, tirets, parenthèses et points.
   * Ajoute le préfixe +241 si le numéro comporte 8 ou 9 chiffres (Gabon)
   * et ne commence pas par un indicatif international.
   */
  public static normalizePhoneForWhatsApp(phone: string): string {
    if (!phone || typeof phone !== "string") return "";
    if (phone.includes("@") || /[a-zA-Z]/.test(phone)) return "";

    let cleaned = phone.replace(/[\s\-().]/g, "").trim();
    if (!cleaned) return "";

    // Vérifier qu'il ne reste que des chiffres (et éventuellement un '+' initial)
    if (!/^\+?\d+$/.test(cleaned)) return "";

    if (!cleaned.startsWith("+") && !cleaned.startsWith("00")) {
      if (cleaned.length === 8 || cleaned.length === 9) {
        return "+241" + cleaned;
      }
    }

    if (cleaned.startsWith("00")) {
      cleaned = "+" + cleaned.slice(2);
    }

    return cleaned;
  }

  /**
   * Vérifie qu'un numéro WhatsApp est valide (aucun '@', au moins 8 chiffres utiles).
   */
  public static isValidWhatsAppPhone(phone: string): boolean {
    if (!phone || typeof phone !== "string") return false;
    if (phone.includes("@") || /[a-zA-Z]/.test(phone)) return false;

    const rawDigits = phone.replace(/[^\d]/g, "");
    if (rawDigits.length < 8) return false;

    const normalized = this.normalizePhoneForWhatsApp(phone);
    if (!normalized) return false;

    const normalizedDigits = normalized.replace(/[^\d]/g, "");
    return normalizedDigits.length >= 8 && normalizedDigits.length <= 15;
  }

  /**
   * Génère l'objet d'email standard pour un document commercial.
   */
  public static generateEmailSubject(
    document: Quote | Invoice | CreditNote,
    type: ShareDocumentType,
    companyName?: string
  ): string {
    const kind = resolveDocKind(type);
    const docTypeLabel =
      kind === "quote" ? "Devis" : kind === "credit_note" ? "Avoir" : "Facture";
    const cleanCompany = (companyName || "").trim();
    return cleanCompany
      ? `${docTypeLabel} N° ${document.number} — ${cleanCompany}`
      : `${docTypeLabel} N° ${document.number}`;
  }

  /**
   * Formate un message professionnel pour une facture, un devis ou un avoir.
   * - channel === "whatsapp" : conserve le formatage WhatsApp (*gras*, _italique_)
   * - channel === "email"    : texte brut professionnel sans aucun '*' ni '_'
   */
  public static generateDocumentMessage(
    document: Quote | Invoice | CreditNote,
    type: ShareDocumentType,
    companyName: string,
    channel: ShareChannel = "whatsapp"
  ): string {
    const kind = resolveDocKind(type);
    const isWhatsApp = channel === "whatsapp";
    const b = (text: string) => (isWhatsApp ? `*${text}*` : text);
    const it = (text: string) => (isWhatsApp ? `_${text}_` : text);

    let introLine = "";
    if (kind === "invoice") {
      introLine = `Voici votre Facture N° ${document.number} émise par ${companyName}.`;
    } else if (kind === "quote") {
      introLine = `Voici votre Devis N° ${document.number} émis par ${companyName}.`;
    } else {
      introLine = `Voici votre Avoir N° ${document.number} émis par ${companyName}.`;
    }

    let message = `Bonjour,\n\n${introLine}\n\n`;
    message += `${b("Client :")} ${document.clientName}\n`;
    message += `${b("Date d'émission :")} ${formatDate(document.date)}\n`;

    if (kind === "quote" && (document as Quote).validUntil) {
      message += `${b("Date de validité :")} ${formatDate((document as Quote).validUntil!)}\n`;
    } else if (kind === "invoice" && (document as Invoice).dueDate) {
      message += `${b("Date d'échéance :")} ${formatDate((document as Invoice).dueDate!)}\n`;
    }

    const discount = Number((document as any).discount || 0);
    const netHT = Math.max(0, (document.subtotal || 0) - discount);
    message += `\n${b("Montant Net HT :")} ${formatCurrency(netHT)}\n`;

    const cssAmt = Number(document.cssAmount || 0);
    const tpsAmt = Number(document.tpsAmount || 0);
    const tvaAmt = Number(document.tvaAmount || 0);

    if (cssAmt > 0) {
      message += `${b("CSS (1%) :")} ${formatCurrency(cssAmt)}\n`;
    }
    if (tpsAmt > 0) {
      message += `${b("TPS (9.5%) :")} ${formatCurrency(tpsAmt)}\n`;
    }
    if (tvaAmt > 0) {
      message += `${b("TVA (18%) :")} ${formatCurrency(tvaAmt)}\n`;
    }

    message += `${b("Montant Total TTC :")} ${formatCurrency(document.total)}\n`;

    if (kind === "invoice") {
      const inv = document as Invoice;
      const totalPaid = (inv.payments || []).reduce(
        (sum, p) => sum + ((p as any).deletedAt ? 0 : p.amount),
        0
      );
      const remaining = Math.max(0, document.total - totalPaid);
      message += `\n${b(`Reste à payer : ${formatCurrency(remaining)}`)}\n`;
    }

    message += `${it(amountInWordsFCFA(document.total))}\n\n`;
    message += `Merci de votre confiance.\nCordialement, ${companyName}`;

    return message;
  }

  /**
   * Génère une version HTML professionnelle avec tableau récapitulatif pour l'envoi SMTP direct.
   */
  public static generateDocumentEmailHtml(
    document: Quote | Invoice | CreditNote,
    type: ShareDocumentType,
    companyName: string,
    customMessage?: string
  ): string {
    const kind = resolveDocKind(type);
    const docTypeLabel =
      kind === "quote" ? "Devis" : kind === "credit_note" ? "Avoir" : "Facture";
    const plainBody =
      customMessage || this.generateDocumentMessage(document, type, companyName, "email");

    const discount = Number((document as any).discount || 0);
    const netHT = Math.max(0, (document.subtotal || 0) - discount);
    const cssAmt = Number(document.cssAmount || 0);
    const tpsAmt = Number(document.tpsAmount || 0);
    const tvaAmt = Number(document.tvaAmount || 0);

    const paragraphsHtml = plainBody
      .split("\n")
      .map((line) =>
        line.trim()
          ? `<p style="margin: 0 0 8px 0; color: #1e293b; font-size: 14px; line-height: 1.5;">${escapeHtml(line)}</p>`
          : `<div style="height: 8px;"></div>`
      )
      .join("");

    let taxRowsHtml = "";
    if (cssAmt > 0) {
      taxRowsHtml += `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #475569; font-size: 13px;">CSS (1%)</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #0f172a; font-size: 13px; font-weight: 600;">${escapeHtml(formatCurrency(cssAmt))}</td>
        </tr>`;
    }
    if (tpsAmt > 0) {
      taxRowsHtml += `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #475569; font-size: 13px;">TPS (9.5%)</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #0f172a; font-size: 13px; font-weight: 600;">${escapeHtml(formatCurrency(tpsAmt))}</td>
        </tr>`;
    }
    if (tvaAmt > 0) {
      taxRowsHtml += `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #475569; font-size: 13px;">TVA (18%)</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #0f172a; font-size: 13px; font-weight: 600;">${escapeHtml(formatCurrency(tvaAmt))}</td>
        </tr>`;
    }

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(docTypeLabel)} N° ${escapeHtml(document.number)}</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
    <div style="background: #0f172a; color: #ffffff; padding: 20px 24px;">
      <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; font-weight: 600;">${escapeHtml(companyName)}</div>
      <h1 style="margin: 6px 0 0 0; font-size: 18px; font-weight: 700;">${escapeHtml(docTypeLabel)} N° ${escapeHtml(document.number)}</h1>
    </div>
    <div style="padding: 24px;">
      ${paragraphsHtml}

      <table style="width: 100%; border-collapse: collapse; margin-top: 20px; background: #f8fafc; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
        <tbody>
          <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #475569; font-size: 13px;">Montant Net HT</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #0f172a; font-size: 13px; font-weight: 600;">${escapeHtml(formatCurrency(netHT))}</td>
          </tr>
          ${taxRowsHtml}
          <tr style="background: #eff6ff;">
            <td style="padding: 10px 12px; color: #1e3a8a; font-size: 14px; font-weight: 700;">Total TTC</td>
            <td style="padding: 10px 12px; text-align: right; color: #1e3a8a; font-size: 14px; font-weight: 700;">${escapeHtml(formatCurrency(document.total))}</td>
          </tr>
        </tbody>
      </table>

      <p style="margin: 18px 0 0 0; font-size: 12px; color: #64748b;">
        📎 Le document officiel au format PDF A4 est joint à cet email.
      </p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Génère le lien WhatsApp wa.me (fallback web)
   */
  public static generateWhatsAppLink(phone: string, message: string): string {
    const normalizedPhone = this.normalizePhoneForWhatsApp(phone);
    const phoneUrl = normalizedPhone.startsWith("+")
      ? normalizedPhone.substring(1)
      : normalizedPhone;
    return `https://wa.me/${phoneUrl}?text=${encodeURIComponent(message)}`;
  }

  /**
   * Génère l'URL mailto (fallback client messagerie local)
   */
  public static generateEmailLink(
    email: string,
    document: Quote | Invoice | CreditNote,
    type: ShareDocumentType,
    message: string,
    customSubject?: string
  ): string {
    const subject = customSubject || this.generateEmailSubject(document, type);
    return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
  }
}
