/**
 * TypeScript Interfaces for API Routes & Server Actions
 * Re-exports canonical I* interfaces from @workspace/database and provides backward-compatible aliases.
 */

import type {
  IUser,
  ISessionData,
  IClient,
  IService,
  IQuote,
  IQuoteItem,
  IInvoice,
  IInvoiceItem,
  IPayment,
  ICreditNote,
  ICreditNoteItem,
  ISettings,
  IAuditLog,
  IDashboardMetrics,
  ITenant,
  IProfile,
  QuoteStatus,
  InvoiceStatus,
  CreditNoteStatus,
} from '@workspace/database/types';

export type {
  IUser,
  ISessionData,
  IClient,
  IService,
  IQuote,
  IQuoteItem,
  IInvoice,
  IInvoiceItem,
  IPayment,
  ICreditNote,
  ICreditNoteItem,
  ISettings,
  IAuditLog,
  IDashboardMetrics,
  ITenant,
  IProfile,
  QuoteStatus,
  InvoiceStatus,
  CreditNoteStatus,
};

// ============================================================================
// AUTHENTICATION TYPES
// ============================================================================

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  name: string;
  email: string;
  role?: 'admin' | 'user';
}

export type SessionData = ISessionData;

export interface SessionResponse {
  success: boolean;
  user: UserResponse;
}

export interface LogoutResponse {
  success: boolean;
  message: string;
}

// ============================================================================
// USER TYPES
// ============================================================================

export interface UserCreateRequest {
  name: string;
  email: string;
  username: string;
  role: 'admin' | 'user';
  password: string;
  phone?: string;
  force_password_change?: boolean;
  is_active?: boolean;
}

export interface UserUpdateRequest {
  name: string;
  email: string;
  role: 'admin' | 'user';
  password?: string;
  phone?: string;
  force_password_change?: boolean;
  is_active?: boolean;
}

export type UserResponse = IUser;

