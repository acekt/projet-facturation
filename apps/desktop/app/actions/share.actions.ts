"use server";

import crypto from "crypto";
import db from "@/lib/db";
import { getSession } from "@/lib/api/auth";
import type { ActionResponse } from "@/lib/types/api";
import { resolveActiveTenantId } from "@/lib/api/tenant";
import { sendDocumentEmailSchema, smtpTestSchema } from "@/lib/validations";
import { sendSmtpMail, verifySmtpConnection } from "@/lib/services/SmtpMailer";
import type { DbSettings } from "@/lib/types/api";
import { getErrorMessage } from "@/lib/utils/action-error";

export interface SendDocumentEmailPayload {
  to: string;
  cc?: string | null;
  subject: string;
  textBody: string;
  htmlBody?: string | null;
  pdfBase64?: string | null;
  pdfFilename?: string | null;
  documentNumber: string;
  documentType?: string;
}

export interface SendDocumentEmailResult {
  messageId: string;
  sentAt: string;
  recipient: string;
}

/**
 * Enregistre une action de partage de document dans la table d'audit.
 */
export async function logDocumentShareAction(
  channel: "WhatsApp" | "Email",
  documentNumber: string,
  recipient: string
): Promise<ActionResponse<void>> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Non autorisé" };
    }

    const activeTenantId = resolveActiveTenantId(session.userId, session.tenantId);
    const resolvedUserName = session.name || session.username || "Administrateur";

    db.prepare(`
      INSERT INTO audit_logs (id, userId, userName, action, entityType, entityId, details, createdAt, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      session.userId,
      resolvedUserName,
      "SHARE",
      "DOCUMENT",
      documentNumber,
      `Document ${documentNumber} partagé via ${channel} à ${recipient}`,
      new Date().toISOString(),
      activeTenantId
    );

    return { success: true, data: undefined };
  } catch (error) {
    console.error("[Action logDocumentShareAction] Error:", error);
    return { success: false, error: "Échec de la journalisation" };
  }
}

/**
 * Teste la connexion au serveur SMTP directement depuis les paramètres.
 */
export async function testSmtpConnectionAction(input: {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpSecure?: boolean | number | null;
}): Promise<ActionResponse<{ verified: boolean }>> {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return { success: false, error: "Action réservée à l'administrateur" };
    }

    const parsed = smtpTestSchema.safeParse({
      smtpHost: input.smtpHost?.trim(),
      smtpPort: Number(input.smtpPort || 587),
      smtpUser: input.smtpUser?.trim(),
      smtpPass: input.smtpPass,
      smtpSecure: Boolean(input.smtpSecure),
    });

    if (!parsed.success) {
      const firstErr =
        Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ||
        "Paramètres SMTP incomplets";
      return { success: false, error: firstErr };
    }

    const { smtpHost, smtpPort, smtpUser, smtpPass, smtpSecure } = parsed.data;
    await verifySmtpConnection({
      host: smtpHost,
      port: smtpPort,
      secure: Boolean(smtpSecure) || smtpPort === 465,
      user: smtpUser,
      pass: smtpPass,
    });

    return { success: true, data: { verified: true } };
  } catch (error) {
    console.error("[Action testSmtpConnectionAction] Error:", error);
    return {
      success: false,
      error: getErrorMessage(error, "Impossible de se connecter au serveur SMTP"),
    };
  }
}

/**
 * Envoie un document commercial par Email directement depuis l'application (avec PDF A4 attaché)
 * via la configuration SMTP de l'entreprise, et journalise l'envoi dans audit_logs.
 */
export async function sendDocumentEmailInAppAction(
  payload: SendDocumentEmailPayload
): Promise<ActionResponse<SendDocumentEmailResult> & { code?: string }> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Session expirée ou non autorisée" };
    }

    const parsed = sendDocumentEmailSchema.safeParse(payload);
    if (!parsed.success) {
      const firstErr =
        Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ||
        "Veuillez vérifier les champs de l'email";
      return { success: false, error: firstErr };
    }

    const valid = parsed.data;
    const settings = db
      .prepare("SELECT * FROM settings WHERE id = 1")
      .get() as DbSettings | undefined;

    if (
      !settings ||
      !settings.smtpHost?.trim() ||
      !settings.smtpUser?.trim() ||
      !settings.smtpPass
    ) {
      return {
        success: false,
        code: "SMTP_NOT_CONFIGURED",
        error:
          "Le serveur d'envoi Email (SMTP) n'est pas encore configuré dans Paramètres > Entreprise.",
      };
    }

    const smtpPort = Number(settings.smtpPort || 587);
    const smtpSecure = Boolean(settings.smtpSecure) || smtpPort === 465;
    const companyName = settings.companyName?.trim() || "Facturier";
    const senderEmail = settings.email?.trim() || settings.smtpUser.trim();
    const fromHeader = `"${companyName.replace(/"/g, "")}" <${senderEmail}>`;

    const attachments =
      valid.pdfBase64 && valid.pdfBase64.length > 0
        ? [
            {
              filename: valid.pdfFilename || `${valid.documentNumber.replace(/\//g, "_")}.pdf`,
              content: Buffer.from(valid.pdfBase64, "base64"),
              contentType: "application/pdf",
            },
          ]
        : [];

    const mailRes = await sendSmtpMail(
      {
        host: settings.smtpHost.trim(),
        port: smtpPort,
        secure: smtpSecure,
        user: settings.smtpUser.trim(),
        pass: settings.smtpPass,
      },
      {
        from: fromHeader,
        to: valid.to.trim(),
        cc: valid.cc?.trim() || null,
        subject: valid.subject.trim(),
        text: valid.textBody,
        html: valid.htmlBody || null,
        attachments,
      }
    );

    const activeTenantId = resolveActiveTenantId(session.userId, session.tenantId);
    const resolvedUserName = session.name || session.username || "Administrateur";
    const sentAt = new Date().toISOString();

    db.prepare(`
      INSERT INTO audit_logs (id, userId, userName, action, entityType, entityId, details, createdAt, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      session.userId,
      resolvedUserName,
      "SHARE",
      "DOCUMENT",
      valid.documentNumber,
      `Document ${valid.documentNumber} envoyé par Email SMTP à ${valid.to}${attachments.length ? " (avec PDF A4 joint)" : ""}`,
      sentAt,
      activeTenantId
    );

    return {
      success: true,
      data: {
        messageId: mailRes.messageId,
        sentAt,
        recipient: valid.to.trim(),
      },
    };
  } catch (error) {
    console.error("[Action sendDocumentEmailInAppAction] Error:", error);
    return {
      success: false,
      error: getErrorMessage(error, "Échec de l'envoi de l'email via le serveur SMTP"),
    };
  }
}
