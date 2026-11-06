import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PageHeader } from '@/components/features/common/PageHeader';
import { SortSelect } from '@/components/features/common/SortSelect';
import { EditorItemsTable } from '@/components/editor/EditorItemsTable';
import type { DraftItem, Service } from '@/lib/store';

describe('Page Headers Architecture, SortSelect & Service Picker UX', () => {
  describe('1. Unified PageHeader Component', () => {
    it('Renders title, description, badge and actions properly', () => {
      render(
        <PageHeader
          title="Gestion de Stock"
          description="Suivi du stock physique et valorisation"
          badge={<span data-testid="test-badge">Badge Test</span>}
          actions={<button data-testid="test-action">Action Button</button>}
          sortSelector={<div data-testid="test-sort">Sort Dropdown</div>}
        />
      );

      expect(screen.getByText('Gestion de Stock')).toBeDefined();
      expect(screen.getByText('Suivi du stock physique et valorisation')).toBeDefined();
      expect(screen.getByTestId('test-badge')).toBeDefined();
      expect(screen.getByTestId('test-action')).toBeDefined();
      expect(screen.getByTestId('test-sort')).toBeDefined();
    });
  });

  describe('2. Standardized SortSelect Component', () => {
    it('Renders currency type with appropriate French labels', () => {
      const handleChange = vi.fn();
      render(
        <SortSelect
          value="recent"
          onValueChange={handleChange}
          type="currency"
        />
      );

      expect(screen.getByText("Plus récents d'abord")).toBeDefined();
    });

    it('Renders quantity type with appropriate French labels', () => {
      const handleChange = vi.fn();
      render(
        <SortSelect
          value="amount_desc"
          onValueChange={handleChange}
          type="quantity"
        />
      );

      expect(screen.getByText('Quantité décroissante')).toBeDefined();
    });
  });

  describe('3. Premium Service Picker in EditorItemsTable', () => {
    const dummyServices: Service[] = [
      {
        id: 'srv-1',
        name: 'Installation Réseau Fibre',
        category: 'Réseau & Télécom',
        unitPrice: 150000,
        trackStock: 1,
        stockQuantity: 12,
        minStockAlert: 5,
        unit: 'Forfait',
        createdAt: '2026-11-01',
      },
      {
        id: 'srv-2',
        name: 'Routeur Cisco Pro',
        category: 'Matériel',
        unitPrice: 85000,
        trackStock: 1,
        stockQuantity: 0,
        minStockAlert: 3,
        unit: 'Pièce',
        createdAt: '2026-11-01',
      },
      {
        id: 'srv-3',
        name: 'Consulting IT',
        category: 'Conseil',
        unitPrice: 50000,
        trackStock: 0,
        stockQuantity: 0,
        minStockAlert: 0,
        unit: 'Heure',
        createdAt: '2026-11-01',
      },
    ];

    const dummyItems: DraftItem[] = [
      {
        id: 'item-1',
        description: '',
        quantity: 1,
        unitPrice: 0,
        total: 0,
      },
    ];

    it('Renders table headers and inputs properly', () => {
      const onUpdateItem = vi.fn();
      const onAddItem = vi.fn();
      const onRemoveItem = vi.fn();

      render(
        <EditorItemsTable
          items={dummyItems}
          services={dummyServices}
          onUpdateItem={onUpdateItem}
          onAddItem={onAddItem}
          onRemoveItem={onRemoveItem}
        />
      );

      expect(screen.getByText('Prestations & Produits')).toBeDefined();
      expect(screen.getByPlaceholderText('Sélectionner ou saisir une prestation...')).toBeDefined();
    });

    it('Allows direct typing in description input', () => {
      const onUpdateItem = vi.fn();
      const onAddItem = vi.fn();
      const onRemoveItem = vi.fn();

      render(
        <EditorItemsTable
          items={dummyItems}
          services={dummyServices}
          onUpdateItem={onUpdateItem}
          onAddItem={onAddItem}
          onRemoveItem={onRemoveItem}
        />
      );

      const input = screen.getByPlaceholderText('Sélectionner ou saisir une prestation...');
      fireEvent.change(input, { target: { value: 'Prestation sur mesure' } });

      expect(onUpdateItem).toHaveBeenCalledWith('item-1', 'description', 'Prestation sur mesure');
    });
  });
});

