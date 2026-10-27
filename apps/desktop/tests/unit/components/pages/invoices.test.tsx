import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { InvoicesPage } from '@/components/pages/invoices'
import { useStore } from '@/lib/store'
import '@testing-library/jest-dom'
import React from 'react'

vi.mock('@workspace/ui/components/card', () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
}))
vi.mock('@workspace/ui/components/button', () => ({
  Button: ({ children, onClick, disabled }: any) => (
    <button data-testid="button" onClick={onClick} disabled={disabled}>{children}</button>
  ),
}))
vi.mock('@workspace/ui/components/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: any) => <div onClick={onClick}>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
}))
vi.mock('@workspace/ui/components/dialog', () => ({
  Dialog: ({ children, open }: any) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
}))
vi.mock('@workspace/ui/components/select', () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <div data-testid="select-root" data-value={value} onClick={() => onValueChange && onValueChange(value)}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children, className }: any) => <button data-testid="select-trigger" className={className}>{children}</button>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
  SelectItem: ({ children, value }: any) => <div data-testid={`select-item-${value}`} data-value={value}>{children}</div>,
}))
vi.mock('@workspace/ui/components/data-table', () => ({
  DataTable: ({ children }: any) => <table>{children}</table>,
  DataTableHead: ({ children }: any) => <thead>{children}</thead>,
  DataTableBody: ({ children }: any) => <tbody>{children}</tbody>,
  DataTableRow: ({ children }: any) => <tr>{children}</tr>,
  DataTableHeaderCell: ({ children }: any) => <th>{children}</th>,
  DataTableCell: ({ children }: any) => <td>{children}</td>,
  AmountCell: ({ amount }: any) => <td data-testid="amount-cell">{amount}</td>,
  ActionsCell: ({ children }: any) => <td data-testid="actions-cell">{children}</td>,
}))

vi.mock('@/lib/store', () => ({
  useStore: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@workspace/ui/components/pagination-custom', () => ({
  Pagination: () => <div data-testid="pagination" />,
}))

vi.mock('@workspace/ui/components/empty-state', () => ({
  EmptyState: ({ title, description }: any) => (
    <div data-testid="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  ),
}))

vi.mock('@workspace/ui/components/search-bar', () => ({
  SearchBar: ({ value, onChange, placeholder }: any) => (
    <input
      data-testid="search-bar"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  ),
}))

vi.mock('@workspace/ui/components/page-header', () => ({
  PageHeader: ({ title, actions }: any) => (
    <div data-testid="page-header">
      <h1>{title}</h1>
      <div>{actions}</div>
    </div>
  ),
}))

describe('InvoicesPage Component', () => {
  const mockInvoices = [
    {
      id: 'inv-1',
      number: 'FAC-2026-0001',
      clientId: 'c1',
      clientName: 'Client Comptoir (sans email)',
      clientEmail: null,
      date: '2026-10-27',
      dueDate: '2026-11-26',
      status: 'UNPAID',
      subtotal: 500000,
      total: 643875,
      items: [{ id: 'item-1', description: 'Prestation', quantity: 1, unitPrice: 500000, total: 500000 }],
    },
    {
      id: 'inv-2',
      number: 'FAC-2026-0002',
      clientId: 'c2',
      clientName: 'Total Gabon SA',
      clientEmail: 'comptabilite@total.ga',
      date: '2026-10-25',
      dueDate: '2026-11-25',
      status: 'PAID',
      subtotal: 1000000,
      total: 1287750,
      items: [{ id: 'item-2', description: 'Consulting', quantity: 2, unitPrice: 500000, total: 1000000 }],
    },
  ];

  beforeEach(() => {
    vi.mocked(useStore).mockImplementation((selector: any) => {
      const state = {
        invoices: mockInvoices,
        setInvoices: vi.fn(),
        quotes: [],
        setQuotes: vi.fn(),
        setPayments: vi.fn(),
        settings: { tvaRate: 18, cssRate: 1, tpsRate: 9.5 },
        setCreditNotes: vi.fn(),
        user: { role: 'admin', id: 'admin-1', name: 'Administrateur' },
        viewFormat: { invoices: 'table' },
        setViewFormat: vi.fn(),
        isDataLoaded: true,
      };
      return selector(state);
    });
  });

  it('affiche les factures y compris celles sans email client sans crash', () => {
    render(<InvoicesPage onCreateInvoice={vi.fn()} onEditInvoice={vi.fn()} />);

    expect(screen.getByText('FAC-2026-0001')).toBeInTheDocument();
    expect(screen.getByText('Client Comptoir (sans email)')).toBeInTheDocument();
    expect(screen.getByText('FAC-2026-0002')).toBeInTheDocument();
    expect(screen.getByText('Total Gabon SA')).toBeInTheDocument();
  });

  it('affiche le filtre déroulant de statut pour la sélection des états', () => {
    render(<InvoicesPage onCreateInvoice={vi.fn()} onEditInvoice={vi.fn()} />);

    expect(screen.getByText('Filtrer par statut')).toBeInTheDocument();
    expect(screen.getByTestId('select-item-all')).toBeInTheDocument();
    expect(screen.getByTestId('select-item-UNPAID')).toBeInTheDocument();
    expect(screen.getByTestId('select-item-PAID')).toBeInTheDocument();
    expect(screen.getByTestId('select-item-PARTIALLY_PAID')).toBeInTheDocument();
    expect(screen.getByTestId('select-item-OVERDUE')).toBeInTheDocument();
    expect(screen.getByTestId('select-item-cancelled')).toBeInTheDocument();
  });
});
