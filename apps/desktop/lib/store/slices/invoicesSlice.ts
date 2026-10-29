"use client";

import { StateCreator } from "zustand";
import type { UserResponse } from "@/lib/types/api";
import { Invoice, InvoiceDraft, Payment, CreditNote, Service } from "../types";

export interface InvoicesSlice {
  invoices: Invoice[];
  invoiceDraft: InvoiceDraft;
  payments: Payment[];
  creditNotes: CreditNote[];
  services: Service[];
  users: UserResponse[];

  setInvoices: (invoices: Invoice[]) => void;
  addInvoice: (invoice: Invoice) => void;
  removeInvoice: (id: string) => void;
  updateInvoice: (id: string, data: Partial<Invoice>) => void;
  replaceInvoice: (tempId: string, confirmed: Invoice) => void;

  setServices: (services: Service[]) => void;
  addService: (service: Service) => void;
  removeService: (id: string) => void;
  updateService: (id: string, data: Partial<Service>) => void;
  replaceService: (tempId: string, confirmed: Service) => void;

  setPayments: (payments: Payment[]) => void;
  addPayment: (payment: Payment) => void;
  removePayment: (id: string) => void;

  setCreditNotes: (creditNotes: CreditNote[]) => void;
  addCreditNote: (creditNote: CreditNote) => void;
  removeCreditNote: (id: string) => void;
  updateCreditNote: (id: string, data: Partial<CreditNote>) => void;
  replaceCreditNote: (tempId: string, confirmed: CreditNote) => void;

  setUsers: (users: UserResponse[]) => void;
  addUser: (user: UserResponse) => void;
  updateUser: (id: string, updates: Partial<UserResponse>) => void;
  removeUser: (id: string) => void;

  setInvoiceDraft: (draft: Partial<InvoiceDraft>) => void;
  clearInvoiceDraft: () => void;
}

export const createInvoicesSlice: StateCreator<InvoicesSlice, [], [], InvoicesSlice> = (set) => ({
  invoices: [],
  payments: [],
  creditNotes: [],
  services: [],
  users: [],
  invoiceDraft: {
    selectedClient: null,
    items: [{ id: "1", description: "", quantity: 1, unitPrice: 0, total: 0 }],
    invoiceDate: new Date().toISOString().split("T")[0],
    discount: 0,
    notes: "",
  },

  setInvoices: (invoices) => set({ invoices }),

  addInvoice: (invoice) =>
    set((state) => ({ invoices: [invoice, ...state.invoices] })),

  removeInvoice: (id) =>
    set((state) => ({ invoices: state.invoices.filter((i) => i.id !== id) })),

  updateInvoice: (id, data) =>
    set((state) => ({
      invoices: state.invoices.map((i) => (i.id === id ? { ...i, ...data } : i)),
    })),

  replaceInvoice: (tempId, confirmed) =>
    set((state) => ({
      invoices: state.invoices.map((i) => (i.id === tempId ? confirmed : i)),
    })),

  setServices: (services) => set({ services }),

  addService: (service) =>
    set((state) => ({ services: [...state.services, service] })),

  removeService: (id) =>
    set((state) => ({ services: state.services.filter((s) => s.id !== id) })),

  updateService: (id, data) =>
    set((state) => ({
      services: state.services.map((s) => (s.id === id ? { ...s, ...data } : s)),
    })),

  replaceService: (tempId, confirmed) =>
    set((state) => ({
      services: state.services.map((s) => (s.id === tempId ? confirmed : s)),
    })),

  setPayments: (payments) => set({ payments }),

  addPayment: (payment) =>
    set((state) => ({ payments: [...state.payments, payment] })),

  removePayment: (id) =>
    set((state) => ({ payments: state.payments.filter((p) => p.id !== id) })),

  setCreditNotes: (creditNotes) => set({ creditNotes }),

  addCreditNote: (creditNote) =>
    set((state) => ({ creditNotes: [creditNote, ...state.creditNotes] })),

  removeCreditNote: (id) =>
    set((state) => ({
      creditNotes: state.creditNotes.filter((c) => c.id !== id),
    })),

  updateCreditNote: (id, data) =>
    set((state) => ({
      creditNotes: state.creditNotes.map((c) =>
        c.id === id ? { ...c, ...data } : c
      ),
    })),

  replaceCreditNote: (tempId, confirmed) =>
    set((state) => ({
      creditNotes: state.creditNotes.map((c) =>
        c.id === tempId ? confirmed : c
      ),
    })),

  setUsers: (users) => set({ users }),

  addUser: (user) =>
    set((state) => ({ users: [...state.users, user] })),

  updateUser: (id, updates) =>
    set((state) => ({
      users: state.users.map((u) => (u.id === id ? { ...u, ...updates } : u)),
    })),

  removeUser: (id) =>
    set((state) => ({
      users: state.users.map((u) => (u.id === id ? { ...u, is_active: 0 } : u)),
    })),

  setInvoiceDraft: (draft) =>
    set((state) => ({ invoiceDraft: { ...state.invoiceDraft, ...draft } })),

  clearInvoiceDraft: () =>
    set({
      invoiceDraft: {
        selectedClient: null,
        items: [{ id: "1", description: "", quantity: 1, unitPrice: 0, total: 0 }],
        invoiceDate: new Date().toISOString().split("T")[0],
        discount: 0,
        notes: "",
      },
    }),
});
