"use client";

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
  InvoiceItem,
} from "@/lib/types/api";

export type { InvoiceItem } from "@/lib/types/api";

export type Client = ClientResponse;
export type Invoice = InvoiceResponse;
export type Quote = QuoteResponse;
export type Payment = PaymentResponse;
export type Service = ServiceResponse;
export type CreditNote = CreditNoteResponse;
export type Settings = SettingsResponse;

export interface DraftItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

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

export interface User {
  id: string;
  name: string;
  role: "admin" | "user";
  email?: string;
  username?: string;
  force_password_change?: number | boolean;
  tenant_id?: string | null;
}

export interface RolePermissions {
  canViewDashboard: boolean;
  canViewSettings: boolean;
  canManageSettings: boolean;
  canViewAuditLog: boolean;
  canViewUsers: boolean;
  canManageUsers: boolean;
  canViewCustomers: boolean;
  canManageCustomers: boolean;
  canViewQuotes: boolean;
  canCreateQuote: boolean;
  canViewInvoices: boolean;
  canCreateInvoice: boolean;
  canViewCreditNotes: boolean;
  canViewServices: boolean;
  canManageServices: boolean;
  canResetPassword: boolean;
  canDeactivateUser: boolean;
}

export const ADMIN_PERMISSIONS: RolePermissions = {
  canViewDashboard: true,
  canViewSettings: true,
  canManageSettings: true,
  canViewAuditLog: true,
  canViewUsers: true,
  canManageUsers: true,
  canViewCustomers: true,
  canManageCustomers: true,
  canViewQuotes: true,
  canCreateQuote: true,
  canViewInvoices: true,
  canCreateInvoice: true,
  canViewCreditNotes: true,
  canViewServices: true,
  canManageServices: true,
  canResetPassword: true,
  canDeactivateUser: true,
};

export const USER_PERMISSIONS: RolePermissions = {
  canViewDashboard: true,
  canViewSettings: true,
  canManageSettings: false,
  canViewAuditLog: false,
  canViewUsers: false,
  canManageUsers: false,
  canViewCustomers: true,
  canManageCustomers: false,
  canViewQuotes: true,
  canCreateQuote: true,
  canViewInvoices: true,
  canCreateInvoice: true,
  canViewCreditNotes: true,
  canViewServices: true,
  canManageServices: false,
  canResetPassword: false,
  canDeactivateUser: false,
};

export function getPermissionsForRole(role: "admin" | "user"): RolePermissions {
  return role === "admin" ? ADMIN_PERMISSIONS : USER_PERMISSIONS;
}

export interface ViewFormat {
  quotes: "table" | "horizontal" | "block";
  invoices: "table" | "horizontal" | "block";
  clients: "table" | "horizontal" | "block";
  services: "table" | "horizontal" | "block";
  creditNotes: "table" | "horizontal" | "block";
}

/**
 * Valeurs de configuration par défaut assainies (J7 / P7).
 * Plus aucune valeur fictive ni dummy placeholder.
 */
export const DEFAULT_SETTINGS: Settings = {
  id: 1,
  companyName: "",
  legalForm: "SARL",
  nif: "",
  rccm: "",
  address: "",
  email: "",
  phone: "",
  bankName: "",
  bankAgency: "",
  accountNumber: "",
  swiftCode: "",
  iban: "",
  tvaRate: 18,
  tpsRate: 9.5,
  cssRate: 1,
  sessionTimeout: 60,
  invoicePrefix: "FAC",
  quotePrefix: "DEV",
  companyCode: "",
  mentionsLegales: null,
  logo: null,
};
