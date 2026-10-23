export const ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  OPERATOR: 'operator',
} as const;

export const QUOTE_STATUS = {
  EN_ATTENTE: 'EN_ATTENTE',
  CONVERTI: 'CONVERTI',
  ENVOYE: 'ENVOYE',
  REFUSE: 'REFUSE',
  EXPIRE: 'EXPIRE',
  EXPIRED: 'EXPIRED',
} as const;

export const INVOICE_STATUS = {
  PAID: 'PAID',
  UNPAID: 'UNPAID',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  CANCELLED: 'cancelled',
  OVERDUE: 'overdue',
  DRAFT: 'draft',
  PENDING: 'pending',
} as const;

export const CLIENT_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const;

export const PAYMENT_METHODS = {
  CASH: 'cash',
  VIREMENT: 'virement',
  AIRTEL: 'airtel',
  MOOV: 'moov',
} as const;
