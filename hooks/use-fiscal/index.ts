import { useMemo } from 'react';
import { calculateFiscalCascade, FiscalResult } from '@/lib/fiscal';

export function useFiscal(
    subtotal: number,
    discountPercent: number = 0,
    cssRate: number = 1,
    tvaRate: number = 18
): FiscalResult {
    return useMemo(() => {
        return calculateFiscalCascade(subtotal, discountPercent, cssRate, tvaRate);
    }, [subtotal, discountPercent, cssRate, tvaRate]);
}
