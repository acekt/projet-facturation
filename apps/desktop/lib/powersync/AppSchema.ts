import { column, Schema, Table } from '@powersync/web';

/**
 * Schéma PowerSync Client (SQLite embarqué dans l'application Desktop).
 * ----------------------------------------------------------------------------
 * Règles fondamentales PowerSync :
 *  1. La colonne clé primaire `id` (de type TEXT / UUIDv4) est automatiquement créée
 *     par le SDK PowerSync sur chaque table. Il est interdit de la déclarer manuellement.
 *  2. Les types de colonnes autorisés sont : column.text, column.integer, column.real.
 *  3. Les index sont déclarés dans le second argument de `new Table({...}, { indexes: {...} })`.
 *  4. Ce schéma est le miroir exact des tables PostgreSQL répliquées définies dans
 *     `supabase/migrations/20261013_desktop_sync.sql` et `supabase/migrations/20261021_hub_telemetry_kpis.sql`.
 */

const tenants = new Table(
  {
    name: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: {} }
);

const profiles = new Table(
  {
    tenant_id: column.text,
    email: column.text,
    role: column.text,
    full_name: column.text,
    phone: column.text,
    is_active: column.integer,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { tenant: ['tenant_id'] } }
);

const clients = new Table(
  {
    tenant_id: column.text,
    name: column.text,
    email: column.text,
    phone: column.text,
    address: column.text,
    nif: column.text,
    rccm: column.text,
    status: column.text,
    created_at: column.text,
    updated_at: column.text,
    deleted_at: column.text,
    created_by: column.text,
  },
  { indexes: { tenant: ['tenant_id'] } }
);

const services = new Table(
  {
    tenant_id: column.text,
    name: column.text,
    description: column.text,
    category: column.text,
    unit_price: column.real,
    created_at: column.text,
    updated_at: column.text,
    deleted_at: column.text,
    created_by: column.text,
  },
  { indexes: { tenant: ['tenant_id'] } }
);

const quotes = new Table(
  {
    tenant_id: column.text,
    number: column.text,
    client_id: column.text,
    client_name: column.text,
    client_email: column.text,
    date: column.text,
    subtotal: column.real,
    discount: column.real,
    tax_base: column.real,
    tps_amount: column.real,
    tva_amount: column.real,
    css_amount: column.real,
    total: column.real,
    status: column.text,
    notes: column.text,
    subject: column.text,
    valid_until: column.text,
    created_at: column.text,
    updated_at: column.text,
    deleted_at: column.text,
    created_by: column.text,
  },
  { indexes: { tenant: ['tenant_id'], client: ['client_id'], number: ['number'] } }
);

const quote_items = new Table(
  {
    tenant_id: column.text,
    quote_id: column.text,
    description: column.text,
    quantity: column.real,
    unit_price: column.real,
    total: column.real,
    updated_at: column.text,
  },
  { indexes: { tenant: ['tenant_id'], quote: ['quote_id'] } }
);

const invoices = new Table(
  {
    tenant_id: column.text,
    number: column.text,
    quote_id: column.text,
    client_id: column.text,
    client_name: column.text,
    client_email: column.text,
    date: column.text,
    subtotal: column.real,
    discount: column.real,
    tax_base: column.real,
    tps_amount: column.real,
    tva_amount: column.real,
    css_amount: column.real,
    total: column.real,
    status: column.text,
    notes: column.text,
    subject: column.text,
    due_date: column.text,
    created_at: column.text,
    updated_at: column.text,
    deleted_at: column.text,
    created_by: column.text,
  },
  { indexes: { tenant: ['tenant_id'], client: ['client_id'], number: ['number'] } }
);

const invoice_items = new Table(
  {
    tenant_id: column.text,
    invoice_id: column.text,
    description: column.text,
    quantity: column.real,
    unit_price: column.real,
    total: column.real,
    updated_at: column.text,
  },
  { indexes: { tenant: ['tenant_id'], invoice: ['invoice_id'] } }
);

const payments = new Table(
  {
    tenant_id: column.text,
    invoice_id: column.text,
    amount: column.real,
    payment_method: column.text,
    date: column.text,
    reference: column.text,
    created_at: column.text,
    updated_at: column.text,
    deleted_at: column.text,
    created_by: column.text,
  },
  { indexes: { tenant: ['tenant_id'], invoice: ['invoice_id'] } }
);

const credit_notes = new Table(
  {
    tenant_id: column.text,
    number: column.text,
    invoice_id: column.text,
    client_id: column.text,
    client_name: column.text,
    date: column.text,
    reason: column.text,
    subtotal: column.real,
    tax_base: column.real,
    tps_amount: column.real,
    tva_amount: column.real,
    css_amount: column.real,
    total: column.real,
    status: column.text,
    created_at: column.text,
    created_by: column.text,
    deleted_at: column.text,
    updated_at: column.text,
  },
  { indexes: { tenant: ['tenant_id'], invoice: ['invoice_id'], client: ['client_id'], number: ['number'] } }
);

const credit_note_items = new Table(
  {
    tenant_id: column.text,
    credit_note_id: column.text,
    description: column.text,
    quantity: column.real,
    unit_price: column.real,
    total: column.real,
    updated_at: column.text,
  },
  { indexes: { tenant: ['tenant_id'], credit_note: ['credit_note_id'] } }
);

const audit_logs = new Table(
  {
    tenant_id: column.text,
    user_id: column.text,
    user_name: column.text,
    action: column.text,
    entity_type: column.text,
    entity_id: column.text,
    details: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { tenant: ['tenant_id'], user: ['user_id'] } }
);

const tenant_settings = new Table(
  {
    tenant_id: column.text,
    company_name: column.text,
    legal_form: column.text,
    nif: column.text,
    rccm: column.text,
    address: column.text,
    email: column.text,
    phone: column.text,
    bank_name: column.text,
    bank_agency: column.text,
    account_number: column.text,
    swift_code: column.text,
    iban: column.text,
    tva_rate: column.real,
    tps_rate: column.real,
    css_rate: column.real,
    session_timeout: column.integer,
    invoice_prefix: column.text,
    quote_prefix: column.text,
    company_code: column.text,
    mentions_legales: column.text,
    logo: column.text,
    updated_at: column.text,
  },
  { indexes: { tenant: ['tenant_id'] } }
);

const announcements = new Table(
  {
    title: column.text,
    body: column.text,
    target_tenant_id: column.text,
    level: column.text,
    is_active: column.integer,
    starts_at: column.text,
    ends_at: column.text,
    created_at: column.text,
  },
  { indexes: { target_tenant: ['target_tenant_id'] } }
);

export const AppSchema = new Schema({
  tenants,
  profiles,
  clients,
  services,
  quotes,
  quote_items,
  invoices,
  invoice_items,
  payments,
  credit_notes,
  credit_note_items,
  audit_logs,
  tenant_settings,
  announcements,
});

export type Database = (typeof AppSchema)['types'];
