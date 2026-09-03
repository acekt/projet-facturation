"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// ============================================================================
// Re-export canonical types from the Single Source of Truth
// Components should import entity types from HERE (not from lib/types/api directly)
// ============================================================================
import type {
  UserResponse,
  ClientResponse,
  InvoiceResponse,
  QuoteResponse,
  PaymentResponse,
  ServiceResponse,
  CreditNoteResponse,
  SettingsResponse,
  DashboardMetricsResponse,
} from "@/lib/types/api";

// Re-export InvoiceItem type to avoid breakage in editor components
export type { InvoiceItem } from "@/lib/types/api";

// ============================================================================
// Store-local type aliases for backward compatibility
// ============================================================================
export type Client = ClientResponse;
export type Invoice = InvoiceResponse;
export type Quote = QuoteResponse;
export type Payment = PaymentResponse;
export type Service = ServiceResponse;
export type CreditNote = CreditNoteResponse;
export type Settings = SettingsResponse;

/**
 * DraftItem — item used inside the editor before the invoice/quote is saved.
 * Unlike InvoiceItem/QuoteItem, it does NOT require invoiceId/quoteId since
 * those foreign keys are only assigned at server persistence time.
 */
export interface DraftItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

// ============================================================================
// Draft interfaces (for in-memory edit persistence across SPA navigation)
// ============================================================================
export interface InvoiceDraft {
  selectedClient: Client | null;
  items: DraftItem[];
  invoiceDate: string;
  discount: number;
  notes: string;
  subject?: string;
}

export interface QuoteDraft {
  selectedClient: Client | null;
  items: DraftItem[];
  quoteDate: string;
  discount: number;
  notes: string;
  subject?: string;
  validUntil?: string;
  status: Quote["status"];
}

// ============================================================================
// RBAC
// ============================================================================
interface User {
  id: string;
  name: string;
  role: "admin" | "user";
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
  quotes: "table" | "horizontal" | "block";
  invoices: "table" | "horizontal" | "block";
  clients: "table" | "horizontal" | "block";
  services: "table" | "horizontal" | "block";
  creditNotes: "table" | "horizontal" | "block";
}

// ============================================================================
// Zustand AppState
// ============================================================================
interface AppState {
  user: User | null;
  permissions: RolePermissions | null;
  isAuthenticated: boolean;
  isDataLoaded: boolean;

  clients: Client[];
  quotes: Quote[];
  invoices: Invoice[];
  services: Service[];
  payments: Payment[];
  creditNotes: CreditNote[];
  settings: Settings;
  viewFormat: ViewFormat;
  users: UserResponse[];
  dashboardMetrics: DashboardMetricsResponse | null;

  invoiceDraft: InvoiceDraft;
  quoteDraft: QuoteDraft;

  // Actions
  setIsDataLoaded: (loaded: boolean) => void;
  setDashboardMetrics: (metrics: DashboardMetricsResponse | null) => void;
  setUser: (user: User | null) => void;
  setClients: (clients: Client[]) => void;
  // Atomic client mutations — use these instead of setClients for optimistic UI
  // to avoid stale closure overwrites during concurrent mutations.
  addClient: (client: Client) => void;
  removeClient: (id: string) => void;
  updateClient: (id: string, data: Partial<Client>) => void;
  replaceClient: (tempId: string, confirmed: Client) => void;

  setQuotes: (quotes: Quote[]) => void;
  addQuote: (quote: Quote) => void;
  removeQuote: (id: string) => void;
  updateQuote: (id: string, data: Partial<Quote>) => void;
  replaceQuote: (tempId: string, confirmed: Quote) => void;
  setInvoices: (invoices: Invoice[]) => void;
  addInvoice: (invoice: Invoice) => void;
  removeInvoice: (id: string) => void;
  updateInvoice: (id: string, data: Partial<Invoice>) => void;
  replaceInvoice: (tempId: string, confirmed: Invoice) => void;

  setServices: (services: Service[]) => void;
  // Atomic service mutations — same rationale as clients.
  addService: (service: Service) => void;
  removeService: (id: string) => void;
  updateService: (id: string, data: Partial<Service>) => void;
  replaceService: (tempId: string, confirmed: Service) => void;

