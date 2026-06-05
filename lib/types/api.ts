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
  name: string;
  role: 'admin' | 'user';
  exp: number;
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
  reference?: string;
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
  }>;
  paymentMethodData?: Array<{
    method: string;
    amount: number;
  }>;
}
