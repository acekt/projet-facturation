"use client";

import * as React from "react";
import {
  Mail,
  MessageCircle,
  Send,
  FileText,
  CheckCircle2,
  Download,
  Copy,
  AlertCircle,
  FolderOpen,
  Settings2,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@workspace/ui/components/dialog";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import { Input } from "@workspace/ui/components/input";
import { Textarea } from "@workspace/ui/components/textarea";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { Badge } from "@workspace/ui/components/badge";
import { Quote, Invoice, CreditNote, useStore } from "@/lib/store";
import { ShareService, type ShareDocumentType } from "@/lib/services/ShareService";
import {
  logDocumentShareAction,
  sendDocumentEmailInAppAction,
  testSmtpConnectionAction,
} from "@/app/actions/share.actions";
import { updateClient } from "@/app/actions/client.actions";
import { updateSettings } from "@/app/actions/settings.actions";
import { toast } from "sonner";
import {
  exportElementToPdfBase64,
  exportElementToPdfDialog,
} from "@/lib/electron-print";
import { DocumentA4 } from "@/components/document-a4";
import type { DocumentType } from "@/components/features/document-a4/A4Header";
import type {
  InvoiceResponse,
  QuoteResponse,
  CreditNoteResponse,
} from "@/lib/types/api";

interface ShareDocumentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: Quote | Invoice | CreditNote;
  type: ShareDocumentType;
}