export interface UserPasswordResetRequest {
  userId: string;
  newPassword: string;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export interface ErrorResponse {
  error: string;
  details?: Record<string, unknown>;
  fieldErrors?: Record<string, string[]>;
}

export interface ValidationErrorResponse extends ErrorResponse {
  error: string;
  details: {
    fieldErrors: Record<string, string[]>;
  };
}

// ============================================================================
// DATABASE TYPES (for SQLite query results)
// ============================================================================

export interface DbUser {
  id: string;
  username: string;
  password: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  is_active: number;
  force_password_change?: number;
  created_at: string;
  last_login_at?: string;
  created_by?: string | null;
  phone?: string | null;
  deletedAt?: string;
  tenant_id?: string | null;
}

export interface DbSettings {
  id: number;
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
  tpsRate?: number;
  cssRate: number;
  sessionTimeout: number;
  invoicePrefix: string;
  quotePrefix: string;
  companyCode: string;
  mentionsLegales?: string;
  logo?: string;
}

export interface DbSequence {
  name: string;
  current_value: number;
  last_year?: number;
}

export interface DbCount {
  count: number;
}

export interface DbTotal {
  total: number;
}

// ============================================================================
// PAYMENT TYPES
// ============================================================================

export interface PaymentCreateRequest {
  invoiceId: string;
  amount: number;
  paymentMethod: string;
  date: string;
  reference?: string | null;
}

export type PaymentResponse = IPayment;

export interface DbPayment {
  id: string;
  invoiceId: string;
  amount: number;
  paymentMethod: string;
  date: string;
  reference?: string;
  createdAt: string;
  deletedAt?: string;
  created_by?: string;
  tenant_id?: string | null;
}

// ============================================================================
// INVOICE TYPES
// ============================================================================

export type InvoiceItem = IInvoiceItem;

export interface InvoiceCreateRequest {
  quoteId?: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  date: string;
  dueDate: string;
  discount: number;
  notes?: string;
  subject?: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export type InvoiceResponse = IInvoice;

export interface DbInvoice {
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
  tpsAmount?: number;
  cssAmount: number;
  total: number;
  notes?: string;
  subject?: string;
  status: InvoiceStatus;
  deletedAt?: string;
  createdAt: string;
  created_by?: string;
  tenant_id?: string | null;
}

export interface DbInvoiceItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  tenant_id?: string | null;
}

// ============================================================================
// CREDIT NOTE TYPES
// ============================================================================

export type CreditNoteItem = ICreditNoteItem;

export interface CreditNoteCreateRequest {
  invoiceId: string;
  reason: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export type CreditNoteResponse = ICreditNote;

export interface DbCreditNote {
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
  tpsAmount?: number;
  cssAmount: number;
  total: number;
  status: CreditNoteStatus;
  deletedAt?: string;
  createdAt: string;
  created_by?: string;
  tenant_id?: string | null;
}

export interface DbCreditNoteItem {
  id: string;
  creditNoteId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  tenant_id?: string | null;
}

// ============================================================================
// DASHBOARD METRICS TYPES
// ============================================================================

export interface DashboardQueryParams {
  range?: 'month' | 'quarter' | 'year';
}

export type DashboardMetricsResponse = IDashboardMetrics;

// ============================================================================
// QUOTE TYPES
// ============================================================================

export type QuoteItem = IQuoteItem;

export interface QuoteCreateRequest {
  clientId: string;
  clientName: string;
  clientEmail: string;
  date: string;
  discount: number;
  notes?: string;
  subject?: string;
  validUntil?: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export type QuoteResponse = IQuote;

export interface DbQuote {
  id: string;
  number: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  date: string;
  subtotal: number;
  discount: number;
  taxBase: number;
  tvaAmount: number;
  tpsAmount?: number;
  cssAmount: number;
  total: number;
  notes?: string;
  subject?: string;
  validUntil?: string;
  status: QuoteStatus;
  deletedAt?: string | null;
  createdAt: string;
  created_by?: string;
  tenant_id?: string | null;
}

export interface DbQuoteItem {
  id: string;
  quoteId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  tenant_id?: string | null;
}

// ============================================================================
// QUOTE MUTATION TYPES
// ============================================================================

export interface QuoteConvertRequest {
  quoteId: string;
}

export interface QuoteConvertResponse {
  invoiceId: string;
  invoiceNumber: string;
  quoteId: string;
}

export interface QuoteDuplicateRequest {
  quoteId: string;
}

export interface QuoteDuplicateResponse {
  quoteId: string;
  quoteNumber: string;
}

// ============================================================================
// CLIENT TYPES
// ============================================================================

export interface ClientCreateRequest {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  nif?: string | null;
  rccm?: string | null;
}

export interface ClientUpdateRequest {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  nif?: string | null;
  rccm?: string | null;
}

export type ClientResponse = IClient;

export interface DbClient {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  nif?: string | null;
  rccm?: string | null;
  deletedAt?: string;
  createdAt?: string;
  created_by?: string;
  tenant_id?: string | null;
}

// ============================================================================
// SERVICE TYPES
// ============================================================================

export interface ServiceCreateRequest {
  name: string;
  description?: string;
  category?: string;
  unitPrice: number;
}

export interface ServiceUpdateRequest {
  name: string;
  description?: string;
  category?: string;
  unitPrice: number;
}

export type ServiceResponse = IService;

export interface DbService {
  id: string;
  name: string;
  description?: string;
  category?: string;
  unitPrice: number;
  deletedAt?: string;
  createdAt?: string;
  created_by?: string;
  tenant_id?: string | null;
}

// ============================================================================
// SETTINGS TYPES
// ============================================================================

export interface SettingsUpdateRequest {
  companyName?: string;
  legalForm?: string;
  nif?: string | null;
  rccm?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  bankName?: string | null;
  bankAgency?: string | null;
  accountNumber?: string | null;
  swiftCode?: string | null;
  iban?: string | null;
  tvaRate?: number;
  tpsRate?: number | null;
  cssRate?: number;
  sessionTimeout?: number;
  invoicePrefix?: string;
  quotePrefix?: string;
  companyCode?: string;
  mentionsLegales?: string | null;
  logo?: string | null;
}

export type SettingsResponse = ISettings;
