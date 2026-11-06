import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { getPaymentBadge } from '@/components/pages/invoices/InvoiceViews';
import { Pagination } from '@workspace/ui/components/pagination-custom';
import type { Invoice, CreditNote } from '@/lib/store';
import { INVOICE_STATUS } from '@/lib/constants';

describe('LOT 4 : Clarté du Badge Facture Annulée & Stabilité de Pagination', () => {
  const dummyInvoice: Invoice = {
    id: 'inv-100',
    number: 'FAC-2026-100',
    clientId: 'cli-1',
    clientName: 'SETRAG Transgabonais',
    date: '2026-11-01',
    dueDate: '2026-11-30',
    items: [],
    subtotal: 500000,
    discount: 0,
    total: 500000,
    taxBase: 500000,
    tvaAmount: 0,
    cssAmount: 0,
    status: INVOICE_STATUS.UNPAID,
    payments: [],
    createdAt: '2026-11-01T10:00:00.000Z',
  };

  describe('1. Clarté du Badge sur les Factures Annulées / Soldées par Avoir', () => {
    it('Affiche le badge "Annulée (Avoir)" avec style rose pour une facture ayant le statut CANCELLED', () => {
      const cancelledInvoice: Invoice = {
        ...dummyInvoice,
        status: INVOICE_STATUS.CANCELLED,
      };

      const { container } = render(<div>{getPaymentBadge(cancelledInvoice)}</div>);
      expect(screen.getByText('Annulée (Avoir)')).toBeDefined();
      expect(container.querySelector('.bg-rose-500\\/10')).toBeDefined();
      expect(container.querySelector('.text-rose-700')).toBeDefined();
    });

    it('Affiche le badge "Annulée (Avoir)" pour une facture soldée intégralement par un avoir', () => {
      const creditedInvoice: Invoice = {
        ...dummyInvoice,
        status: 'PAID', // Statut DB pouvant être passé à PAID ou RESTOCK
      };

      const creditNotes: CreditNote[] = [
        {
          id: 'cn-1',
          number: 'AVR-2026-001',
          invoiceId: creditedInvoice.id,
          clientId: creditedInvoice.clientId,
          clientName: creditedInvoice.clientName,
          date: '2026-11-02',
          items: [],
          subtotal: 500000,
          taxBase: 500000,
          tvaAmount: 0,
          cssAmount: 0,
          total: 500000,
          reason: 'Annulation commande',
          status: 'applied',
          createdAt: '2026-11-02T10:00:00.000Z',
        },
      ];

      const { container } = render(<div>{getPaymentBadge(creditedInvoice, creditNotes)}</div>);
      expect(screen.getByText('Annulée (Avoir)')).toBeDefined();
      expect(container.querySelector('.bg-rose-500\\/10')).toBeDefined();
    });

    it('Ne confond pas une facture payée normalement en espèces/virement avec une facture annulée', () => {
      const paidInvoice: Invoice = {
        ...dummyInvoice,
        status: 'PAID',
        payments: [
          {
            id: 'pay-1',
            invoiceId: dummyInvoice.id,
            amount: 500000,
            date: '2026-11-02',
            paymentMethod: 'Virement',
            reference: 'VIR-001',
            createdAt: '2026-11-02T10:00:00.000Z',
          },
        ],
      };

      render(<div>{getPaymentBadge(paidInvoice)}</div>);
      expect(screen.queryByText('Annulée (Avoir)')).toBeNull();
      expect(screen.getByText(/Soldé/i)).toBeDefined();
    });
  });

  describe('2. Stabilité de la Barre de Pagination Inférieure', () => {
    it('Reste toujours visible avec "Page 1 sur 1" et boutons désactivés quand totalPages === 1', () => {
      const onPageChange = vi.fn();
      render(<Pagination currentPage={1} totalPages={1} onPageChange={onPageChange} />);

      expect(screen.getByText('Page 1 sur 1')).toBeDefined();
      const buttons = screen.getAllByRole('button');
      // Tous les boutons de navigation (<<, <, >, >>) doivent être désactivés
      buttons.forEach((btn) => {
        expect(btn.hasAttribute('disabled')).toBe(true);
      });
    });

    it('Reste visible même si totalPages === 0 en appliquant safeTotalPages = 1', () => {
      const onPageChange = vi.fn();
      render(<Pagination currentPage={1} totalPages={0} onPageChange={onPageChange} />);

      expect(screen.getByText('Page 1 sur 1')).toBeDefined();
      const buttons = screen.getAllByRole('button');
      buttons.forEach((btn) => {
        expect(btn.hasAttribute('disabled')).toBe(true);
      });
    });

    it('Active les boutons de navigation quand il y a plusieurs pages', () => {
      const onPageChange = vi.fn();
      render(<Pagination currentPage={2} totalPages={5} onPageChange={onPageChange} />);

      expect(screen.getByText('Page 2 sur 5')).toBeDefined();
      const buttons = screen.getAllByRole('button');
      // Bouton précédent (<) activé
      expect(buttons[1].hasAttribute('disabled')).toBe(false);
      // Bouton suivant (>) activé
      expect(buttons[2].hasAttribute('disabled')).toBe(false);
    });
  });
});