  setPayments: (payments: Payment[]) => void;
  addPayment: (payment: Payment) => void;
  removePayment: (id: string) => void;
  updatePayment: (id: string, data: Partial<Payment>) => void;
  replacePayment: (tempId: string, confirmed: Payment) => void;
  setCreditNotes: (creditNotes: CreditNote[]) => void;
  setSettings: (settings: Settings) => void;
  updateSettings: (updates: Partial<Settings>) => void;
  setViewFormat: (
    page: keyof ViewFormat,
    format: ViewFormat[keyof ViewFormat],
  ) => void;
  setUsers: (users: UserResponse[]) => void;
  addUser: (user: UserResponse) => void;
  updateUser: (id: string, updates: Partial<UserResponse>) => void;
  removeUser: (id: string) => void;

  setInvoiceDraft: (draft: Partial<InvoiceDraft>) => void;
  clearInvoiceDraft: () => void;
  setQuoteDraft: (draft: Partial<QuoteDraft>) => void;
  clearQuoteDraft: () => void;
}

// ============================================================================
// Default Settings — fallback before API response
// ============================================================================
const DEFAULT_SETTINGS: Settings = {
  id: 1,
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
  mentionsLegales: null,
  logo: null,
};

// ============================================================================
// Store
// ============================================================================
export const useStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      permissions: null,
      isAuthenticated: false,
      isDataLoaded: false,
      clients: [],
      quotes: [],
      invoices: [],
      services: [],
      payments: [],
      creditNotes: [],
      settings: DEFAULT_SETTINGS,
      users: [],
      dashboardMetrics: null,
      viewFormat: {
        quotes: "table",
        invoices: "table",
        clients: "block",
        services: "block",
        creditNotes: "horizontal",
      },
      invoiceDraft: {
        selectedClient: null,
        items: [
          { id: "1", description: "", quantity: 1, unitPrice: 0, total: 0 },
        ],
        invoiceDate: new Date().toISOString().split("T")[0],
        discount: 0,
        notes: "",
      },
      quoteDraft: {
        selectedClient: null,
        items: [
          { id: "1", description: "", quantity: 1, unitPrice: 0, total: 0 },
        ],
        quoteDate: new Date().toISOString().split("T")[0],
        discount: 0,
        notes: "",
        status: "EN_ATTENTE",
      },

      setIsDataLoaded: (isDataLoaded) => set({ isDataLoaded }),
      setDashboardMetrics: (dashboardMetrics) => set({ dashboardMetrics }),
      /**
       * @function setUser
       * @description Met à jour l'utilisateur connecté et ses permissions associées.
       */
      setUser: (user) => {
        const permissions = user
          ? user.role === "admin"
            ? ADMIN_PERMISSIONS
            : USER_PERMISSIONS
          : null;
        set({ user, permissions, isAuthenticated: !!user });
      },
      setClients: (clients) => set({ clients }),
      // Atomic client mutations: each reads fresh state via set(state => ...) — no stale closure.
      addClient: (client) =>
        set((state) => ({ clients: [...state.clients, client] })),
      removeClient: (id) =>
        set((state) => ({ clients: state.clients.filter((c) => c.id !== id) })),
      updateClient: (id, data) =>
        set((state) => ({
          clients: state.clients.map((c) =>
            c.id === id ? { ...c, ...data } : c,
          ),
        })),
      replaceClient: (tempId, confirmed) =>
        set((state) => ({
          clients: state.clients.map((c) => (c.id === tempId ? confirmed : c)),
        })),

      setQuotes: (quotes) => set((state) => ({ ...state, quotes })),
      addQuote: (quote) =>
        set((state) => ({ quotes: [quote, ...state.quotes] })),
      removeQuote: (id) =>
        set((state) => ({ quotes: state.quotes.filter((q) => q.id !== id) })),
      updateQuote: (id, data) =>
        set((state) => ({
          quotes: state.quotes.map((q) =>
            q.id === id ? { ...q, ...data } : q,
          ),
        })),
      replaceQuote: (tempId, confirmed) =>
        set((state) => ({
          quotes: state.quotes.map((q) => (q.id === tempId ? confirmed : q)),
        })),
      setInvoices: (invoices) => set((state) => ({ ...state, invoices })),
      addInvoice: (invoice) =>
        set((state) => ({ invoices: [invoice, ...state.invoices] })),
      removeInvoice: (id) =>
        set((state) => ({
          invoices: state.invoices.filter((i) => i.id !== id),
        })),
      updateInvoice: (id, data) =>
        set((state) => ({
          invoices: state.invoices.map((i) =>
            i.id === id ? { ...i, ...data } : i,
          ),
        })),
      replaceInvoice: (tempId, confirmed) =>
        set((state) => ({
          invoices: state.invoices.map((i) =>
            i.id === tempId ? confirmed : i,
          ),
        })),

      setServices: (services) => set({ services }),
      // Atomic service mutations: same pattern as clients.
      addService: (service) =>
        set((state) => ({ services: [...state.services, service] })),
      removeService: (id) =>
        set((state) => ({
          services: state.services.filter((s) => s.id !== id),
        })),
      updateService: (id, data) =>
        set((state) => ({
          services: state.services.map((s) =>
            s.id === id ? { ...s, ...data } : s,
          ),
        })),
      replaceService: (tempId, confirmed) =>
        set((state) => ({
          services: state.services.map((s) =>
            s.id === tempId ? confirmed : s,
          ),
        })),

      setPayments: (payments) => set({ payments }),
      addPayment: (payment) =>
        set((state) => ({ payments: [payment, ...state.payments] })),
      removePayment: (id) =>
        set((state) => ({
          payments: state.payments.filter((p) => p.id !== id),
        })),
      updatePayment: (id, data) =>
        set((state) => ({
          payments: state.payments.map((p) =>
            p.id === id ? { ...p, ...data } : p,
          ),
        })),
      replacePayment: (tempId, confirmed) =>
        set((state) => ({
          payments: state.payments.map((p) =>
            p.id === tempId ? confirmed : p,
          ),
        })),
      setCreditNotes: (creditNotes) =>
        set((state) => ({ ...state, creditNotes })),
      setSettings: (settings) => set({ settings }),
      updateSettings: (updates) =>
        set((state) => ({
          settings: { ...state.settings, ...updates },
        })),
      setViewFormat: (page, format) =>
        set((state) => ({
          viewFormat: { ...state.viewFormat, [page]: format },
        })),
      setUsers: (users) => set({ users }),
      addUser: (user) => set((state) => ({ users: [...state.users, user] })),
      updateUser: (id, updates) =>
        set((state) => ({
          users: state.users.map((u) =>
            u.id === id ? { ...u, ...updates } : u,
          ),
        })),
      removeUser: (id) =>
        set((state) => ({
          users: state.users.map((u) =>
            u.id === id
              ? { ...u, is_active: 0, deletedAt: new Date().toISOString() }
              : u,
          ),
        })),

      setInvoiceDraft: (draft) =>
        set((state) => ({
          invoiceDraft: { ...state.invoiceDraft, ...draft },
        })),
      clearInvoiceDraft: () =>
        set((state) => ({
          invoiceDraft: {
            selectedClient: null,
            items: [
              { id: "1", description: "", quantity: 1, unitPrice: 0, total: 0 },
            ],
            invoiceDate: new Date().toISOString().split("T")[0],
            discount: 0,
            notes: state.settings.mentionsLegales || "",
            subject: "",
          },
        })),
      setQuoteDraft: (draft) =>
        set((state) => ({
          quoteDraft: { ...state.quoteDraft, ...draft },
        })),
      clearQuoteDraft: () => {
        const today = new Date();
        const next30Days = new Date(today);
        next30Days.setDate(today.getDate() + 30);
        return set((state) => ({
          quoteDraft: {
            selectedClient: null,
            items: [
              { id: "1", description: "", quantity: 1, unitPrice: 0, total: 0 },
            ],
            quoteDate: today.toISOString().split("T")[0],
            discount: 0,
            notes: state.settings.mentionsLegales || "",
            subject: "",
            validUntil: next30Days.toISOString().split("T")[0],
            status: "EN_ATTENTE",
          },
        }));
      },
    }),
    {
      name: 'facturier-storage',
      storage: createJSONStorage(() => sessionStorage),
      // OPTIMISATION : Ne pas persister `settings` pour forcer le chargement frais via SQLite (DataSync)
      partialize: (state) => ({
        user: state.user,
        permissions: state.permissions,
        isAuthenticated: state.isAuthenticated,
        viewFormat: state.viewFormat,
      }),
    },
  ),
);
