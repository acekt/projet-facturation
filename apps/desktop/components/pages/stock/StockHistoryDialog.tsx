"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { getStockMovements } from "@/app/actions/stock.actions";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Loader2 } from "lucide-react";

interface StockHistoryDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  serviceId: string | null;
  serviceName: string;
}

export function StockHistoryDialog({
  isOpen,
  onOpenChange,
  serviceId,
  serviceName
}: StockHistoryDialogProps) {
  const [movements, setMovements] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    async function load() {
      if (!isOpen || !serviceId) return;
      setLoading(true);
      try {
        const res = await getStockMovements(serviceId);
        if (res.success && res.data) {
          setMovements(res.data);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [isOpen, serviceId]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-[700px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            Historique des mouvements - {serviceName}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto mt-4 pr-2">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : movements.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              Aucun mouvement enregistré pour cet article.
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-muted-foreground sticky top-0">
                <tr>
                  <th className="p-2 font-medium">Date</th>
                  <th className="p-2 font-medium">Type</th>
                  <th className="p-2 font-medium text-right">Qté</th>
                  <th className="p-2 font-medium text-right">Ancien</th>
                  <th className="p-2 font-medium text-right">Nouveau</th>
                  <th className="p-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {movements.map((mov) => {
                   const isEntry = mov.type === "INVENTORY_IN" || mov.type === "CREDIT_NOTE_RESTOCK";
                   return (
                  <tr key={mov.id}>
                    <td className="p-2 whitespace-nowrap">
                      {format(new Date(mov.createdAt), "dd MMM yyyy HH:mm", { locale: fr })}
                    </td>
                    <td className="p-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isEntry ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                         {mov.type.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className={`p-2 text-right font-medium ${isEntry ? "text-primary" : "text-destructive"}`}>
                      {isEntry ? "+" : "-"}{mov.quantity}
                    </td>
                    <td className="p-2 text-right text-muted-foreground">{mov.previousStock}</td>
                    <td className="p-2 text-right font-bold">{mov.newStock}</td>
                    <td className="p-2 text-muted-foreground truncate max-w-[150px]" title={mov.referenceDoc || mov.notes || ""}>
                      {mov.referenceDoc ? `Doc: ${mov.referenceDoc} ` : ""}{mov.notes}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
