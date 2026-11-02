"use client";

import * as React from "react";
import { User, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@workspace/ui/components/dialog";
import { VisuallyHidden } from "@workspace/ui/components/visually-hidden";
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
import { getInitials } from "@/lib/utils";
import { ClientFormDialog, type ClientFormData } from "@/components/pages/clients/ClientFormDialog";
import { createClient } from "@/app/actions/client.actions";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import type { Client } from "@/lib/store";

interface ClientSelectCardProps {
  selectedClient: Client | null;
  onSelectClient: (client: Client | null) => void;
  clients: Client[];
  title?: string;
  description?: string;
}

export function ClientSelectCard({
  selectedClient,
  onSelectClient,
  clients,
  title = "Client",
  description = "Sélectionnez un client dans votre base de données",
}: ClientSelectCardProps) {
  const [clientSearchOpen, setClientSearchOpen] = React.useState(false);
  const [clientSearch, setClientSearch] = React.useState("");
  const [isClientFormOpen, setIsClientFormOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const addClient = useStore((s) => s.addClient);

  const [clientFormData, setClientFormData] = React.useState<ClientFormData>({
    name: "", email: "", phone: "", address: "", nif: "", rccm: "", status: "active"
  });

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await createClient(clientFormData);
      if (res.success && res.data) {
        addClient(res.data);
        onSelectClient(res.data);
        setIsClientFormOpen(false);
        setClientSearchOpen(false);
        toast.success("Client créé avec succès");
      } else {
        toast.error(res.error || "Erreur lors de la création du client");
      }
    } catch (e) {
      toast.error("Erreur serveur lors de la création du client");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredClients = React.useMemo(() => {
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
        (c.email || "").toLowerCase().includes(clientSearch.toLowerCase()) ||
        (c.phone || "").toLowerCase().includes(clientSearch.toLowerCase())
    );
  }, [clients, clientSearch]);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between w-full">
          <CardTitle className="text-foreground font-semibold text-base">
            {title} <span className="text-destructive">*</span>
          </CardTitle>
          <Button variant="link" size="sm" className="h-auto p-0 text-primary" onClick={() => setIsClientFormOpen(true)}>
            + Nouveau client
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {selectedClient ? (
          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border">
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10 ring-2 ring-border">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
                  {getInitials(selectedClient.name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-foreground font-medium">{selectedClient.name}</p>
                <p className="text-muted-foreground text-sm">
                  {selectedClient.email || selectedClient.phone || "—"}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onSelectClient(null)}>
              Changer
            </Button>
          </div>
        ) : (
          <Dialog open={clientSearchOpen} onOpenChange={setClientSearchOpen}>
            <DialogTrigger asChild>
              <button className="w-full p-4 rounded-xl border border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition-all text-left group focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    <User className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                  </div>
                  <div>
                    <p className="text-muted-foreground font-medium group-hover:text-foreground">
                      Sélectionner un client <span className="text-destructive">*</span>
                    </p>
                    <p className="text-muted-foreground/60 text-sm">
                      Cliquez pour rechercher dans votre base
                    </p>
                  </div>
                </div>
              </button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border" side="right">
              <DialogHeader>
                <DialogTitle className="text-foreground">Rechercher un client</DialogTitle>
                <VisuallyHidden>
                  <DialogDescription>{description}</DialogDescription>
                </VisuallyHidden>
              </DialogHeader>
              <div className="mt-4 space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Nom, email ou téléphone..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="pl-9 bg-secondary border-border"
                  />
                </div>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {filteredClients.length > 0 ? (
                    filteredClients.map((client) => (
                      <div
                        key={client.id}
                        onClick={() => {
                          onSelectClient(client);
                          setClientSearchOpen(false);
                          setClientSearch("");
                        }}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                      >
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                            {getInitials(client.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{client.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{client.email || client.phone || "—"}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">Aucun client trouvé</p>
                  )}

                  <div className="pt-2 mt-4 border-t border-border/50 text-center">
                    <Button variant="link" size="sm" className="text-primary" onClick={() => setIsClientFormOpen(true)}>
                      + Créer un nouveau client
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
      <ClientFormDialog
        mode="add"
        isOpen={isClientFormOpen}
        onOpenChange={setIsClientFormOpen}
        data={clientFormData}
        onChange={setClientFormData}
        onSubmit={handleCreateClient}
        isSubmitting={isSubmitting}
      />
    </Card>
  );
}
