"use client";

import { StateCreator } from "zustand";
import { Quote, QuoteDraft } from "../types";

export interface QuotesSlice {
  quotes: Quote[];
  quoteDraft: QuoteDraft;
  setQuotes: (quotes: Quote[]) => void;
  addQuote: (quote: Quote) => void;
  removeQuote: (id: string) => void;
  updateQuote: (id: string, data: Partial<Quote>) => void;
  replaceQuote: (tempId: string, confirmed: Quote) => void;
  setQuoteDraft: (draft: Partial<QuoteDraft>) => void;
  clearQuoteDraft: () => void;
}

export const createQuotesSlice: StateCreator<QuotesSlice, [], [], QuotesSlice> = (set) => ({
  quotes: [],
  quoteDraft: {
    selectedClient: null,
    items: [{ id: "1", description: "", quantity: 1, unitPrice: 0, total: 0 }],
    quoteDate: new Date().toISOString().split("T")[0],
    discount: 0,
    notes: "",
    subject: "",
    validUntil: "",
    status: "EN_ATTENTE",
  },

  setQuotes: (quotes) => set({ quotes }),

  addQuote: (quote) =>
    set((state) => ({ quotes: [quote, ...state.quotes] })),

  removeQuote: (id) =>
    set((state) => ({ quotes: state.quotes.filter((q) => q.id !== id) })),

  updateQuote: (id, data) =>
    set((state) => ({
      quotes: state.quotes.map((q) => (q.id === id ? { ...q, ...data } : q)),
    })),

  replaceQuote: (tempId, confirmed) =>
    set((state) => ({
      quotes: state.quotes.map((q) => (q.id === tempId ? confirmed : q)),
    })),

  setQuoteDraft: (draft) =>
    set((state) => ({ quoteDraft: { ...state.quoteDraft, ...draft } })),

  clearQuoteDraft: () =>
    set({
      quoteDraft: {
        selectedClient: null,
        items: [{ id: "1", description: "", quantity: 1, unitPrice: 0, total: 0 }],
        quoteDate: new Date().toISOString().split("T")[0],
        discount: 0,
        notes: "",
        subject: "",
        validUntil: "",
        status: "EN_ATTENTE",
      },
    }),
});
