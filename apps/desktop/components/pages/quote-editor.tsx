"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { useStore, type DraftItem, type Quote, type Client } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { toast } from "sonner";
import { FullScreenDocumentViewer } from "@/components/fullscreen-document-viewer";
import { computeTotals, computeItemTotal } from "@/lib/math-logic";
import { getQuoteById, createQuote, updateQuote, getQuotes } from "@/app/actions/quote.actions";
import { QuoteEditorHeader } from "@/components/editor/QuoteEditorHeader";
import { QuoteInfoCard } from "@/components/editor/QuoteInfoCard";
import { QuoteNotesCard } from "@/components/editor/QuoteNotesCard";
import { ClientSelectCard } from "@/components/editor/ClientSelectCard";
import { EditorItemsTable } from "@/components/editor/EditorItemsTable";
import { FiscalSummaryCard } from "@/components/editor/FiscalSummaryCard";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import type { QuoteCreateRequest } from "@/lib/types/api";

interface QuoteEditorProps {
  onBack: () => void;
  editingId?: string | null;
}

export function QuoteEditor({ onBack, editingId }: QuoteEditorProps) {
  const { clients, settings, setQuotes, services, setQuoteDraft, clearQuoteDraft } = useStore(
    useShallow((state) => ({
      clients: state.clients,
      settings: state.settings,
      setQuotes: state.setQuotes,
      services: state.services,
      setQuoteDraft: state.setQuoteDraft,
      clearQuoteDraft: state.clearQuoteDraft,
    }))
  );

  const isNew = !editingId;

  const [localDraft, setLocalDraft] = React.useState(() => {
    const today = new Date();
    const next30 = new Date(today);
    next30.setDate(today.getDate() + 30);
    return {
      selectedClient: null as Client | null,
      items: [{ id: "1", description: "", quantity: 1, unitPrice: 0, total: 0 }] as DraftItem[],
      quoteDate: today.toISOString().split("T")[0],
      discount: 0,
      notes: settings.mentionsLegales || "",
      subject: "",
      validUntil: next30.toISOString().split("T")[0],
      status: "EN_ATTENTE" as Quote["status"],
    };
  });

  const { selectedClient, items, quoteDate, discount, notes, subject, validUntil, status } = localDraft;

  const updateDraft = React.useCallback(<K extends keyof typeof localDraft>(field: K, val: (typeof localDraft)[K]) => {
    setLocalDraft((prev) => ({ ...prev, [field]: val }));
  }, []);

  const setItems = React.useCallback((newItems: DraftItem[] | ((prev: DraftItem[]) => DraftItem[])) => {
    setLocalDraft((prev) => ({
      ...prev,
      items: typeof newItems === "function" ? newItems(prev.items) : newItems,
    }));
  }, []);

  const isDirty = React.useMemo(() => {
    if (!isNew) return false;
    return !!(selectedClient || items.some((it) => it.description || it.unitPrice > 0));
  }, [isNew, selectedClient, items]);

  const { guardNavigation } = useUnsavedChangesGuard({ isDirty });

  const handleBackSafe = () => {
    guardNavigation(onBack);
  };

  const handleSaveDraft = () => {
    setQuoteDraft(localDraft);
    toast.success("Brouillon enregistré temporairement.");
  };

  const initialMentionsLegales = React.useRef(settings.mentionsLegales);

  React.useEffect(() => {
    const blankDraft = {
      selectedClient: null,
      items: [{ id: "1", description: "", quantity: 1, unitPrice: 0, total: 0 }],
      quoteDate: new Date().toISOString().split("T")[0],
      discount: 0,
      notes: initialMentionsLegales.current || "",
      subject: "",
      validUntil: (() => {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        return d.toISOString().split("T")[0];
      })(),
      status: "EN_ATTENTE" as Quote["status"],
    };

    if (isNew) {
      clearQuoteDraft();
      setLocalDraft(blankDraft);
    }

    return () => {
      if (isNew) {
        clearQuoteDraft();
        setLocalDraft(blankDraft);
      }
    };
  }, [isNew, clearQuoteDraft]);

  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!editingId) return;

    let isMounted = true;
    const fetchQuote = async () => {
      try {
        const response = await getQuoteById(editingId);
        if (!isMounted) return;
        if (!response.success || !response.data) {
          toast.error(response.error || "Devis introuvable ou supprimé");
          onBack();
          return;
        }

        const data = response.data;
        updateDraft(
          "selectedClient",
          clients.find((c) => c.id === data.clientId) || {
            id: data.clientId,
            name: data.clientName,
            email: data.clientEmail || null,
            phone: "",
            address: "",
          }
        );
        setItems(data.items);
        updateDraft("quoteDate", data.date);
        updateDraft("validUntil", data.validUntil || "");
        updateDraft("subject", data.subject || "");
        updateDraft("discount", data.discount);
        updateDraft("notes", data.notes || "");
        updateDraft("status", data.status);
      } catch {
        if (isMounted) {
          toast.error("Impossible de charger le devis — vérifiez la connexion locale");
          onBack();
        }
      }
    };

    fetchQuote();

    return () => {
      isMounted = false;
    };
  }, [editingId, clients, onBack, updateDraft, setItems]);

  const updateItem = (itemId: string, field: keyof DraftItem, value: string | number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const updated = { ...item, [field]: value };
          if (field === "quantity" || field === "unitPrice") {
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

  const handleSave = async (targetStatus: Quote["status"] = "EN_ATTENTE") => {
    if (isSubmitting) return;

    if (!selectedClient) {
      toast.error("Veuillez sélectionner un client");
      return;
    }

    if (!quoteDate || !quoteDate.trim()) {
      toast.error("La date d'émission est requise");
      return;
    }

    if (
      items.length === 0 ||
      items.some(
        (item) => !item.description?.trim() || Number(item.quantity) <= 0 || Number(item.unitPrice) < 0
      )
    ) {
      toast.error("Veuillez renseigner correctement toutes les lignes (description, quantité > 0 et prix unitaire >= 0)");
      return;
    }

    if (status === "CONVERTI") {
      toast.error("Ce devis a été converti en facture. L'édition est verrouillée.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: QuoteCreateRequest = {
        clientId: selectedClient.id,
        clientName: selectedClient.name,
        clientEmail: selectedClient.email || null,
        date: quoteDate,
        items: items.map((it) => ({
          description: it.description.trim(),
          quantity: Number(it.quantity) || 1,
          unitPrice: Math.max(0, Math.round(Number(it.unitPrice) || 0)),
        })),
        notes: notes?.trim() || undefined,
        subject: subject?.trim() || undefined,
        validUntil: validUntil && validUntil.trim() !== "" ? validUntil.trim() : null,
        discount: Math.max(0, Math.round(Number(discount) || 0)),
      };

      const response = editingId
        ? await updateQuote(editingId, payload)
        : await createQuote(payload);

      if (!response.success) throw new Error(response.error || "Failed to save quote");

      const newQuotes = await getQuotes();
      if (newQuotes.success && newQuotes.data) {
        setQuotes(newQuotes.data);
      }
      clearQuoteDraft();
      toast.success("Devis enregistré avec succès");
      onBack();
    } catch (error) {
      console.error("[QuoteEditor] handleSave error:", error);
      toast.error("Erreur lors de l'enregistrement du devis");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Raccourci ergonomique Ctrl+S / Cmd+S
  useKeyboardShortcuts({
    onSave: () => handleSave("EN_ATTENTE"),
    onEscape: handleBackSafe,
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-6">
      <QuoteEditorHeader
        editingId={editingId}
        status={status}
        onBackSafe={handleBackSafe}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <QuoteInfoCard
            quoteDate={quoteDate || ""}
            validUntil={validUntil || ""}
            subject={subject || ""}
            disabled={status === "CONVERTI"}
            onQuoteDateChange={(d) => updateDraft("quoteDate", d)}
            onValidUntilChange={(d) => updateDraft("validUntil", d)}
            onSubjectChange={(s) => updateDraft("subject", s)}
          />

          <ClientSelectCard
            selectedClient={selectedClient}
            onSelectClient={(c) => updateDraft("selectedClient", c)}
            clients={clients}
            title="Client"
            description="Sélectionnez un client dans votre base de données pour ce devis"
          />

          <EditorItemsTable
            items={items}
            services={services}
            onUpdateItem={updateItem}
            onAddItem={addItem}
            onRemoveItem={removeItem}
            isSubmitting={isSubmitting || status === "CONVERTI"}
          />

          <QuoteNotesCard
            notes={notes || ""}
            onChange={(val) => updateDraft("notes", val)}
            disabled={status === "CONVERTI" || isSubmitting}
          />
        </div>

        <div className="space-y-6">
          <FiscalSummaryCard
            subtotal={subtotal}
            discount={discount}
            onDiscountChange={(d) => updateDraft("discount", d)}
            netHT={netHT}
            cssAmount={cssAmount}
            taxBase={taxBase}
            tpsAmount={tpsAmount}
            tvaAmount={tvaAmount}
            total={total}
            cssRate={settings.cssRate ?? 0}
            tpsRate={settings.tpsRate ?? 9.5}
            tvaRate={settings.tvaRate ?? 0}
            isSubmitting={isSubmitting || status === "CONVERTI"}
            canPreview={!!selectedClient}
            onPreview={() => setPreviewOpen(true)}
            onSave={() => handleSave("EN_ATTENTE")}
            saveLabel={status === "CONVERTI" ? "Devis Converti (Lecture seule)" : "Enregistrer le Devis (Ctrl+S)"}
            onSaveDraft={isNew ? async () => handleSaveDraft() : undefined}
          />
        </div>
      </div>

      {previewOpen && selectedClient && (
        <FullScreenDocumentViewer
          type="devis"
          title="Brouillon - Devis"
          onClose={() => setPreviewOpen(false)}
          data={{
            id: "draft",
            number: "BROUILLON",
            clientId: selectedClient.id,
            clientName: selectedClient.name,
            clientEmail: selectedClient.email,
            date: quoteDate,
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
            createdAt: new Date().toISOString(),
          } as unknown as Quote}
        />
      )}
    </motion.div>
  );
}
