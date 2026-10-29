"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// Re-export canonical types from store/types.ts
export * from "./store/types";

import {
  AuthSlice,
  createAuthSlice,
} from "./store/slices/authSlice";
import {
  ClientsSlice,
  createClientsSlice,
} from "./store/slices/clientsSlice";
import {
  QuotesSlice,
  createQuotesSlice,
} from "./store/slices/quotesSlice";
import {
  InvoicesSlice,
  createInvoicesSlice,
} from "./store/slices/invoicesSlice";
import {
  SettingsSlice,
  createSettingsSlice,
} from "./store/slices/settingsSlice";

export type AppState = AuthSlice &
  ClientsSlice &
  QuotesSlice &
  InvoicesSlice &
  SettingsSlice;

/**
 * Store global Zustand modulaire découpé en tranches (Lot J / P5 / J5).
 * Les valeurs par défaut sont désormais nettoyées de tout placeholder fictif (J7 / P7).
 */
export const useStore = create<AppState>()(
  persist(
    (...a) => ({
      ...createAuthSlice(...a),
      ...createClientsSlice(...a),
      ...createQuotesSlice(...a),
      ...createInvoicesSlice(...a),
      ...createSettingsSlice(...a),
    }),
    {
      name: "app-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        viewFormat: state.viewFormat,
        invoiceDraft: state.invoiceDraft,
        quoteDraft: state.quoteDraft,
      }),
    }
  )
);
