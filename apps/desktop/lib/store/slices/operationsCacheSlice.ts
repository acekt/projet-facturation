"use client";

import { StateCreator } from "zustand";
import { getLowStockAlerts, getStockCatalog } from "@/app/actions/stock.actions";
import type { LedgerEntry, LedgerSummary } from "@/lib/repositories/LedgerRepository";

export interface LedgerCachePayload {
  entries: LedgerEntry[];
  summary: LedgerSummary | null;
  fetchedAt: number;
}

export interface OperationsCacheSlice {
  stockCatalog: any[];
  lowStockAlerts: any[];
  lastStockFetchAt: number;
  isFetchingStock: boolean;
  setStockCatalog: (catalog: any[]) => void;
  setLowStockAlerts: (alerts: any[]) => void;
  refreshStockData: (force?: boolean) => Promise<void>;

  ledgerCache: Record<string, LedgerCachePayload>;
  setLedgerCacheEntry: (key: string, entries: LedgerEntry[], summary: LedgerSummary | null) => void;
  invalidateLedgerCache: () => void;
}

const STOCK_CACHE_TTL_MS = 60_000;

export const createOperationsCacheSlice: StateCreator<
  OperationsCacheSlice,
  [],
  [],
  OperationsCacheSlice
> = (set, get) => ({
  stockCatalog: [],
  lowStockAlerts: [],
  lastStockFetchAt: 0,
  isFetchingStock: false,

  setStockCatalog: (stockCatalog) => {
    const alerts = stockCatalog.filter(
      (item) => Number(item.stockQuantity) <= Number(item.minStockAlert)
    );
    set({
      stockCatalog,
      lowStockAlerts: alerts,
      lastStockFetchAt: Date.now(),
    });
  },

  setLowStockAlerts: (lowStockAlerts) => set({ lowStockAlerts }),

  refreshStockData: async (force = false) => {
    const state = get();
    if (state.isFetchingStock) return;
    const now = Date.now();
    if (!force && state.lastStockFetchAt > 0 && now - state.lastStockFetchAt < STOCK_CACHE_TTL_MS) {
      return;
    }

    set({ isFetchingStock: true });
    try {
      const [catalogRes, alertsRes] = await Promise.all([
        getStockCatalog(),
        getLowStockAlerts(),
      ]);

      const nextCatalog = catalogRes.success && catalogRes.data ? catalogRes.data : state.stockCatalog;
      const nextAlerts =
        alertsRes.success && alertsRes.data
          ? alertsRes.data
          : nextCatalog.filter((item: any) => Number(item.stockQuantity) <= Number(item.minStockAlert));

      set({
        stockCatalog: nextCatalog,
        lowStockAlerts: nextAlerts,
        lastStockFetchAt: Date.now(),
      });
    } catch {
      // Silently preserve existing cache on transient error
    } finally {
      set({ isFetchingStock: false });
    }
  },

  ledgerCache: {},

  setLedgerCacheEntry: (key, entries, summary) =>
    set((state) => ({
      ledgerCache: {
        ...state.ledgerCache,
        [key]: {
          entries,
          summary,
          fetchedAt: Date.now(),
        },
      },
    })),

  invalidateLedgerCache: () => set({ ledgerCache: {} }),
});

