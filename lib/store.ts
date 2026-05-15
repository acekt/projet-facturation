import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  totalRevenue: number;
  invoiceCount: number;
  avgPaymentDays: number;
  status: 'active' | 'warning' | 'inactive';
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue' | 'draft';
  date: string;
  dueDate: string;
  items: InvoiceItem[];
  notes?: string;
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
}

interface AppState {
  clients: Client[];
  invoices: Invoice[];
  settings: Settings;
  addClient: (client: Omit<Client, 'id' | 'totalRevenue' | 'invoiceCount' | 'avgPaymentDays' | 'status'>) => void;
  updateClient: (id: string, client: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  addInvoice: (invoice: Omit<Invoice, 'id'>) => void;
  updateInvoice: (id: string, invoice: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;
  updateSettings: (settings: Partial<Settings>) => void;
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
};

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      clients: [
        {
          id: "1",
          name: "Societe Gabon Mining",
          email: "contact@gabonmining.ga",
          phone: "+241 01 76 XX XX",
          address: "Libreville, Gabon",
          totalRevenue: 24500000,
          invoiceCount: 12,
          avgPaymentDays: 15,
          status: "active",
        },
        {
          id: "2",
          name: "Banque BGFI",
          email: "facturation@bgfi.ga",
          phone: "+241 01 79 XX XX",
          address: "Libreville, Gabon",
          totalRevenue: 18500000,
          invoiceCount: 8,
          avgPaymentDays: 22,
          status: "active",
        },
        {
          id: "3",
          name: "Total Gabon",
          email: "finance@total.ga",
          phone: "+241 01 74 XX XX",
          address: "Port-Gentil, Gabon",
          totalRevenue: 32000000,
          invoiceCount: 15,
          avgPaymentDays: 12,
          status: "active",
        },
      ],
      invoices: [
        {
          id: "FAC-2024-0042",
          clientId: "1",
          clientName: "Societe Gabon Mining",
          clientEmail: "contact@gabonmining.ga",
          amount: 2450000,
          status: "paid",
          date: "2024-01-15",
          dueDate: "2024-02-15",
          items: [],
        },
        {
          id: "FAC-2024-0041",
          clientId: "2",
          clientName: "Banque BGFI",
          clientEmail: "facturation@bgfi.ga",
          amount: 1850000,
          status: "pending",
          date: "2024-01-14",
          dueDate: "2024-02-14",
          items: [],
        },
      ],
      settings: DEFAULT_SETTINGS,

      addClient: (client) => set((state) => ({
        clients: [...state.clients, {
          ...client,
          id: Math.random().toString(36).substring(7),
          totalRevenue: 0,
          invoiceCount: 0,
          avgPaymentDays: 0,
          status: 'active'
        }]
      })),

      updateClient: (id, client) => set((state) => ({
        clients: state.clients.map((c) => c.id === id ? { ...c, ...client } : c)
      })),

      deleteClient: (id) => set((state) => ({
        clients: state.clients.filter((c) => c.id !== id)
      })),

      addInvoice: (invoice) => set((state) => {
        const id = `${state.settings.invoicePrefix}-${new Date().getFullYear()}-${String(state.invoices.length + 1).padStart(4, '0')}`;
        return {
          invoices: [{ ...invoice, id }, ...state.invoices]
        };
      }),

      updateInvoice: (id, invoice) => set((state) => ({
        invoices: state.invoices.map((inv) => inv.id === id ? { ...inv, ...invoice } : inv)
      })),

      deleteInvoice: (id) => set((state) => ({
        invoices: state.invoices.filter((inv) => inv.id !== id)
      })),

      updateSettings: (settings) => set((state) => ({
        settings: { ...state.settings, ...settings }
      })),
    }),
    {
      name: 'fintech-invoicing-storage',
    }
  )
);
