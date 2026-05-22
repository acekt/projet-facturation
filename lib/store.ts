"use client"

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  status: 'active' | 'warning' | 'inactive';
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Quote {
  id: string;
  number: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  date: string;
  dueDate: string;
  subtotal: number;
  discount: number;
  taxBase: number;
  tvaAmount: number;
  cssAmount: number;
  total: number;
  status: 'draft' | 'sent' | 'invoiced' | 'rejected';
  items: InvoiceItem[];
  notes?: string;
}

export interface Invoice {
  id: string;
  number: string;
  quoteId?: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  date: string;
  dueDate: string;
  subtotal: number;
  discount: number;
  taxBase: number;
  tvaAmount: number;
  cssAmount: number;
  total: number;
  status: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' | 'overdue' | 'draft' | 'cancelled';
  items: InvoiceItem[];
  payments?: Payment[];
  notes?: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  paymentMethod: string;
  date: string;
  reference?: string;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  category: string;
  unitPrice: number;
}

export interface CreditNote {
  id: string;
  number: string;
  invoiceId: string;
  clientId: string;
  clientName: string;
  date: string;
  reason: string;
  subtotal: number;
  taxBase: number;
  tvaAmount: number;
  cssAmount: number;
  total: number;
  status: 'open' | 'closed';
  items: InvoiceItem[];
}

export interface Settings {
  companyName: string;
  nif: string;
  rccm: string;
  address: string;
  email: string;
  phone: string;
  bankName: string;
  iban: string;
  tvaRate: number;
  cssRate: number;
  defaultDueDateDays: number;
  invoicePrefix: string;
  quotePrefix: string;
  mentionsLegales?: string;
  logo?: string;
}

interface AppState {
  clients: Client[];
  quotes: Quote[];
  invoices: Invoice[];
  services: Service[];
  payments: Payment[];
  creditNotes: CreditNote[];
  settings: Settings;
  setClients: (clients: Client[]) => void;
  setQuotes: (quotes: Quote[]) => void;
  setInvoices: (invoices: Invoice[]) => void;
  setServices: (services: Service[]) => void;
  setPayments: (payments: Payment[]) => void;
  setCreditNotes: (creditNotes: CreditNote[]) => void;
  setSettings: (settings: Settings) => void;
}

const DEFAULT_SETTINGS: Settings = {
  companyName: "L'Etoile SARL",
  nif: "XXXXXXXXXX",
  rccm: "GA-LBV-XX-XXXX-XXXX",
  address: "123 Boulevard Triomphal, Libreville, Gabon",
  email: "facturation@letoile.ga",
  phone: "+241 01 76 XX XX",
  bankName: "BGFI Bank",
  iban: "GAXX XXXX XXXX XXXX XXXX",
  tvaRate: 18,
  cssRate: 1,
  defaultDueDateDays: 30,
  invoicePrefix: "FAC",
  quotePrefix: "DEV",
};

export const useStore = create<AppState>()((set) => ({
  clients: [],
  quotes: [],
  invoices: [],
  services: [],
  payments: [],
  creditNotes: [],
  settings: DEFAULT_SETTINGS,

  setClients: (clients) => set({ clients }),
  setQuotes: (quotes) => set({ quotes }),
  setInvoices: (invoices) => set({ invoices }),
  setServices: (services) => set({ services }),
  setPayments: (payments) => set({ payments }),
  setCreditNotes: (creditNotes) => set({ creditNotes }),
  setSettings: (settings) => set({ settings }),
}));
