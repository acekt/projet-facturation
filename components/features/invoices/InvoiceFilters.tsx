import * as React from 'react';
import { Button } from '@/components/ui/button';
import { SearchBar } from '@/components/ui/search-bar';
import { INVOICE_STATUS } from '@/lib/constants';

interface InvoiceFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
}

export function InvoiceFilters({
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
}: InvoiceFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-4">
      <div className="flex-1">
        <SearchBar
          placeholder="Rechercher une facture (numéro, client)..."
          value={searchQuery}
          onChange={setSearchQuery}
          viewFormatKey="invoices"
        />
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <Button
          variant={statusFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('all')}
          className="rounded-full"
        >
          Toutes
        </Button>
        <Button
          variant={statusFilter === INVOICE_STATUS.PAID ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter(INVOICE_STATUS.PAID)}
          className="rounded-full"
        >
          Payées
        </Button>
        <Button
          variant={statusFilter === INVOICE_STATUS.PARTIALLY_PAID ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter(INVOICE_STATUS.PARTIALLY_PAID)}
          className="rounded-full"
        >
          Partielles
        </Button>
        <Button
          variant={statusFilter === INVOICE_STATUS.UNPAID ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter(INVOICE_STATUS.UNPAID)}
          className="rounded-full"
        >
          Non Payées
        </Button>
      </div>
    </div>
  );
}
