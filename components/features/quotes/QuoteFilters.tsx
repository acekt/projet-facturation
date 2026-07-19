import * as React from 'react';
import { Button } from '@/components/ui/button';
import { SearchBar } from '@/components/ui/search-bar';
import { QUOTE_STATUS } from '@/lib/constants';

interface QuoteFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
}

export function QuoteFilters({
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
}: QuoteFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-4">
      <div className="flex-1">
        <SearchBar
          placeholder="Rechercher un devis (numéro, client)..."
          value={searchQuery}
          onChange={setSearchQuery}
          viewFormatKey="quotes"
        />
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <Button
          variant={statusFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('all')}
          className="rounded-full"
        >
          Tous
        </Button>
        <Button
          variant={statusFilter === QUOTE_STATUS.EN_ATTENTE ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter(QUOTE_STATUS.EN_ATTENTE)}
          className="rounded-full"
        >
          En Attente
        </Button>
        <Button
          variant={statusFilter === QUOTE_STATUS.CONVERTI ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter(QUOTE_STATUS.CONVERTI)}
          className="rounded-full"
        >
          Converti
        </Button>
      </div>
    </div>
  );
}
