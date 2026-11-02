import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getClientPaymentHistory, getInvoicePaymentHistory } from '@/app/actions/payment.actions';
import { PaymentRepository } from '@/lib/repositories/PaymentRepository';
import { getSession } from '@/lib/api/auth';
import { resolveActiveTenantId } from '@/lib/api/tenant';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  default: {
    prepare: vi.fn(),
    transaction: vi.fn((fn) => fn),
  }
}));

vi.mock('@/lib/api/auth', () => ({
  getSession: vi.fn()
}));

vi.mock('@/lib/api/tenant', () => ({
  buildTenantFilter: vi.fn(() => ({ sql: '', params: [] })),
  resolveActiveTenantId: vi.fn()
}));

vi.mock('@/lib/repositories/PaymentRepository', () => ({
  PaymentRepository: {
    findPaymentsByClientId: vi.fn(),
    findPaymentsByInvoiceId: vi.fn()
  }
}));

describe('Payment History Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getSession as any).mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      role: 'admin'
    });
    (resolveActiveTenantId as any).mockReturnValue('tenant-1');
  });

  describe('getInvoicePaymentHistory', () => {
    it('should return invoice payment history with progressive paid and remaining', async () => {
      const mockHistory = [
        {
          id: 'pay-1',
          amount: 50000,
          paymentMethod: 'Virement',
          date: '2023-10-01',
          reference: 'VIR-1',
          progressivePaid: 50000,
          remainingAfterPayment: 150000
        },
        {
          id: 'pay-2',
          amount: 100000,
          paymentMethod: 'Espèces',
          date: '2023-10-15',
          reference: null,
          progressivePaid: 150000,
          remainingAfterPayment: 50000
        },
        {
          id: 'pay-3',
          amount: 50000,
          paymentMethod: 'Chèque',
          date: '2023-10-25',
          reference: 'CHQ-001',
          progressivePaid: 200000,
          remainingAfterPayment: 0
        }
      ];

      (PaymentRepository.findPaymentsByInvoiceId as any).mockReturnValue(mockHistory);

      const response = await getInvoicePaymentHistory('inv-1');
      expect(response.success).toBe(true);
      expect(response.data).toHaveLength(3);
      expect((response as any).data[2].remainingAfterPayment).toBe(0);
      expect((response as any).data[2].progressivePaid).toBe(200000);

      expect(PaymentRepository.findPaymentsByInvoiceId).toHaveBeenCalledWith('inv-1', 'tenant-1');
    });

    it('should handle unauthorized access', async () => {
      (getSession as any).mockResolvedValue(null);
      const response = await getInvoicePaymentHistory('inv-1');
      expect(response.success).toBe(false);
      expect((response as any).error).toBe('Unauthorized');
    });
  });

  describe('getClientPaymentHistory', () => {
    it('should return client payment history', async () => {
      const mockHistory = [
        {
          paymentId: 'pay-3',
          invoiceId: 'inv-1',
          invoiceNumber: 'F2023-01',
          invoiceTotal: 200000,
          amount: 50000,
          paymentMethod: 'Chèque',
          date: '2023-10-25',
          reference: 'CHQ-001',
          progressiveBalance: 0
        }
      ];

      (PaymentRepository.findPaymentsByClientId as any).mockReturnValue(mockHistory);

      const response = await getClientPaymentHistory('client-1', 'Client Name');
      expect(response.success).toBe(true);
      expect(response.data).toHaveLength(1);

      expect(PaymentRepository.findPaymentsByClientId).toHaveBeenCalledWith('client-1', 'Client Name', 'tenant-1');
    });
  });
});
