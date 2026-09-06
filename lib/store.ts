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

      /**
       * @function setIsDataLoaded
       * @description Flag controlling the visibility of the loading spinner during DataSync hydration.
       * @param {boolean} isDataLoaded - True when background API calls are fully complete.
       */
      setIsDataLoaded: (isDataLoaded) => set({ isDataLoaded }),

      /**
       * @function setDashboardMetrics
       * @description Updates global dashboard analytical metrics.
       * @param {DashboardMetricsResponse | null} dashboardMetrics - The analytics dataset.
       */
      setDashboardMetrics: (dashboardMetrics) => set({ dashboardMetrics }),

      /**
       * @function setUser
       * @description Updates the connected user and maps their RBAC permissions.
       * @param {User | null} user - The authenticated user or null on logout.
       */
      setUser: (user) => {
        const permissions = user
          ? user.role === "admin"
            ? ADMIN_PERMISSIONS
            : USER_PERMISSIONS
          : null;
        set({ user, permissions, isAuthenticated: !!user });
      },

      /**
       * @function setClients
       * @description Overwrites the entire clients list (used initially by DataSync).
       * @param {Client[]} clients - Full array of active clients.
       */
      setClients: (clients) => set({ clients }),
      // Atomic client mutations: each reads fresh state via set(state => ...) — no stale closure.
      /**
       * @function addClient
       * @description Adds a new client to the store immutably.
       * @param {Client} client - The client object to add.
       */
      addClient: (client) =>
        set((state) => ({ clients: [...state.clients, client] })),
      /**
       * @function removeClient
       * @description Removes a client by ID.
       * @param {string} id - The ID of the client to remove.
       */
      removeClient: (id) =>
        set((state) => ({ clients: state.clients.filter((c) => c.id !== id) })),
      /**
       * @function updateClient
       * @description Updates a client partially.
       * @param {string} id - The ID of the client.
       * @param {Partial<Client>} data - The data to update.
       */
      updateClient: (id, data) =>
        set((state) => ({
          clients: state.clients.map((c) =>
            c.id === id ? { ...c, ...data } : c,
          ),
        })),
      /**
       * @function replaceClient
       * @description Replaces a temporary client entry with a confirmed one from the server.
       * @param {string} tempId - The temporary client ID.
       * @param {Client} confirmed - The confirmed client object.
       */
      replaceClient: (tempId, confirmed) =>
        set((state) => ({
          clients: state.clients.map((c) => (c.id === tempId ? confirmed : c)),
        })),

      /**
       * @function setQuotes
       * @description Overwrites the entire quotes list (used initially by DataSync).
       * @param {Quote[]} quotes - Full array of quotes.
       */
      setQuotes: (quotes) => set((state) => ({ ...state, quotes })),
      /**
       * @function addQuote
       * @description Ajoute un nouveau devis de manière immuable au store.
       * @param {Quote} quote - L'objet devis à ajouter.
       */
      addQuote: (quote) =>
        set((state) => ({ quotes: [quote, ...state.quotes] })),
      /**
       * @function removeQuote
       * @description Supprime un devis existant en filtrant par ID.
       * @param {string} id - L'identifiant unique du devis.
       */
      removeQuote: (id) =>
        set((state) => ({ quotes: state.quotes.filter((q) => q.id !== id) })),
      /**
       * @function updateQuote
       * @description Met à jour partiellement les informations d'un devis.
       * @param {string} id - L'identifiant du devis.
       * @param {Partial<Quote>} data - Les données à mettre à jour.
       */
      updateQuote: (id, data) =>
        set((state) => ({
          quotes: state.quotes.map((q) =>
            q.id === id ? { ...q, ...data } : q,
          ),
        })),
      /**
       * @function replaceQuote
       * @description Remplace une entrée devis (utile pour réconcilier les ID temporaires avec les ID confirmés par le serveur).
       * @param {string} tempId - L'ID temporaire du devis.
       * @param {Quote} confirmed - L'objet devis confirmé par le serveur.
       */
      replaceQuote: (tempId, confirmed) =>
        set((state) => ({
          quotes: state.quotes.map((q) => (q.id === tempId ? confirmed : q)),
        })),

      /**
       * @function setInvoices
       * @description Overwrites the entire invoices list (used initially by DataSync).
       * @param {Invoice[]} invoices - Full array of invoices.
       */
      setInvoices: (invoices) => set((state) => ({ ...state, invoices })),
      /**
       * @function addInvoice
       * @description Ajoute une nouvelle facture de manière immuable au store.
       * @param {Invoice} invoice - L'objet facture à ajouter.
       */
      addInvoice: (invoice) =>
        set((state) => ({ invoices: [invoice, ...state.invoices] })),
      /**
       * @function removeInvoice
       * @description Supprime une facture existante en filtrant par ID.
       * @param {string} id - L'identifiant unique de la facture.
       */
      removeInvoice: (id) =>
        set((state) => ({
          invoices: state.invoices.filter((i) => i.id !== id),
        })),
      /**
       * @function updateInvoice
       * @description Met à jour partiellement les informations d'une facture.
       * @param {string} id - L'identifiant de la facture.
       * @param {Partial<Invoice>} data - Les données à mettre à jour.
       */
      updateInvoice: (id, data) =>
        set((state) => ({
          invoices: state.invoices.map((i) =>
            i.id === id ? { ...i, ...data } : i,
          ),
        })),
      /**
       * @function replaceInvoice
       * @description Remplace une entrée facture (utile pour réconcilier les ID temporaires avec les ID confirmés par le serveur).
       * @param {string} tempId - L'ID temporaire de la facture.
       * @param {Invoice} confirmed - L'objet facture confirmé par le serveur.
       */
      replaceInvoice: (tempId, confirmed) =>
        set((state) => ({
          invoices: state.invoices.map((i) =>
            i.id === tempId ? confirmed : i,
          ),
        })),

      /**
       * @function setServices
       * @description Overwrites the entire services list (used initially by DataSync).
       * @param {Service[]} services - Full array of active services.
       */
      setServices: (services) => set({ services }),
      // Atomic service mutations: same pattern as clients.
      /**
       * @function addService
       * @description Ajoute un nouveau service de manière immuable au store.
       * @param {Service} service - L'objet service à ajouter.
       */
      addService: (service) =>
        set((state) => ({ services: [...state.services, service] })),
      /**
       * @function removeService
       * @description Supprime un service existant en filtrant par ID.
       * @param {string} id - L'identifiant unique du service.
       */
      removeService: (id) =>
        set((state) => ({
          services: state.services.filter((s) => s.id !== id),
        })),
      /**
       * @function updateService
       * @description Met à jour partiellement les informations d'un service.
       * @param {string} id - L'identifiant du service.
       * @param {Partial<Service>} data - Les données à mettre à jour.
       */
      updateService: (id, data) =>
        set((state) => ({
          services: state.services.map((s) =>
            s.id === id ? { ...s, ...data } : s,
          ),
        })),
      /**
       * @function replaceService
       * @description Remplace une entrée service (utile pour réconcilier les ID temporaires avec les ID confirmés par le serveur).
       * @param {string} tempId - L'ID temporaire du service.
       * @param {Service} confirmed - L'objet service confirmé par le serveur.
       */
      replaceService: (tempId, confirmed) =>
        set((state) => ({
          services: state.services.map((s) =>
            s.id === tempId ? confirmed : s,
          ),
        })),

      /**
       * @function setPayments
       * @description Overwrites the entire payments list (used initially by DataSync).
       * @param {Payment[]} payments - Full array of payments.
       */
      setPayments: (payments) => set({ payments }),
      /**
       * @function addPayment
       * @description Ajoute un nouveau paiement de manière immuable au store.
       * @param {Payment} payment - L'objet paiement à ajouter.
       */
      addPayment: (payment) =>
        set((state) => ({ payments: [payment, ...state.payments] })),
      /**
       * @function removePayment
       * @description Supprime un paiement existant en filtrant par ID.
       * @param {string} id - L'identifiant unique du paiement.
       */
      removePayment: (id) =>
        set((state) => ({
          payments: state.payments.filter((p) => p.id !== id),
        })),
      /**
       * @function updatePayment
       * @description Met à jour partiellement les informations d'un paiement.
       * @param {string} id - L'identifiant du paiement.
       * @param {Partial<Payment>} data - Les données à mettre à jour.
       */
      updatePayment: (id, data) =>
        set((state) => ({
          payments: state.payments.map((p) =>
            p.id === id ? { ...p, ...data } : p,
          ),
        })),
      /**
       * @function replacePayment
       * @description Remplace une entrée paiement (utile pour réconcilier les ID temporaires avec les ID confirmés par le serveur).
       * @param {string} tempId - L'ID temporaire du paiement.
       * @param {Payment} confirmed - L'objet paiement confirmé par le serveur.
       */
      replacePayment: (tempId, confirmed) =>
        set((state) => ({
          payments: state.payments.map((p) =>
            p.id === tempId ? confirmed : p,
          ),
        })),
      /**
       * @function setCreditNotes
       * @description Overwrites the entire credit notes list (used initially by DataSync).
       * @param {CreditNote[]} creditNotes - Full array of credit notes.
       */
      setCreditNotes: (creditNotes) =>
        set((state) => ({ ...state, creditNotes })),

      /**
       * @function setSettings
       * @description Replaces all global settings with fresh API data.
       * @param {Settings} settings - The complete settings object.
       */
      setSettings: (settings) => set({ settings }),

      /**
       * @function updateSettings
       * @description Partially updates global configuration settings immutably.
       * @param {Partial<Settings>} updates - Changed setting key-value pairs.
       */
      updateSettings: (updates) =>
        set((state) => ({
          settings: { ...state.settings, ...updates },
        })),

      /**
       * @function setViewFormat
       * @description Toggles display layout preference (table/block/etc.) for a specific view.
       * @param {keyof ViewFormat} page - The view to format (e.g. 'quotes', 'invoices').
       * @param {ViewFormat[keyof ViewFormat]} format - The layout type.
       */
      setViewFormat: (page, format) =>
        set((state) => ({
          viewFormat: { ...state.viewFormat, [page]: format },
        })),

      /**
       * @function setUsers
       * @description Overwrites the user registry (admin only).
       * @param {UserResponse[]} users - The full list of system users.
       */
      setUsers: (users) => set({ users }),
      /**
       * @function addUser
       * @description Adds a new user account immutably to the store.
       * @param {UserResponse} user - The new user object.
       */
      addUser: (user) => set((state) => ({ users: [...state.users, user] })),

      /**
       * @function updateUser
       * @description Modifies specific user properties immutably.
       * @param {string} id - Target user ID.
       * @param {Partial<UserResponse>} updates - The data to merge.
       */
      updateUser: (id, updates) =>
        set((state) => ({
          users: state.users.map((u) =>
            u.id === id ? { ...u, ...updates } : u,
          ),
        })),

      /**
       * @function removeUser
       * @description Performs a soft delete by setting is_active to 0 immutably.
       * @param {string} id - The user ID to deactivate.
       */
      removeUser: (id) =>
        set((state) => ({
          users: state.users.map((u) =>
            u.id === id
              ? { ...u, is_active: 0, deletedAt: new Date().toISOString() }
              : u,
          ),
        })),

      /**
       * @function setInvoiceDraft
       * @description Updates in-progress unsaved invoice modifications.
       * @param {Partial<InvoiceDraft>} draft - Partial draft state to merge.
       */
      setInvoiceDraft: (draft) =>
        set((state) => ({
          invoiceDraft: { ...state.invoiceDraft, ...draft },
        })),

      /**
       * @function clearInvoiceDraft
       * @description Resets the invoice editor to a blank baseline applying legal mentions.
       */
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

      /**
       * @function setQuoteDraft
       * @description Updates in-progress unsaved quote modifications.
       * @param {Partial<QuoteDraft>} draft - Partial draft state to merge.
       */
      setQuoteDraft: (draft) =>
        set((state) => ({
          quoteDraft: { ...state.quoteDraft, ...draft },
        })),

      /**
       * @function clearQuoteDraft
       * @description Resets the quote editor with standard defaults (30 days validity).
       */
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