export function ShareDocumentModal({
  open,
  onOpenChange,
  document: docData,
  type,
}: ShareDocumentModalProps) {
  const [channel, setChannel] = React.useState<"whatsapp" | "email">("whatsapp");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [emailSubject, setEmailSubject] = React.useState("");
  const [whatsappMessage, setWhatsappMessage] = React.useState("");
  const [emailMessage, setEmailMessage] = React.useState("");
  const [generatePdf, setGeneratePdf] = React.useState(true);
  const [isSending, setIsSending] = React.useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = React.useState(false);
  const [phoneError, setPhoneError] = React.useState<string | null>(null);
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [confirmationMessage, setConfirmationMessage] = React.useState<string | null>(null);

  // Configuration rapide SMTP in-modal
  const [showQuickSmtpForm, setShowQuickSmtpForm] = React.useState(false);
  const [smtpHost, setSmtpHost] = React.useState("");
  const [smtpPort, setSmtpPort] = React.useState(587);
  const [smtpUser, setSmtpUser] = React.useState("");
  const [smtpPass, setSmtpPass] = React.useState("");
  const [smtpSecure, setSmtpSecure] = React.useState(false);
  const [isSavingSmtp, setIsSavingSmtp] = React.useState(false);

  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const clients = useStore((s) => s.clients);
  const updateClientInStore = useStore((s) => s.updateClient);
  const companyName = settings?.companyName || "Notre Entreprise";

  const isSmtpConfigured = Boolean(
    settings?.smtpHost?.trim() &&
      settings?.smtpUser?.trim() &&
      settings?.smtpPass?.trim()
  );

  const normalizedKind = React.useMemo(() => {
    if (type === "quote" || type === "devis") return "quote" as const;
    if (type === "credit_note" || type === "avoir") return "credit_note" as const;
    return "invoice" as const;
  }, [type]);

  const a4Type: DocumentType = React.useMemo(() => {
    if (normalizedKind === "quote") return "devis";
    if (normalizedKind === "credit_note") return "avoir";
    return "facture";
  }, [normalizedKind]);

  const docLabelLower = React.useMemo(() => {
    if (normalizedKind === "quote") return "ce devis";
    if (normalizedKind === "credit_note") return "cet avoir";
    return "cette facture";
  }, [normalizedKind]);

  const pdfFilename = React.useMemo(() => {
    const prefix =
      normalizedKind === "quote"
        ? "Devis"
        : normalizedKind === "credit_note"
          ? "Avoir"
          : "Facture";
    const safeNumber = String(docData?.number || "DOC").replace(/[<>:"/\\|?*]/g, "_");
    return `${prefix}_${safeNumber}.pdf`;
  }, [normalizedKind, docData?.number]);

  const hiddenA4ContainerId = React.useMemo(
    () => `share-modal-a4-${String(docData?.id || docData?.number || "doc").replace(/[^a-zA-Z0-9_-]/g, "_")}`,
    [docData?.id, docData?.number]
  );

  // Résolution intelligente du client dans le store Zustand
  const matchedClient = React.useMemo(() => {
    if (!docData) return undefined;
    const docEmail = (docData as Invoice | Quote).clientEmail?.trim().toLowerCase();
    const docName = docData.clientName?.trim().toLowerCase();
    return clients.find(
      (c) =>
        c.id === docData.clientId ||
        (docName && c.name?.trim().toLowerCase() === docName) ||
        (docEmail && c.email?.trim().toLowerCase() === docEmail)
    );
  }, [clients, docData]);

  // Initialisation stricte et séparée de phone et email à l'ouverture
  React.useEffect(() => {
    if (open && docData) {
      const candidatePhone =
        matchedClient?.phone ||
        (docData as Invoice & { clientPhone?: string }).clientPhone ||
        "";
      const safePhone =
        candidatePhone && !candidatePhone.includes("@") ? candidatePhone.trim() : "";

      const candidateEmail =
        matchedClient?.email || (docData as Invoice | Quote).clientEmail || "";
      const safeEmail =
        candidateEmail && candidateEmail.includes("@") ? candidateEmail.trim() : "";

      setPhone(safePhone);
      setEmail(safeEmail);
      setPhoneError(null);
      setEmailError(null);
      setConfirmationMessage(null);
      setShowQuickSmtpForm(false);

      setEmailSubject(ShareService.generateEmailSubject(docData, type, companyName));
      setWhatsappMessage(
        ShareService.generateDocumentMessage(docData, type, companyName, "whatsapp")
      );
      setEmailMessage(
        ShareService.generateDocumentMessage(docData, type, companyName, "email")
      );

      setSmtpHost(settings?.smtpHost || "");
      setSmtpPort(settings?.smtpPort || 587);
      setSmtpUser(settings?.smtpUser || "");
      setSmtpPass(settings?.smtpPass || "");
      setSmtpSecure(Boolean(settings?.smtpSecure));
    }
  }, [open, docData, matchedClient, type, companyName, settings]);

  const isPhoneValid = React.useMemo(
    () => ShareService.isValidWhatsAppPhone(phone),
    [phone]
  );

  const isEmailValid = React.useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
    [email]
  );

  // Persistance automatique des coordonnées mises à jour sur la fiche client existante
  const syncClientContactIfNeeded = async (nextPhone?: string, nextEmail?: string) => {
    if (!matchedClient) return;
    const cleanPhone = nextPhone?.trim();
    const cleanEmail = nextEmail?.trim();

    const phoneChanged =
      cleanPhone &&
      !cleanPhone.includes("@") &&
      ShareService.isValidWhatsAppPhone(cleanPhone) &&
      cleanPhone !== (matchedClient.phone || "").trim();

    const emailChanged =
      cleanEmail &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) &&
      cleanEmail.toLowerCase() !== (matchedClient.email || "").trim().toLowerCase();

    if (!phoneChanged && !emailChanged) return;

    const updatedPhone = phoneChanged ? cleanPhone : matchedClient.phone || "";
    const updatedEmail = emailChanged ? cleanEmail : matchedClient.email || "";

    try {
      const res = await updateClient(matchedClient.id, {
        name: matchedClient.name,
        email: updatedEmail || null,
        phone: updatedPhone || undefined,
        address: matchedClient.address || undefined,
        nif: matchedClient.nif || null,
        rccm: matchedClient.rccm || null,
        status: matchedClient.status,
      });
      if (res.success && res.data) {
        updateClientInStore(matchedClient.id, {
          phone: res.data.phone || updatedPhone,
          email: res.data.email || updatedEmail,
        });
      }
    } catch (err) {
      console.warn("[ShareDocumentModal] Impossible de synchroniser la fiche client :", err);
    }
  };

  const handleCopyMessage = async () => {
    const activeMsg = channel === "whatsapp" ? whatsappMessage : emailMessage;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(activeMsg);
      }
      toast.success("Message copié dans le presse-papiers");
    } catch {
      toast.error("Impossible de copier le message");
    }
  };

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      const res = await exportElementToPdfDialog(hiddenA4ContainerId, pdfFilename);
      if (res.saved) {
        toast.success("PDF A4 enregistré avec succès", {
          description: res.filePath || pdfFilename,
        });
      }
    } catch (err) {
      toast.error("Erreur lors de la génération du PDF", {
        description: err instanceof Error ? err.message : "Erreur inconnue",
      });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleSaveAndRevealForEmailFallback = async () => {
    setIsSending(true);
    try {
      const { pdfBase64, filePath } = await exportElementToPdfBase64(
        hiddenA4ContainerId,
        pdfFilename
      );
      const formattedClipboard = `Objet : ${emailSubject}\nDestinataire : ${email}\n\n${emailMessage}`;

      if (typeof window !== "undefined" && window.electron?.saveAndRevealPdf) {
        const revealed = await window.electron.saveAndRevealPdf({
          pdfBase64,
          pdfFilename,
          textToCopy: formattedClipboard,
        });
        toast.success("PDF A4 généré et message copié", {
          description: revealed.filePath
            ? `Fichier révélé : ${revealed.filePath}`
            : "L'objet et le corps de l'email ont été copiés dans le presse-papiers.",
        });
      } else {
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(formattedClipboard);
        }
        await exportElementToPdfDialog(hiddenA4ContainerId, pdfFilename);
        toast.success("PDF généré et texte copié dans le presse-papiers");
      }

      if (filePath && typeof window !== "undefined" && window.electron?.showItemInFolder) {
        await window.electron.showItemInFolder(filePath);
      }
    } catch (err) {
      toast.error("Erreur lors de la préparation du PDF", {
        description: err instanceof Error ? err.message : "Erreur inconnue",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveQuickSmtp = async () => {
    if (!smtpHost.trim() || !smtpUser.trim() || !smtpPass.trim()) {
      toast.error("Veuillez remplir l'hôte, l'identifiant et le mot de passe SMTP.");
      return;
    }
    setIsSavingSmtp(true);
    try {
      const testRes = await testSmtpConnectionAction({
        smtpHost: smtpHost.trim(),
        smtpPort: Number(smtpPort || 587),
        smtpUser: smtpUser.trim(),
        smtpPass,
        smtpSecure,
      });
      if (!testRes.success) {
        toast.error("Échec de connexion au serveur SMTP", {
          description: testRes.error,
        });
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...currentSettingsPayload } = (settings || {}) as typeof settings & {
        id?: number;
      };
      const updateRes = await updateSettings({
        ...currentSettingsPayload,
        smtpHost: smtpHost.trim(),
        smtpPort: Number(smtpPort || 587),
        smtpUser: smtpUser.trim(),
        smtpPass,
        smtpSecure,
      });

      if (updateRes.success && updateRes.data) {
        setSettings({ ...settings, ...updateRes.data });
        setShowQuickSmtpForm(false);
        toast.success("Configuration SMTP activée avec succès");
      } else {
        toast.error(updateRes.error || "Impossible d'enregistrer les paramètres SMTP");
      }
    } catch (err) {
      toast.error("Erreur lors de la sauvegarde SMTP", {
        description: err instanceof Error ? err.message : "Erreur inconnue",
      });
    } finally {
      setIsSavingSmtp(false);
    }
  };

  const handleSend = async () => {
    setConfirmationMessage(null);

    if (channel === "whatsapp") {
      if (!ShareService.isValidWhatsAppPhone(phone)) {
        const msg = "Veuillez saisir un numéro de téléphone WhatsApp valide";
        setPhoneError(msg);
        toast.error(msg);
        return;
      }
      setPhoneError(null);

      try {
        setIsSending(true);
        const normalizedPhone = ShareService.normalizePhoneForWhatsApp(phone);
        await syncClientContactIfNeeded(normalizedPhone, undefined);

        let pdfBase64: string | undefined;
        let savedPath: string | undefined;
        if (generatePdf) {
          const pdfResult = await exportElementToPdfBase64(
            hiddenA4ContainerId,
            pdfFilename
          );
          pdfBase64 = pdfResult.pdfBase64;
          savedPath = pdfResult.filePath;
        }

        await logDocumentShareAction("WhatsApp", docData.number, normalizedPhone);

        if (typeof window !== "undefined" && window.electron?.openWhatsAppInApp) {
          const waRes = await window.electron.openWhatsAppInApp({
            phone: normalizedPhone,
            message: whatsappMessage,
            pdfBase64,
            pdfFilename,
          });
          const finalPath = waRes?.filePath || savedPath;
          setConfirmationMessage(
            finalPath
              ? `Messagerie WhatsApp intégrée ouverte pour ${normalizedPhone}. Le message est pré-rempli et le PDF (${pdfFilename}) est prêt à être glissé-déposé.`
              : `Messagerie WhatsApp intégrée ouverte pour ${normalizedPhone}.`
          );
          toast.success("Messagerie WhatsApp intégrée ouverte", {
            description: finalPath
              ? `PDF prêt : ${finalPath}`
              : `Destinataire : ${normalizedPhone}`,
          });
        } else {
          const waUrl = ShareService.generateWhatsAppLink(
            normalizedPhone,
            whatsappMessage
          );
          if (typeof window !== "undefined" && window.electron?.openExternal) {
            await window.electron.openExternal(waUrl);
          } else if (typeof window !== "undefined") {
            window.open(waUrl, "_blank");
          }
          toast.success("Ouverture de WhatsApp réussie");
          onOpenChange(false);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Erreur lors de l'envoi WhatsApp";
        toast.error("Erreur lors de l'envoi WhatsApp", { description: message });
      } finally {
        setIsSending(false);
      }
      return;
    }

    // Canal Email
    if (!isEmailValid) {
      const msg = "Veuillez saisir une adresse email destinataire valide";
      setEmailError(msg);
      toast.error(msg);
      return;
    }
    setEmailError(null);

    try {
      setIsSending(true);
      await syncClientContactIfNeeded(undefined, email.trim());

      const { pdfBase64 } = await exportElementToPdfBase64(
        hiddenA4ContainerId,
        pdfFilename
      );

      const htmlBody = ShareService.generateDocumentEmailHtml(
        docData,
        type,
        companyName,
        emailMessage
      );

      const response = await sendDocumentEmailInAppAction({
        to: email.trim(),
        subject:
          emailSubject.trim() ||
          ShareService.generateEmailSubject(docData, type, companyName),
        textBody: emailMessage,
        htmlBody,
        pdfBase64,
        pdfFilename,
        documentNumber: docData.number,
        documentType: normalizedKind,
      });

      if (!response.success) {
        if ((response.details as { code?: string } | undefined)?.code === "SMTP_NOT_CONFIGURED") {
          setShowQuickSmtpForm(true);
          toast.info("Configuration SMTP requise pour l'envoi direct", {
            description:
              "Configurez votre serveur SMTP ci-dessous ou utilisez l'enregistrement PDF rapide.",
          });
          return;
        }
        throw new Error(response.error || "Échec de l'envoi de l'email");
      }

      setConfirmationMessage(
        `Email envoyé avec succès à ${email.trim()} avec la pièce jointe ${pdfFilename}.`
      );
      toast.success("Email envoyé avec succès", {
        description: `Destinataire : ${email.trim()} • Pièce jointe : ${pdfFilename}`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erreur lors de l'envoi de l'email";
      toast.error("Échec de l'envoi de l'email", { description: message });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      {/* Rendu A4 autonome hors-écran pour génération PDF fidèle depuis n'importe quelle vue */}
      {open && docData && (
        <div
          style={{
            position: "fixed",
            left: "-9999px",
            top: 0,
            width: "210mm",
            pointerEvents: "none",
            zIndex: -1,
          }}
          aria-hidden="true"
        >
          <div id={hiddenA4ContainerId}>
            <DocumentA4
              data={
                docData as unknown as
                  | InvoiceResponse
                  | QuoteResponse
                  | CreditNoteResponse
              }
              type={a4Type}
            />
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[88vh] flex flex-col overflow-hidden p-0 gap-0 bg-card border-border">
          {/* 1. EN-TÊTE FIXE */}
          <DialogHeader className="shrink-0 px-6 pt-5 pb-4 border-b border-border bg-muted/20 space-y-3">
            <div className="flex items-start justify-between gap-3 pr-6">
              <div>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  <Send className="w-5 h-5 text-primary" />
                  Envoyer le document
                </DialogTitle>
                <DialogDescription className="text-xs mt-1">
                  Envoyez {docLabelLower} N°{" "}
                  <span className="font-semibold text-foreground">{docData.number}</span>{" "}
                  ({docData.clientName}) directement depuis l&apos;application.
                </DialogDescription>
              </div>
            </div>

            <Tabs
              value={channel}
              onValueChange={(v) => {
                setChannel(v as "whatsapp" | "email");
                setConfirmationMessage(null);
              }}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2 h-9">
                <TabsTrigger value="whatsapp" className="flex items-center gap-2 text-xs cursor-pointer">
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp Intégré
                </TabsTrigger>
                <TabsTrigger value="email" className="flex items-center gap-2 text-xs cursor-pointer">
                  <Mail className="w-4 h-4" />
                  Email (PDF joint)
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </DialogHeader>

          {/* 2. CORPS SCROLLABLE */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {confirmationMessage && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 flex items-start gap-3 text-emerald-700 dark:text-emerald-300 text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                <div className="space-y-1">
                  <p className="font-semibold">Envoi confirmé</p>
                  <p className="leading-relaxed">{confirmationMessage}</p>
                </div>
              </div>
            )}

            {channel === "whatsapp" ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="share-whatsapp-phone" className="text-xs font-semibold">
                    Numéro WhatsApp
                  </Label>
                  {phone.trim() !== "" && (
                    <Badge
                      variant="outline"
                      className={
                        isPhoneValid
                          ? "text-[10px] border-emerald-500/40 text-emerald-600 bg-emerald-500/10"
                          : "text-[10px] border-destructive/40 text-destructive bg-destructive/10"
                      }
                    >
                      {isPhoneValid
                        ? `Numéro valide (${ShareService.normalizePhoneForWhatsApp(phone)})`
                        : "Numéro incomplet"}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center px-3 h-9 rounded-md border border-border bg-muted text-xs font-semibold text-muted-foreground shrink-0">
                    +241
                  </span>
                  <Input
                    id="share-whatsapp-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (phoneError) setPhoneError(null);
                    }}
                    placeholder="Entrez le numéro WhatsApp (ex: +241 77 00 00 00)"
                    className={phoneError ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                </div>
                {phoneError && (
                  <p className="text-xs text-destructive font-medium flex items-center gap-1.5 pt-0.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {phoneError}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {!isSmtpConfigured && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-2.5">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="text-xs space-y-1">
                        <p className="font-semibold text-amber-800 dark:text-amber-300">
                          Serveur d&apos;envoi Email (SMTP) non configuré
                        </p>
                        <p className="text-amber-700/90 dark:text-amber-400/90">
                          Configurez votre SMTP en 1 clic pour envoyer vos PDF directement, ou enregistrez le PDF et copiez l&apos;email formaté.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setShowQuickSmtpForm((prev) => !prev)}
                        className="h-8 text-xs gap-1.5 bg-background cursor-pointer"
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                        {showQuickSmtpForm ? "Masquer la configuration SMTP" : "Configurer le SMTP en 1 clic"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={handleSaveAndRevealForEmailFallback}
                        disabled={isSending}
                        className="h-8 text-xs gap-1.5 cursor-pointer"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        Enregistrer le PDF & Copier l&apos;email
                      </Button>
                    </div>

                    {showQuickSmtpForm && (
                      <div className="pt-2 border-t border-amber-500/20 grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-background/80 p-3 rounded-lg">
                        <div className="space-y-1">
                          <Label className="text-[11px]">Hôte SMTP</Label>
                          <Input
                            value={smtpHost}
                            onChange={(e) => setSmtpHost(e.target.value)}
                            placeholder="smtp.gmail.com"
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">Port SMTP</Label>
                          <Input
                            type="number"
                            value={smtpPort}
                            onChange={(e) => setSmtpPort(Number(e.target.value) || 587)}
                            placeholder="587"
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">Email / Utilisateur SMTP</Label>
                          <Input
                            value={smtpUser}
                            onChange={(e) => setSmtpUser(e.target.value)}
                            placeholder="contact@entreprise.ga"
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">Mot de passe SMTP</Label>
                          <Input
                            type="password"
                            value={smtpPass}
                            onChange={(e) => setSmtpPass(e.target.value)}
                            placeholder="••••••••••••"
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="sm:col-span-2 flex items-center justify-between pt-1">
                          <label className="flex items-center gap-2 text-xs cursor-pointer">
                            <Checkbox
                              checked={smtpSecure}
                              onCheckedChange={(c) => setSmtpSecure(Boolean(c))}
                            />
                            <span>SSL/TLS direct (Port 465)</span>
                          </label>
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleSaveQuickSmtp}
                            disabled={isSavingSmtp}
                            className="h-8 text-xs gap-1.5 cursor-pointer"
                          >
                            {isSavingSmtp && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            Tester & Activer SMTP
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="share-email-recipient" className="text-xs font-semibold">
                    Adresse Email du destinataire
                  </Label>
                  <Input
                    id="share-email-recipient"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError(null);
                    }}
                    placeholder="client@entreprise.com"
                    className={emailError ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  {emailError && (
                    <p className="text-xs text-destructive font-medium flex items-center gap-1.5 pt-0.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {emailError}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="share-email-subject" className="text-xs font-semibold">
                    Objet de l&apos;email
                  </Label>
                  <Input
                    id="share-email-subject"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="Objet de votre email"
                  />
                </div>
              </div>
            )}

            {/* Carte d'aperçu de la pièce jointe PDF A4 */}
            <div className="rounded-xl border border-border bg-muted/30 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">
                    {pdfFilename}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Document A4 généré automatiquement
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadPdf}
                  disabled={isDownloadingPdf}
                  className="h-8 text-xs gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  {isDownloadingPdf ? "Génération..." : "Télécharger PDF"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyMessage}
                  className="h-8 text-xs gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copier le message
                </Button>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="generatePdf"
                checked={generatePdf}
                onCheckedChange={(c) => setGeneratePdf(Boolean(c))}
              />
              <Label
                htmlFor="generatePdf"
                className="text-xs leading-none font-normal cursor-pointer text-muted-foreground"
              >
                Joindre automatiquement le document PDF A4 officiel ({pdfFilename})
              </Label>
            </div>

            {/* Zone Message */}
            <div className="space-y-1.5">
              <Label htmlFor="share-message-body" className="text-xs font-semibold">
                Message ({channel === "whatsapp" ? "Format WhatsApp" : "Format Email professionnel sans astérisques"})
              </Label>
              <Textarea
                id="share-message-body"
                rows={7}
                value={channel === "whatsapp" ? whatsappMessage : emailMessage}
                onChange={(e) => {
                  if (channel === "whatsapp") {
                    setWhatsappMessage(e.target.value);
                  } else {
                    setEmailMessage(e.target.value);
                  }
                }}
                className="min-h-[150px] text-xs leading-relaxed resize-y font-sans"
              />
            </div>
          </div>

          {/* 3. PIED DE MODALE FIXE */}
          <DialogFooter className="shrink-0 px-6 py-3.5 border-t border-border bg-muted/30 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSending}
              className="cursor-pointer"
            >
              Annuler
            </Button>
            <Button
              type="button"
              onClick={handleSend}
              disabled={
                isSending ||
                (channel === "whatsapp" ? !phone.trim() : !email.trim())
              }
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : channel === "whatsapp" ? (
                <MessageCircle className="w-4 h-4" />
              ) : (
                <Mail className="w-4 h-4" />
              )}
              Envoyer maintenant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
