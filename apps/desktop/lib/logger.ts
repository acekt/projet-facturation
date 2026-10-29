/**
 * lib/logger.ts — Journalisation structurée et sécurisée (Lot J6 / P6)
 * ====================================================================
 * Fournit un logger contextuel avec masquage automatique des données sensibles
 * (mots de passe, tokens JWT, clés privées, cookies).
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  tenantId?: string | null;
  userId?: string | null;
  module?: string;
  action?: string;
  [key: string]: unknown;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'jwt',
  'secret',
  'authorization',
  'cookie',
  'session_secret',
  'password_salt',
  'api_key',
  'apikey',
]);

/**
 * Masque récursivement les champs sensibles dans les objets passés en log.
 */
export function sanitizeLogData(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogData(item));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = '***REDACTED***';
    } else if (typeof val === 'object' && val !== null) {
      sanitized[key] = sanitizeLogData(val);
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
}

class AppLogger {
  private formatMessage(level: LogLevel, message: string, context?: LogContext, data?: unknown): string {
    const timestamp = new Date().toISOString();
    const ctxString = context
      ? ` [tenant:${context.tenantId || 'global'}|user:${context.userId || 'anon'}${context.module ? `|mod:${context.module}` : ''}]`
      : '';
    const safeData = data ? ` | data: ${JSON.stringify(sanitizeLogData(data))}` : '';
    return `[${timestamp}] [${level.toUpperCase()}]${ctxString} ${message}${safeData}`;
  }

  public debug(message: string, context?: LogContext, data?: unknown): void {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(this.formatMessage('debug', message, context, data));
    }
  }

  public info(message: string, context?: LogContext, data?: unknown): void {
    console.info(this.formatMessage('info', message, context, data));
  }

  public warn(message: string, context?: LogContext, data?: unknown): void {
    console.warn(this.formatMessage('warn', message, context, data));
  }

  public error(message: string, context?: LogContext, errorOrData?: unknown): void {
    let payload = errorOrData;
    if (errorOrData instanceof Error) {
      payload = {
        name: errorOrData.name,
        message: errorOrData.message,
        stack: errorOrData.stack,
      };
    }
    console.error(this.formatMessage('error', message, context, payload));
  }
}

export const logger = new AppLogger();
export default logger;
