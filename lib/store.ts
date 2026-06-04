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
  tpsAmount?: number;
  tvaAmount: number;
  cssAmount: number;
  total: number;
  status: 'draft' | 'sent' | 'invoiced' | 'rejected';
  items: InvoiceItem[];
  notes?: string;
  created_by?: string;
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
  tpsAmount?: number;
  tvaAmount: number;
  cssAmount: number;
  total: number;
  status: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' | 'overdue' | 'draft' | 'cancelled';
  items: InvoiceItem[];
  payments?: Payment[];
  notes?: string;
  created_by?: string;
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
  isActive: boolean;
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
  tpsAmount?: number;
  tvaAmount: number;
  cssAmount: number;
  total: number;
  status: 'open' | 'closed';
  items: InvoiceItem[];
}

export interface Settings {
  companyName: string;
  legalForm: string;
  nif: string;
  rccm: string;
  address: string;
  email: string;
  phone: string;
  bankName: string;
  bankAgency: string;
  accountNumber: string;
  swiftCode: string;
  iban: string;
  tvaRate: number;
  tpsRate: number;
  cssRate: number;
  defaultDueDateDays: number;
  defaultQuoteValidity: number;
  sessionTimeout: number;
  invoicePrefix: string;
  quotePrefix: string;
  companyCode: string;
  mentionsLegales?: string;
  logo?: string;
}

interface User {
  id: string;
  name: string;
  role: 'admin' | 'user';
}

interface RolePermissions {
  canViewDashboard: boolean;
  canViewSettings: boolean;
  canViewAuditLog: boolean;
  canViewUsers: boolean;
  canManageUsers: boolean;
  canViewCustomers: boolean;
  canViewQuotes: boolean;
  canCreateQuote: boolean;
  canViewInvoices: boolean;
  canViewServices: boolean;
  canResetPassword: boolean;
  canDeactivateUser: boolean;
}

const ADMIN_PERMISSIONS: RolePermissions = {
  canViewDashboard: true,
  canViewSettings: true,
  canViewAuditLog: true,
  canViewUsers: true,
  canManageUsers: true,
  canViewCustomers: false,
  canViewQuotes: false,
  canCreateQuote: false,
  canViewInvoices: false,
  canViewServices: false,
  canResetPassword: true,
  canDeactivateUser: true,
};

const USER_PERMISSIONS: RolePermissions = {
  canViewDashboard: true,
  canViewSettings: true,
  canViewAuditLog: false,
  canViewUsers: false,
  canManageUsers: false,
  canViewCustomers: true,
  canViewQuotes: true,
  canCreateQuote: true,
  canViewInvoices: true,
  canViewServices: true,
  canResetPassword: false,
  canDeactivateUser: false,
};

interface ViewFormat {
  quotes: 'table' | 'horizontal' | 'block'
  invoices: 'table' | 'horizontal' | 'block'
  clients: 'table' | 'horizontal' | 'block'
  services: 'table' | 'horizontal' | 'block'
}

interface AppState {
  user: User | null;
  permissions: RolePermissions | null;
  isAuthenticated: boolean;
  clients: Client[];
  quotes: Quote[];
  invoices: Invoice[];
  services: Service[];
  payments: Payment[];
  creditNotes: CreditNote[];
  settings: Settings;
  viewFormat: ViewFormat;
  setUser: (user: User | null) => void;
  setClients: (clients: Client[]) => void;
  setQuotes: (quotes: Quote[]) => void;
  setInvoices: (invoices: Invoice[]) => void;
  setServices: (services: Service[]) => void;
  setPayments: (payments: Payment[]) => void;
  setCreditNotes: (creditNotes: CreditNote[]) => void;
  setSettings: (settings: Settings) => void;
  setViewFormat: (page: keyof ViewFormat, format: ViewFormat[keyof ViewFormat]) => void;
}

const DEFAULT_SETTINGS: Settings = {
  companyName: "Global Maintenance",
  legalForm: "SARL",
  nif: "XXXXXXXXXX",
  rccm: "GA-LBV-XX-XXXX-XXXX",
  address: "123 Boulevard Triomphal, Libreville, Gabon",
  email: "facturation@globalm.ga",
  phone: "+241 01 76 XX XX",
  bankName: "BGFI Bank",
  bankAgency: "Libreville",
  accountNumber: "XXXXXXXXXX",
  swiftCode: "BGFIGAXX",
  iban: "GAXX XXXX XXXX XXXX XXXX",
  tvaRate: 18,
  tpsRate: 9.5,
  cssRate: 1,
  sessionTimeout: 30,
  invoicePrefix: "FAC",
  quotePrefix: "DEV",
  companyCode: "GM",
};

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      permissions: null,
      isAuthenticated: false,
      clients: [],
      quotes: [],
      invoices: [],
      services: [],
      payments: [],
      creditNotes: [],
      settings: DEFAULT_SETTINGS,
      viewFormat: {
        quotes: 'table',
        invoices: 'table',
        clients: 'block',
        services: 'block',
        creditNotes: 'list'
      },

      setUser: (user) => {
        const permissions = user
          ? (user.role === 'admin' ? ADMIN_PERMISSIONS : USER_PERMISSIONS)
          : null;
        set({ user, permissions, isAuthenticated: !!user });
      },
      setClients: (clients) => set({ clients }),
      setQuotes: (quotes) => set({ quotes }),
      setInvoices: (invoices) => set({ invoices }),
      setServices: (services) => set({ services }),
      setPayments: (payments) => set({ payments }),
      setCreditNotes: (creditNotes) => set({ creditNotes }),
      setSettings: (settings) => set({ settings }),
      setViewFormat: (page, format) => set((state) => ({
        viewFormat: { ...state.viewFormat, [page]: format }
      })),
    }),
    {
      name: 'letoile-storage',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        user: state.user,
        permissions: state.permissions,
        isAuthenticated: state.isAuthenticated,
        settings: state.settings,
        viewFormat: state.viewFormat
      }),
    }
  )
);
