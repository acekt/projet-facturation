"use client";

import * as React from "react";
import { Mail, MessageCircle, Send, FileText, CheckCircle2, Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@workspace/ui/components/dialog";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import { Input } from "@workspace/ui/components/input";
import { Textarea } from "@workspace/ui/components/textarea";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { Quote, Invoice, useStore } from "@/lib/store";
import { ShareService } from "@/lib/services/ShareService";
import { logDocumentShareAction } from "@/app/actions/share.actions";
import { toast } from "sonner";
import { printElement } from "@/lib/electron-print";

interface ShareDocumentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: Quote | Invoice;
  type: "quote" | "invoice";
}

export function ShareDocumentModal({
  open,
  onOpenChange,
  document,
  type
}: ShareDocumentModalProps) {
  const [channel, setChannel] = React.useState<"whatsapp" | "email">("whatsapp");
  const [recipient, setRecipient] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [generatePdf, setGeneratePdf] = React.useState(true);
  const [isSending, setIsSending] = React.useState(false);

  const settings = useStore(s => s.settings);
  const companyName = settings?.companyName || "Notre Entreprise";

  React.useEffect(() => {
    if (open && document) {
      if (channel === "whatsapp") {
        setRecipient(document.clientEmail || "");
        const defaultMessage = ShareService.generateDocumentMessage(document, type, companyName);
        setMessage(defaultMessage);
      } else {
        setRecipient(document.clientEmail || "");
        const defaultMessage = ShareService.generateDocumentMessage(document, type, companyName);
        setMessage(defaultMessage);
      }
    }
  }, [open, channel, document, type, companyName]);

  const handleSend = async () => {
    if (!recipient) {
      toast.error("Veuillez saisir un destinataire");
      return;
    }

    try {
      setIsSending(true);

      let finalUrl = "";
      const docLabel = type === "quote" ? "Devis" : "Facture";
      const filename = `${docLabel}_${document.number.replace(/\//g, "_")}.pdf`;

      if (generatePdf) {
        if (typeof window !== "undefined" && window.electron?.exportPDF) {
            toast.info("Génération du PDF en cours...");
            toast.success("Veuillez joindre le PDF manuellement après l'ouverture de l'application.");
        }
      }

      if (channel === "whatsapp") {
        finalUrl = ShareService.generateWhatsAppLink(recipient, message);
      } else {
        finalUrl = ShareService.generateEmailLink(recipient, document, type, message);
      }

      await logDocumentShareAction(
        channel === "whatsapp" ? "WhatsApp" : "Email",
        document.number,
        recipient
      );

      if (typeof window !== "undefined" && window.electron?.openExternal) {
        await window.electron.openExternal(finalUrl);
      } else {
        window.open(finalUrl, "_blank");
      }

      toast.success(`Redirection vers ${channel === "whatsapp" ? "WhatsApp" : "l'Email"} réussie`);
      onOpenChange(false);
    } catch (error: any) {
      console.error(error);
      toast.error("Erreur lors de l'envoi", { description: error.message });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden bg-card border-border">
        <DialogHeader className="p-6 pb-4 bg-muted/30">
          <DialogTitle className="text-xl flex items-center gap-2">
            <Send className="w-5 h-5 text-primary" />
            Envoyer le document
          </DialogTitle>
          <DialogDescription>
            Envoyez {type === "quote" ? "ce devis" : "cette facture"} N° {document.number} à votre client.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-6">
          <Tabs value={channel} onValueChange={(v) => setChannel(v as "whatsapp" | "email")} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="whatsapp" className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </TabsTrigger>
              <TabsTrigger value="email" className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email
              </TabsTrigger>
            </TabsList>

            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label>{channel === "whatsapp" ? "Numéro WhatsApp" : "Adresse Email"}</Label>
                <Input
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder={channel === "whatsapp" ? "+241 77 00 00 00" : "client@email.com"}
                />
              </div>

              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="min-h-[200px] resize-y"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="generatePdf"
                  checked={generatePdf}
                  onCheckedChange={(c) => setGeneratePdf(c as boolean)}
                />
                <Label
                  htmlFor="generatePdf"
                  className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 font-normal cursor-pointer"
                >
                  Télécharger / Générer le PDF A4 pour le joindre au message
                </Label>
              </div>
            </div>
          </Tabs>
        </div>

        <DialogFooter className="p-6 pt-4 bg-muted/30 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Annuler
          </Button>
          <Button onClick={handleSend} disabled={isSending || !recipient} className="gap-2">
            {isSending ? (
              <span className="animate-spin">⏳</span>
            ) : channel === "whatsapp" ? (
              <MessageCircle className="w-4 h-4" />
            ) : (
              <Mail className="w-4 h-4" />
            )}
            Envoyer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
