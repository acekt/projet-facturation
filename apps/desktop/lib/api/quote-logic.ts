import db from '@/lib/db';
import type { DbQuote } from '@/lib/types/api';

export type QuoteStatus = 'EN_ATTENTE' | 'ENVOYE' | 'REFUSE' | 'CONVERTI' | 'EXPIRE';

/**
 * Validates whether a quote status transition is permitted by business rules.
 *
 * Rules:
 *  - EN_ATTENTE -> ENVOYE, REFUSE, CONVERTI, EXPIRE
 *  - ENVOYE     -> REFUSE, CONVERTI, EXPIRE
 *  - REFUSE     -> (final state, no transitions allowed)
 *  - CONVERTI   -> (final state, no transitions allowed)
 *  - EXPIRE     -> (final state, no transitions allowed)
 */
export function validateQuoteStatusTransition(
  currentStatus: string,
  targetStatus: string
): boolean {
  if (currentStatus === targetStatus) return true;

  if (currentStatus === 'REFUSE' || currentStatus === 'CONVERTI' || currentStatus === 'EXPIRE') {
    return false;
  }

  if (currentStatus === 'EN_ATTENTE') {
    return ['ENVOYE', 'REFUSE', 'CONVERTI', 'EXPIRE'].includes(targetStatus);
  }

  if (currentStatus === 'ENVOYE') {
    return ['REFUSE', 'CONVERTI', 'EXPIRE'].includes(targetStatus);
  }

  return false;
}

/**
 * Evaluates the effective status of a quote taking into account temporal expiration.
 * By default, a quote is valid for 30 days from its issue `date` unless specified otherwise.
 *
 * @param quote The quote object containing at least `date` (YYYY-MM-DD) and `status`.
 * @param validityDays Number of days the quote is valid (default 30).
 * @param currentDate Reference date for comparison (defaults to new Date()).
 */
export function computeQuoteStatus(
  quote: { date: string; status: string; validityDays?: number },
  currentDate: Date = new Date()
): QuoteStatus {
  if (quote.status === 'CONVERTI') return 'CONVERTI';
  if (quote.status === 'REFUSE') return 'REFUSE';
  if (quote.status === 'EXPIRE') return 'EXPIRE';

  const issueDate = new Date(quote.date);
  const validDays = quote.validityDays ?? 30;
  const expiryDate = new Date(issueDate.getTime() + validDays * 24 * 60 * 60 * 1000);

  if (currentDate > expiryDate) {
    return 'EXPIRE';
  }

  return quote.status as QuoteStatus;
}
