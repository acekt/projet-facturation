/**
 * @workspace/database — Canonical Multi-Tenant Domain Interfaces
 * Follows .antigravity §3, §4, §5 (Strict TypeScript, 'I' prefix for interfaces, UUIDv4, Soft Delete & tenant_id).
 */

export type UserRole = 'superadmin' | 'admin' | 'user';

export interface ITenant {
  id: string;
  name: string;
  status?: 'active' | 'suspended' | 'trial' | 'expired';
  plan_id?: string | null;
  plan?: 'starter' | 'pro' | 'enterprise' | string;
  trial_ends_at?: string | null;
  license_expires_at?: string | null;
  country?: string | null;
  suspended_reason?: string | null;
  suspended_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface IProfile {
  id: string;
  tenant_id: string | null;
  email: string;
  role: UserRole;
  full_name?: string | null;
  phone?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface IUser {
  id: string;
  name: string;
  email: string;
  username: string;
  role: 'admin' | 'user';
  is_active: number;
  force_password_change?: number;
  created_at: string;
  last_login_at?: string;
  phone?: string | null;
  deletedAt?: string;
  tenant_id?: string | null;
}

export interface ISessionData {
  userId: string;
  name?: string;
  username?: string;
  role: 'admin' | 'user';
  tenantId?: string | null;
  force_password_change?: number;
  exp?: number;
  expiresAt?: number;
}

export interface IClient {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  nif?: string | null;
  rccm?: string | null;
  status?: 'active' | 'inactive' | string;
  deletedAt?: string | null;
  createdAt?: string;
  created_by?: string | null;
  tenant_id?: string | null;
}

export type TaxRegime = 'GOODS' | 'SERVICES' | 'EXEMPT';

export interface IService {
  id: string;
  name: string;
  description?: string;
  category?: string;
  unitPrice: number;
  taxRegime?: TaxRegime;
  deletedAt?: string;
  createdAt?: string;
  created_by?: string;
  tenant_id?: string | null;
}

export interface IQuoteItem {
  id: string;
  quoteId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  taxRegime?: TaxRegime;
  tenant_id?: string | null;
}

export type QuoteStatus =
  | 'EN_ATTENTE'
  | 'CONVERTI'
  | 'ENVOYE'
  | 'REFUSE'
  | 'EXPIRE'
  | 'EXPIRED';

export interface IQuote {
  id: string;
  number: string;
  clientId: string;
  clientName: string;
  clientEmail?: string | null;
  date: string;
  subtotal: number;
  discount: number;
  taxBase: number;
  tvaAmount: number;
  tpsAmount?: number;
  cssAmount: number;
  total: number;
  taxModelVersion?: number;
  notes?: string;
  subject?: string;
  validUntil?: string | null;
  status: QuoteStatus;
  items: IQuoteItem[];
  deletedAt?: string | null;
  createdAt: string;
  created_by?: string | null;
  tenant_id?: string | null;
}

export interface IInvoiceItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  taxRegime?: TaxRegime;
  tenant_id?: string | null;
}

export type InvoiceStatus =
  | 'PAID'
  | 'PARTIALLY_PAID'
  | 'UNPAID'
  | 'overdue'
  | 'draft'
  | 'cancelled'
  | 'pending';

export interface IPayment {
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

export interface IInvoice {
  id: string;
  number: string;
  quoteId?: string;
  clientId: string;
  clientName: string;
  clientEmail?: string | null;
  date: string;
  dueDate: string;
  subtotal: number;
  discount: number;
  taxBase: number;
  tvaAmount: number;
  tpsAmount?: number;
  cssAmount: number;
  total: number;
  taxModelVersion?: number;
  notes?: string;
  subject?: string;
  status: InvoiceStatus;
  items: IInvoiceItem[];
  payments: IPayment[];
  deletedAt?: string;
  createdAt: string;
  created_by?: string;
  tenant_id?: string | null;
}

export interface ICreditNoteItem {
  id: string;
  creditNoteId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  taxRegime?: TaxRegime;
  tenant_id?: string | null;
}

export type CreditNoteStatus = 'open' | 'applied' | 'cancelled';

export interface ICreditNote {
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
  taxModelVersion?: number;
  status: CreditNoteStatus;
  items: ICreditNoteItem[];
  deletedAt?: string;
  createdAt: string;
  created_by?: string;
  tenant_id?: string | null;
}

export interface ISettings {
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
  tenant_id?: string | null;
}

export interface IAuditLog {
  id: string;
  userId?: string | null;
  userName?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: string | null;
  createdAt: string;
  tenant_id?: string | null;
}

export interface IDashboardMetrics {
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

export interface IPlan {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  price_xaf: number;
  billing_period: 'monthly' | 'annual' | 'lifetime';
  max_users: number;
  max_devices: number;
  features: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ISyncDevice {
  device_id: string;
  tenant_id: string;
  user_id?: string | null;
  device_name?: string | null;
  os?: string | null;
  app_version?: string | null;
  first_seen_at: string;
  last_seen_at: string;
  last_sync_at?: string | null;
  last_status: 'success' | 'error' | 'pending';
  metadata?: Record<string, unknown>;
}

export interface ISyncRun {
  id: string;
  tenant_id: string;
  device_id: string;
  user_id?: string | null;
  started_at: string;
  completed_at?: string | null;
  duration_ms: number;
  pushed: number;
  pulled: number;
  deleted: number;
  skipped: number;
  error_count: number;
  errors: string[];
  app_version?: string | null;
  os?: string | null;
  created_at: string;
}

export interface IKpiTenantDaily {
  id: string;
  tenant_id: string;
  metric_date: string;
  documents_created: number;
  invoices_count: number;
  quotes_count: number;
  total_revenue_xaf: number;
  total_paid_xaf: number;
  active_users_count: number;
  sync_count: number;
  sync_errors_count: number;
  avg_sync_duration_ms: number;
  created_at: string;
  updated_at: string;
}

export interface IHubAuditLog {
  id: string;
  created_at: string;
  actor_id: string;
  actor_email: string;
  action: string;
  target_type: 'tenant' | 'user' | 'sync_fleet' | 'system' | 'security';
  target_id?: string | null;
  tenant_id?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
  ip_address?: string | null;
  user_agent?: string | null;
}

