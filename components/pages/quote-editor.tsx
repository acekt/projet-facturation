"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Save,
  Send,
  Eye,
  Plus,
  Trash2,
  User,
  Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  useStore,
  type InvoiceItem,
  type DraftItem,
  type Quote,
} from "@/lib/store";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { FullScreenDocumentViewer } from "@/components/fullscreen-document-viewer";
import { computeTotals } from "@/lib/math-logic";

interface QuoteEditorProps {
  onBack: () => void;
  editingId?: string | null;
}

export function QuoteEditor({ onBack, editingId }: QuoteEditorProps) {
  const clients = useStore((state) => state.clients);
  const settings = useStore((state) => state.settings);
  const setQuotes = useStore((state) => state.setQuotes);
  const services = useStore((state) => state.services);
  const setQuoteDraft = useStore((state) => state.setQuoteDraft);
  const clearQuoteDraft = useStore((state) => state.clearQuoteDraft);
  // ── NEW vs EDIT: strict lifecycle ──
  const isNew = !editingId;

  // Build a fresh blank draft (used for NEW mode)
  const freshDraft = React.useMemo(() => {
    const today = new Date();
    const next30 = new Date(today);
    next30.setDate(today.getDate() + 30);
    return {
      selectedClient: null as (typeof clients)[0] | null,
      items: [{ id: "1", description: "", quantity: 1, unitPrice: 0, total: 0 }] as DraftItem[],
      quoteDate: today.toISOString().split("T")[0],
      discount: 0,
      notes: "",
      subject: "",
      validUntil: next30.toISOString().split("T")[0],
      status: "EN_ATTENTE" as Quote["status"],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally stable — only computed once on mount

  // Local State to prevent global re-renders on every keystroke
  // For NEW mode: always start blank. For EDIT: start blank then load from API.
  const [localDraft, setLocalDraft] = React.useState(isNew ? freshDraft : freshDraft);

  const selectedClient = localDraft.selectedClient;
  const items = localDraft.items;
  const quoteDate = localDraft.quoteDate;
  const discount = localDraft.discount;
  const notes = localDraft.notes;
  const subject = localDraft.subject;
  const validUntil = localDraft.validUntil;
  const status = localDraft.status;

  const setSelectedClient = (client: (typeof clients)[0] | null) =>
    setLocalDraft((prev) => ({ ...prev, selectedClient: client }));
  const setDiscount = (val: number) =>
    setLocalDraft((prev) => ({ ...prev, discount: val }));
  const setNotes = (val: string) =>
    setLocalDraft((prev) => ({ ...prev, notes: val }));
  const setSubject = (val: string) =>
    setLocalDraft((prev) => ({ ...prev, subject: val }));
  const setValidUntil = (val: string) =>
    setLocalDraft((prev) => ({ ...prev, validUntil: val }));
  const setQuoteDate = (val: string) =>
    setLocalDraft((prev) => ({ ...prev, quoteDate: val }));
  const setStatus = (val: Quote["status"]) =>
    setLocalDraft((prev) => ({ ...prev, status: val }));
  const setItems = (
    newItems: DraftItem[] | ((prev: DraftItem[]) => DraftItem[]),
  ) => {
    setLocalDraft((prev) => ({
      ...prev,
      items: typeof newItems === "function" ? newItems(prev.items) : newItems,
    }));
  };

  // Sync back to global store manually when explicitly saving as draft
  const handleSaveDraft = () => {
    setQuoteDraft(localDraft);
    toast.success("Brouillon enregistré temporairement.");
  };

  // Cleanup: purge global draft on unmount to prevent ghost data
  React.useEffect(() => {
    // 1. Force clear on mount for NEW items explicitly
    if (isNew) {
      clearQuoteDraft();
      setLocalDraft(freshDraft);
    }

    // 2. Clear on unmount strictly
    return () => {
      if (isNew) {
        clearQuoteDraft();
      }
    };
  }, [isNew, clearQuoteDraft, freshDraft]);

  const [clientSearchOpen, setClientSearchOpen] = React.useState(false);
  const [clientSearch, setClientSearch] = React.useState("");
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [isSubmitting, startSubmitTransition] = React.useTransition();
  const [isLoading, setIsLoading] = React.useState(!!editingId);

  React.useEffect(() => {
    if (!editingId) return;

    const controller = new AbortController();

    fetch(`/api/quotes/${editingId}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 404) {
            toast.error("Devis introuvable ou supprimé");
          } else {
            toast.error(
              `Erreur serveur (${res.status}) — impossible de charger le devis`,
            );
          }
          onBack();
          return;
        }
        const data = await res.json();
        setSelectedClient(
          clients.find((c) => c.id === data.clientId) || {
            id: data.clientId,
            name: data.clientName,
            email: data.clientEmail,
            phone: "",
            address: "",
          },
        );
        setItems(data.items);
        setQuoteDate(data.date);
        setValidUntil(data.validUntil || "");
        setSubject(data.subject || "");
        setDiscount(data.discount);
        setNotes(data.notes || "");
        setStatus(data.status);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        toast.error(
          "Impossible de charger le devis — vérifiez la connexion au serveur",
        );
        onBack();
      });

    return () => controller.abort();
  }, [editingId]);

  const TAX_RATE = (settings.tvaRate ?? 0) / 100;
  const TPS_RATE = (settings.tpsRate ?? 9.5) / 100;
  const CSS_RATE = (settings.cssRate ?? 0) / 100;

  const filteredClients = clients.filter(
    (client) =>
      client.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
      client.email.toLowerCase().includes(clientSearch.toLowerCase()),
  );

  const updateItem = (
    itemId: string,
    field: keyof InvoiceItem,
    value: string | number,
  ) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const updated = { ...item, [field]: value };
          if (field === "quantity" || field === "unitPrice") {
            if (Number(updated.unitPrice) < 0) updated.unitPrice = 0;
            updated.total = Math.round(
              (Number(updated.quantity) || 0) *
                (Number(updated.unitPrice) || 0),
            );
          }

          // Auto-population from catalog
          if (field === "description" && typeof value === "string") {
            const matchedService = services.find(
              (s) => s.name.toLowerCase() === value.toLowerCase(),
            );
            if (matchedService) {
              updated.unitPrice = matchedService.unitPrice;
              updated.total = Math.round(
                (Number(updated.quantity) || 0) * updated.unitPrice,
              );
            }
          }

          return updated;
        }
        return item;
      }),
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

  const { subtotal, discount: computedDiscount, cssAmount, taxBase, tpsAmount, tvaAmount, total } = computeTotals(
    items.map(item => ({ quantity: Number(item.quantity) || 0, unitPrice: Number(item.unitPrice) || 0 })),
    discount,
    {
      tvaRate: settings.tvaRate ?? 0,
      tpsRate: settings.tpsRate ?? 9.5,
      cssRate: settings.cssRate ?? 0
    }
  );
  const netHT = Math.max(0, subtotal - Math.round(discount));

  const handleSave = (status: Quote["status"]) => {
    if (!selectedClient) {
      toast.error("Veuillez sélectionner un client");
      return;
    }

    if (
      items.some(
        (item) => !item.description || item.quantity <= 0 || item.unitPrice < 0,
      )
    ) {
      toast.error("Veuillez remplir correctement tous les articles");
      return;
    }

    if (status === "CONVERTI") {
      toast.error(
        "Ce devis a été converti en facture. L'édition est verrouillée.",
      );
      return;
    }

    startSubmitTransition(async () => {
      try {
        const url = editingId ? `/api/quotes/${editingId}` : "/api/quotes";
        const method = editingId ? "PUT" : "POST";
        const response = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: selectedClient.id,
            clientName: selectedClient.name,
            clientEmail: selectedClient.email,
            date: quoteDate,
            items,
            notes,
            subject: subject || undefined,
            validUntil: validUntil || undefined,
            discount,
            status,
          }),
        });

        if (!response.ok) throw new Error("Failed to save quote");

        const newQuotes = await fetch("/api/quotes").then((res) => res.json());
        setQuotes(newQuotes);

        toast.success("Devis enregistré avec succès");
        clearQuoteDraft();
        onBack();
      } catch (error) {
        console.error("[QuoteEditor] handleSave error:", error);
        toast.error("Erreur lors de l'enregistrement du devis");
      }
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              Nouveau Devis
            </h1>
            <p className="text-muted-foreground mt-1">
              Créez une proposition commerciale professionnelle
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {status === "CONVERTI" && (
            <div className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-sm font-semibold">
              Devis Converti (Lecture seule)
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-card border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-foreground font-semibold text-base">
                Informations du Devis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-sm">
                    Date d'émission
                  </Label>
                  <DatePicker
                    value={quoteDate || ""}
                    onChange={setQuoteDate}
                    disabled={status === "CONVERTI"}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-sm">
                    Date de validité
                  </Label>
                  <DatePicker
                    value={validUntil || ""}
                    onChange={setValidUntil}
                    disabled={status === "CONVERTI"}
                  />
                </div>
              </div>
              <div className="space-y-2 pt-2">
                <Label className="text-muted-foreground text-sm">
                  Objet du devis
                </Label>
                <Input
                  value={subject || ""}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Ex: Développement de l'application mobile"
                  className="bg-secondary border-border text-foreground"
                  disabled={status === "CONVERTI"}
                />
              </div>
            </CardContent>
          </Card>

          {/* Client Selection */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-foreground font-semibold text-base">
                Client
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedClient ? (
                <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10 ring-2 ring-border">
                      <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-sm font-medium">
                        {selectedClient.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-foreground font-medium">
                        {selectedClient.name}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {selectedClient.email}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedClient(null)}
                    disabled={status === "CONVERTI"}
                  >
                    Changer
                  </Button>
                </div>
              ) : (
                <Dialog
                  open={clientSearchOpen}
                  onOpenChange={setClientSearchOpen}
                >
                  <DialogTrigger asChild>
                    <button className="w-full p-4 rounded-xl border border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition-all text-left group focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                          <User className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                        </div>
                        <div>
                          <p className="text-muted-foreground font-medium group-hover:text-foreground">
                            Sélectionner un client
                          </p>
                          <p className="text-muted-foreground/60 text-sm">
                            Cliquez pour rechercher dans votre base
                          </p>
                        </div>
                      </div>
                    </button>
                  </DialogTrigger>
                  <DialogContent className="bg-card border-border">
                    <DialogHeader>
                      <DialogTitle className="text-foreground">
                        Rechercher un client
                      </DialogTitle>
                      <VisuallyHidden>
                        <DialogDescription>
                          Sélectionnez un client dans votre base de données pour
                          ce devis
                        </DialogDescription>
                      </VisuallyHidden>
                    </DialogHeader>
                    <div className="mt-4 space-y-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Nom ou email..."
                          value={clientSearch}
                          onChange={(e) => setClientSearch(e.target.value)}
                          className="pl-10 bg-secondary border-border text-foreground"
                        />
                      </div>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {filteredClients.map((client) => (
                          <button
                            key={client.id}
                            onClick={() => {
                              setSelectedClient(client);
                              setClientSearchOpen(false);
                            }}
                            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors text-left focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                          >
                            <Avatar className="w-8 h-8">
                              <AvatarFallback className="text-[10px]">
                                {client.name.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <p className="text-foreground font-medium text-sm">
                                {client.name}
                              </p>
                              <p className="text-muted-foreground text-xs">
                                {client.email}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </CardContent>
          </Card>

          {/* Items */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-foreground font-semibold text-base">
                  Prestations & Produits
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={addItem}
                  className="text-primary hover:text-primary hover:bg-primary/10"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Ajouter une ligne
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="grid grid-cols-12 gap-2 md:gap-4 px-4 py-3 bg-secondary/20 rounded-t-lg text-sm font-semibold text-muted-foreground border-b border-border hidden md:grid">
                  <div className="col-span-6">Description</div>
                  <div className="col-span-2 text-right">Qté</div>
                  <div className="col-span-2 text-right">Prix U. (XAF)</div>
                  <div className="col-span-2 text-right pr-2">Total HT</div>
                </div>

                {items.map((item, index) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-12 gap-2 md:gap-4 items-start p-3 rounded-xl bg-muted/30"
                  >
                    <div className="col-span-12 md:col-span-6">
                      <Select
                        onValueChange={(val) =>
                          updateItem(item.id, "description", val)
                        }
                        value={item.description || ""}
                      >
                        <SelectTrigger className="bg-transparent border-0 md:border md:bg-secondary focus:ring-1 text-foreground">
                          <SelectValue placeholder="Sélectionner un service..." />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          {services.map((s) => (
                            <SelectItem key={s.id} value={s.name}>
                              <div className="flex flex-col">
                                <span className="font-medium">{s.name}</span>
                                <span className="text-[10px] text-muted-foreground uppercase">
                                  {s.category} • {formatCurrency(s.unitPrice)}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <Input
                        type="number"
                        value={item.quantity ?? 1}
                        onChange={(e) =>
                          updateItem(
                            item.id,
                            "quantity",
                            parseFloat(e.target.value) || 0,
                          )
                        }
                        className="text-right"
                        disabled={status === "CONVERTI" || isSubmitting}
                      />
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <Input
                        type="number"
                        value={item.unitPrice ?? 0}
                        onChange={(e) =>
                          updateItem(
                            item.id,
                            "unitPrice",
                            parseFloat(e.target.value) || 0,
                          )
                        }
                        className="text-right"
                        disabled={status === "CONVERTI" || isSubmitting}
                      />
                    </div>
                    <div className="col-span-3 md:col-span-1 text-right pt-2 font-medium">
                      {formatCurrency(item.total)}
                    </div>
                    <div className="col-span-1 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(item.id)}
                        className="text-muted-foreground hover:text-destructive"
                        disabled={items.length === 1 || status === "CONVERTI"}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-foreground font-semibold text-base">
                Notes et Conditions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notes || ""}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Indiquez la durée de validité du devis, les conditions de règlement ou toute mention complémentaire..."
                className="min-h-[90px] resize-y bg-secondary/30 border-border text-sm focus:ring-1"
                disabled={status === "CONVERTI" || isSubmitting}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-card border-border sticky top-24">
            <CardHeader className="pb-4">
              <CardTitle className="text-foreground font-semibold text-base">
                Récapitulatif Financier
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total HT Brut</span>
                  <span className="text-foreground font-medium">
                    {formatCurrency(subtotal)}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-muted-foreground">
                      Remise Commerciale
                    </span>
                    <Input
                      type="number"
                      className="w-24 h-7 text-right text-sm"
                      value={discount || 0}
                      onChange={(e) =>
                        setDiscount(parseFloat(e.target.value) || 0)
                      }
                      disabled={status === "CONVERTI" || isSubmitting}
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-border/50">
                  <div className="flex justify-between text-sm font-semibold">
                    <span>Net HT</span>
                    <span>{formatCurrency(netHT)}</span>
                  </div>
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    CSS ({settings.cssRate}%)
                  </span>
                  <span className="text-foreground">
                    {formatCurrency(cssAmount)}
                  </span>
                </div>

                <div className="pt-1 border-t border-dashed border-border/30">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-muted-foreground">Base TVA</span>
                    <span>{formatCurrency(taxBase)}</span>
                  </div>
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    TPS ({settings.tpsRate || 9.5}%)
                  </span>
                  <span className="text-foreground">
                    {formatCurrency(tpsAmount)}
                  </span>
                </div>

                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    TVA ({settings.tvaRate}%)
                  </span>
                  <span className="text-foreground">
                    {formatCurrency(tvaAmount)}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <div className="flex justify-between items-center">
                  <span className="text-foreground font-bold">
                    TOTAL TTC (XAF)
                  </span>
                  <span className="text-2xl font-bold text-primary">
                    {formatCurrency(total)}
                  </span>
                </div>
              </div>

              <div className="pt-4 space-y-3">
                <Button
                  variant="outline"
                  className="w-full h-12 gap-2 bg-secondary"
                  onClick={() => setPreviewOpen(true)}
                  disabled={isSubmitting || !selectedClient}
                >
                  <Eye className="w-4 h-4" />
                  Aperçu
                </Button>
                <Button
                  onClick={() => handleSave("EN_ATTENTE")}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-12 transition-all"
                  disabled={isSubmitting || status === "CONVERTI"}
                >
                  {isSubmitting ? (
                    <Save className="w-4 h-4 mr-2 animate-pulse" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  {status === "CONVERTI"
                    ? "Devis Converti (Lecture seule)"
                    : (isSubmitting ? "Enregistrement..." : "Enregistrer le Devis")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {previewOpen && selectedClient && (
        <FullScreenDocumentViewer
          type="devis"
          title="Brouillon - Devis"
          onClose={() => setPreviewOpen(false)}
          data={
            {
              id: "draft",
              number: "BROUILLON",
              clientId: selectedClient.id,
              clientName: selectedClient.name,
              clientEmail: selectedClient.email,
              date: quoteDate,
              items: items as any,
              subtotal: subtotal,
              discount: discount,
              taxBase: taxBase,
              tpsAmount: tpsAmount,
              tvaAmount: tvaAmount,
              cssAmount: cssAmount,
              total: total,
              notes: notes,
              status: "draft",
              createdAt: new Date().toISOString(),
            } as any
          }
        />
      )}
    </motion.div>
  );
}
