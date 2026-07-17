/**
 * TypeScript Interfaces for API Routes
 * Provides type safety for all API requests and responses
 */

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

export interface SessionData {
  userId: string;
  name?: string;
  username?: string;
  role: 'admin' | 'user';
  exp?: number;
  expiresAt?: number;
}

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

export interface UserResponse {
  id: string;
  name: string;
  email: string;
  username: string;
  role: 'admin' | 'user';
  is_active: number;
  created_at: string;
  last_login_at?: string;
  phone?: string;
  deletedAt?: string;
}

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
  created_at: string;
  last_login_at?: string;
  created_by?: string;
  phone?: string;
  deletedAt?: string;
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
  // reference: nullable + optional to match paymentCreateSchema (.nullable().optional())
  // Stores bank transfer IDs, cheque numbers, etc. Null = no reference provided.
  reference?: string | null;
}

export interface PaymentResponse {
  id: string;
  invoiceId: string;
  amount: number;
  paymentMethod: string;
  date: string;
  reference?: string;
  createdAt: string;
  deletedAt?: string;
  created_by?: string;
}

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
}

// ============================================================================
// INVOICE TYPES
// ============================================================================

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface InvoiceResponse {
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
  status: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' | 'overdue' | 'draft' | 'cancelled' | 'pending';
  items: InvoiceItem[];
  payments: PaymentResponse[];
  deletedAt?: string;
  createdAt: string;
  created_by?: string;
}

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
  status: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' | 'overdue' | 'draft' | 'cancelled' | 'pending';
  deletedAt?: string;
  createdAt: string;
  created_by?: string;
}

export interface DbInvoiceItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

// ============================================================================
// CREDIT NOTE TYPES
// ============================================================================

export interface CreditNoteItem {
  id: string;
  creditNoteId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface CreditNoteCreateRequest {
  invoiceId: string;
  reason: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export interface CreditNoteResponse {
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
  status: 'open' | 'applied' | 'cancelled';
  items: CreditNoteItem[];
  deletedAt?: string;
  createdAt: string;
  created_by?: string;
}

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
  status: 'open' | 'applied' | 'cancelled';
  deletedAt?: string;
  createdAt: string;
  created_by?: string;
}

export interface DbCreditNoteItem {
  id: string;
  creditNoteId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

// ============================================================================
// DASHBOARD METRICS TYPES
// ============================================================================

export interface DashboardQueryParams {
  range?: 'month' | 'quarter' | 'year';
}

export interface DashboardMetricsResponse {
  totalRevenue: number;
  growth: string;
  pendingRevenue: number;
  overdueRevenue: number;
  paidCount: number;
  unpaidCount: number;
  partiallyPaidCount: number;
  totalInvoicesCount: number;
  pendingQuotesCount: number;
  topClients: Array<{
    clientName: string;
    totalRevenue: number;
  }>;
  userPerformance: Array<{
    name: string;
    docsCount: number;
    totalRevenue: number;
  }>;
  revenueData?: Array<{
    date: string;
    revenue: number;
    label?: string;
    value?: number;
  }>;
  paymentMethodData?: Array<{
    method: string;
    amount: number;
  }>;
  activityTimeline?: Array<{
    id: string;
    action: string;
    client: string;
    time: string;
  }>;
}

// ============================================================================
// QUOTE TYPES
// ============================================================================

export interface QuoteItem {
  id: string;
  quoteId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface QuoteCreateRequest {
  clientId: string;
  clientName: string;
  clientEmail: string;
  date: string;
  discount: number;
  notes?: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export interface QuoteResponse {
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
  status: 'EN_ATTENTE' | 'CONVERTI';
  items: QuoteItem[];
  deletedAt?: string;
  createdAt: string;
  created_by?: string;
}

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
  status: 'EN_ATTENTE' | 'CONVERTI';
  deletedAt?: string | null;
  createdAt: string;
  created_by?: string;
}

export interface DbQuoteItem {
  id: string;
  quoteId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
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
}

export interface ClientUpdateRequest {
  name: string;
  email: string;
  phone?: string;
  address?: string;
}

export interface ClientResponse {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  deletedAt?: string;
  createdAt?: string;
  created_by?: string;
}

export interface DbClient {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  deletedAt?: string;
  createdAt?: string;
  created_by?: string;
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

export interface ServiceResponse {
  id: string;
  name: string;
  description?: string;
  category?: string;
  unitPrice: number;
  deletedAt?: string;
  createdAt?: string;
  created_by?: string;
}

export interface DbService {
  id: string;
  name: string;
  description?: string;
  category?: string;
  unitPrice: number;
  deletedAt?: string;
  createdAt?: string;
  created_by?: string;
}

// ============================================================================
// SETTINGS TYPES
// ============================================================================

export interface SettingsUpdateRequest {
  companyName?: string;
  legalForm?: string;
  nif?: string;
  rccm?: string;
  address?: string;
  email?: string;
  phone?: string;
  bankName?: string;
  bankAgency?: string;
  accountNumber?: string;
  swiftCode?: string;
  iban?: string;
  tvaRate?: number;
  tpsRate?: number;
  cssRate?: number;
  sessionTimeout?: number;
  invoicePrefix?: string;
  quotePrefix?: string;
  companyCode?: string;
  mentionsLegales?: string | null;
  logo?: string | null;
}

export interface SettingsResponse {
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
  mentionsLegales?: string | null;
  logo?: string | null;
}
