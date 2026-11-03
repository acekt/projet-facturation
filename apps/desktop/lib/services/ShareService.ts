import { formatCurrency, formatDate } from "@/lib/utils";
import { amountInWordsFCFA } from "@/lib/utils/amount-in-words";
import { Quote, Invoice } from "@/lib/store";

export class ShareService {
  /**
   * Normalise un numéro de téléphone pour WhatsApp.
   * Retire les espaces, tirets, parenthèses.
   * Ajoute le préfixe +241 si le numéro comporte 8 ou 9 chiffres (Gabon)
   * et ne commence pas par un indicatif international.
   */
  public static normalizePhoneForWhatsApp(phone: string): string {
    if (!phone) return "";
    let cleaned = phone.replace(/[\s\-()]/g, "").trim();
    if (!cleaned) return "";

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
   * Formate un message WhatsApp professionnel pour une facture ou un devis.
   */
  public static generateDocumentMessage(
    document: Quote | Invoice,
    type: "quote" | "invoice",
    companyName: string
  ): string {
    const isQuote = type === "quote";
    const docTypeLabel = isQuote ? "Devis" : "Facture";

    let message = `Bonjour,\n\nVoici votre ${docTypeLabel} N° ${document.number} émis par ${companyName}.\n\n`;
    message += `*Client :* ${document.clientName}\n`;
    message += `*Date d'émission :* ${formatDate(document.date)}\n`;

    if (isQuote && (document as Quote).validUntil) {
      message += `*Date de validité :* ${formatDate((document as Quote).validUntil!)}\n`;
    } else if (!isQuote && (document as Invoice).dueDate) {
      message += `*Date d'échéance :* ${formatDate((document as Invoice).dueDate!)}\n`;
    }

    message += `\n*Montant Net HT :* ${formatCurrency(document.subtotal)}\n`;

    const taxesTotal = (document.tvaAmount || 0) + (document.cssAmount || 0) + (document.tpsAmount || 0);
    if (taxesTotal > 0) {
      message += `*Taxes :* ${formatCurrency(taxesTotal)}\n`;
    }

    message += `*Montant Total TTC :* ${formatCurrency(document.total)}\n`;
    message += `\n*Reste à payer : ${formatCurrency(document.total)}*\n`;
    message += `_${amountInWordsFCFA(document.total)}_\n\n`;
    message += `Merci de votre confiance.\nCordialement, ${companyName}`;

    return message;
  }

  /**
   * Génère l'URL WhatsApp avec le numéro et le message pré-remplis.
   */
  public static generateWhatsAppLink(phone: string, message: string): string {
    const normalizedPhone = this.normalizePhoneForWhatsApp(phone);
    // Supprime le '+' pour l'URL wa.me (wa.me attend le numéro avec indicatif mais sans le +)
    const phoneUrl = normalizedPhone.startsWith("+") ? normalizedPhone.substring(1) : normalizedPhone;
    return `https://wa.me/${phoneUrl}?text=${encodeURIComponent(message)}`;
  }

  /**
   * Génère l'URL mailto pour envoyer le document par email.
   */
  public static generateEmailLink(
    email: string,
    document: Quote | Invoice,
    type: "quote" | "invoice",
    message: string
  ): string {
    const isQuote = type === "quote";
    const docTypeLabel = isQuote ? "Devis" : "Facture";
    const subject = `${docTypeLabel} N° ${document.number}`;

    return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
  }
}
