"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { DatePicker } from "@workspace/ui/components/date-picker";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Textarea } from "@workspace/ui/components/textarea";
import { useStore, type DraftItem, type Invoice, type Client } from "@/lib/store";
import { toast } from "sonner";
import { FullScreenDocumentViewer } from "@/components/fullscreen-document-viewer";
import { computeTotals, computeItemTotal } from "@/lib/math-logic";
import { getInvoiceById, createInvoice, getInvoices } from "@/app/actions/invoice.actions";
import { DocumentCommercialHeader } from "@/components/editor/DocumentCommercialHeader";
import { EditorItemsTable } from "@/components/editor/EditorItemsTable";
import { FiscalSummaryCard } from "@/components/editor/FiscalSummaryCard";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";

interface InvoiceEditorProps {
  onBack: () => void;
  editingId?: string | null;
}

export function InvoiceEditor({ onBack, editingId }: InvoiceEditorProps) {
  const clients = useStore((state) => state.clients);
  const settings = useStore((state) => state.settings);
  const setInvoices = useStore((state) => state.setInvoices);
  const services = useStore((state) => state.services);
  const setInvoiceDraft = useStore((state) => state.setInvoiceDraft);
  const clearInvoiceDraft = useStore((state) => state.clearInvoiceDraft);

  const isNew = !editingId;

  const [localDraft, setLocalDraft] = React.useState(() => {
    const today = new Date();
    return {
      selectedClient: null as Client | null,
      items: [{ id: "1", description: "", quantity: 1, unitPrice: 0, total: 0 }] as DraftItem[],
      invoiceDate: today.toISOString().split("T")[0],
      dueDate: "",
      discount: 0,
      notes: settings.mentionsLegales || "",
      subject: "",
    };
  });

  const selectedClient = localDraft.selectedClient;
  const items = localDraft.items;
  const invoiceDate = localDraft.invoiceDate;
  const dueDate = localDraft.dueDate;
  const discount = localDraft.discount;
  const notes = localDraft.notes;
  const subject = localDraft.subject;

  const setSelectedClient = (client: Client | null) =>
    setLocalDraft((prev) => ({ ...prev, selectedClient: client }));
  const setDiscount = (val: number) =>
    setLocalDraft((prev) => ({ ...prev, discount: val }));
  const setNotes = (val: string) =>
    setLocalDraft((prev) => ({ ...prev, notes: val }));
  const setSubject = (val: string) =>
    setLocalDraft((prev) => ({ ...prev, subject: val }));
  const setInvoiceDate = (val: string) =>
    setLocalDraft((prev) => ({ ...prev, invoiceDate: val }));
  const setDueDate = (val: string) =>
    setLocalDraft((prev) => ({ ...prev, dueDate: val }));
  const setItems = (newItems: DraftItem[] | ((prev: DraftItem[]) => DraftItem[])) => {
    setLocalDraft((prev) => ({
      ...prev,
      items: typeof newItems === "function" ? newItems(prev.items) : newItems,
    }));
  };

  const isDirty = React.useMemo(() => {
    if (!isNew) return false;
    return !!(selectedClient || items.some((it) => it.description || it.unitPrice > 0));
  }, [isNew, selectedClient, items]);

  const { guardNavigation } = useUnsavedChangesGuard({ isDirty });

  const handleBackSafe = () => {
    guardNavigation(onBack);
  };

  const handleSaveDraft = () => {
    setInvoiceDraft(localDraft);
    toast.success("Brouillon enregistré temporairement.");
  };

  React.useEffect(() => {
    const blankDraft = {
      selectedClient: null,
      items: [{ id: "1", description: "", quantity: 1, unitPrice: 0, total: 0 }],
      invoiceDate: new Date().toISOString().split("T")[0],
      dueDate: "",
      discount: 0,
      notes: settings.mentionsLegales || "",
      subject: "",
    };

    if (isNew) {
      clearInvoiceDraft();
      setLocalDraft(blankDraft);
    }

    return () => {
      if (isNew) {
        clearInvoiceDraft();
        setLocalDraft(blankDraft);
      }
    };
  }, [isNew, clearInvoiceDraft, settings.mentionsLegales]);

  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!editingId) return;

    const fetchInvoice = async () => {
      try {
        const response = await getInvoiceById(editingId);
        if (!response.success || !response.data) {
          toast.error(response.error || "Facture introuvable ou supprimée");
          onBack();
          return;
        }

        const data = response.data;
        setSelectedClient(
          clients.find((c) => c.id === data.clientId) || {
            id: data.clientId,
            name: data.clientName,
            email: data.clientEmail,
            phone: "",
            address: "",
          }
        );
        setItems(data.items);
        setInvoiceDate(data.date);
        setDueDate(data.dueDate || "");
        setSubject(data.subject || "");
        setDiscount(data.discount);
        setNotes(data.notes || "");
      } catch {
        toast.error("Impossible de charger la facture — vérifiez la connexion au serveur");
        onBack();
      }
    };

    fetchInvoice();
  }, [editingId, clients, onBack]);

  const updateItem = (itemId: string, field: keyof DraftItem, value: string | number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const updated = { ...item, [field]: value };
          if (field === "quantity" || field === "unitPrice") {
            if (field === "quantity") updated.quantity = Math.max(0.01, Number(updated.quantity) || 1);
            if (field === "unitPrice") updated.unitPrice = Math.round(Number(updated.unitPrice) || 0);
            if (Number(updated.unitPrice) < 0) updated.unitPrice = 0;
            updated.total = computeItemTotal(Number(updated.quantity), Number(updated.unitPrice));
          }

          if (field === "description" && typeof value === "string") {
            const matchedService = services.find(
              (s) => s.name.toLowerCase() === value.toLowerCase()
            );
            if (matchedService) {
              updated.unitPrice = matchedService.unitPrice;
              updated.total = computeItemTotal(Number(updated.quantity), updated.unitPrice);
            }
          }

          return updated;
        }
        return item;
      })
    );
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        description: "",
        quantity: 1,
        unitPrice: 0,
        total: 0,
      },
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const { subtotal, netHT, cssAmount, taxBase, tpsAmount, tvaAmount, total } = computeTotals(
    items.map((item) => ({ quantity: Number(item.quantity) || 0, unitPrice: Number(item.unitPrice) || 0 })),
    discount,
    {
      tvaRate: settings.tvaRate ?? 0,
      tpsRate: settings.tpsRate ?? 9.5,
      cssRate: settings.cssRate ?? 0,
    }
  );

  const handleSave = async (status: Invoice["status"] = "UNPAID") => {
    if (isSubmitting) return;

    if (!selectedClient) {
      toast.error("Veuillez sélectionner un client");
      return;
    }

    if (items.some((item) => !item.description || item.quantity <= 0 || item.unitPrice < 0)) {
      toast.error("Veuillez remplir correctement tous les articles");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingId) {
        throw new Error("Une facture générée est strictement immuable et ne peut pas être modifiée.");
      }

      const payload = {
        clientId: selectedClient.id,
        clientName: selectedClient.name,
        clientEmail: selectedClient.email && selectedClient.email.trim() !== "" ? selectedClient.email.trim() : null,
        date: invoiceDate,
        dueDate: dueDate && dueDate.trim() !== "" ? dueDate.trim() : undefined,
        items,
        notes,
        subject: subject || undefined,
        discount,
        status,
      };

      const response = await createInvoice(payload as any);
      if (!response?.success) throw new Error(response?.error || "Failed to save invoice");

      const newInvoices = await getInvoices();
      if (newInvoices.success && newInvoices.data) {
        setInvoices(newInvoices.data);
      }
      clearInvoiceDraft();
      toast.success("Facture enregistrée avec succès");
      onBack();
    } catch (error) {
      console.error("[InvoiceEditor] handleSave error:", error);
      const msg = error instanceof Error ? error.message : "Erreur lors de l'enregistrement de la facture";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  useKeyboardShortcuts({
    onSave: () => handleSave("UNPAID"),
    onEscape: handleBackSafe,
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBackSafe} className="cursor-pointer">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Nouvelle Facture</h1>
            <p className="text-muted-foreground mt-1">Créez une facture commerciale (sans devis associé)</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <DocumentCommercialHeader
            type="facture"
            client={selectedClient}
            onSelectClient={setSelectedClient}
            clients={clients}
            docDate={invoiceDate || ""}
            onDocDateChange={setInvoiceDate}
            secondaryDate={dueDate || ""}
            onSecondaryDateChange={setDueDate}
            secondaryDateLabel="Date d'échéance"
            subject={subject || ""}
            onSubjectChange={setSubject}
            disabled={isSubmitting}
          />

          <EditorItemsTable
            items={items}
            services={services}
            onUpdateItem={updateItem}
            onAddItem={addItem}
            onRemoveItem={removeItem}
            isSubmitting={isSubmitting}
          />

          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-foreground font-semibold text-base">Notes et Conditions</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notes || ""}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Indiquez les conditions de règlement, coordonnées bancaires ou toute mention complémentaire..."
                className="min-h-[90px] resize-y bg-secondary/30 border-border text-sm focus:ring-1"
                disabled={isSubmitting}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <FiscalSummaryCard
            subtotal={subtotal}
            discount={discount}
            onDiscountChange={setDiscount}
            netHT={netHT}
            cssAmount={cssAmount}
            taxBase={taxBase}
            tpsAmount={tpsAmount}
            tvaAmount={tvaAmount}
            total={total}
            cssRate={settings.cssRate ?? 0}
            tpsRate={settings.tpsRate ?? 9.5}
            tvaRate={settings.tvaRate ?? 0}
            isSubmitting={isSubmitting}
            canPreview={!!selectedClient}
            onPreview={() => setPreviewOpen(true)}
            onSave={() => handleSave("UNPAID")}
            saveLabel="Générer la Facture (Ctrl+S)"
            onSaveDraft={isNew ? async () => handleSaveDraft() : undefined}
          />
        </div>
      </div>

      {previewOpen && selectedClient && (
        <FullScreenDocumentViewer
          type="facture"
          title="Brouillon - Facture"
          onClose={() => setPreviewOpen(false)}
          data={{
            id: "draft",
            number: "BROUILLON",
            clientId: selectedClient.id,
            clientName: selectedClient.name,
            clientEmail: selectedClient.email,
            date: invoiceDate,
            dueDate: invoiceDate,
            items: items as DraftItem[],
            subtotal,
            discount,
            taxBase,
            tpsAmount,
            tvaAmount,
            cssAmount,
            total,
            notes,
            status: "draft",
            payments: [],
            createdAt: new Date().toISOString(),
          } as unknown as Invoice}
        />
      )}
    </motion.div>
  );
}
