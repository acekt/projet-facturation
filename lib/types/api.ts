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
