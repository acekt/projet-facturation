import { describe, it, expect, vi } from 'vitest';
import { getErrorMessage, actionSuccess, actionFailure } from '@/lib/utils/action-error';
import { navItems } from '@/components/layout/navigation';
import { formatExcelDate, translateInvoiceStatus, translateQuoteStatus } from '@/lib/services/excel-styles';

describe('Phase 2 — Plan Curatif Desktop (ADR-0045)', () => {
  describe('Lot Curatif B — Gestion typée des erreurs (getErrorMessage)', () => {
    it('B1.1 Extrait le message d une instance Error standard', () => {
      const err = new Error('Connexion SQLite impossible');
      expect(getErrorMessage(err)).toBe('Connexion SQLite impossible');
    });

    it('B1.2 Extrait le message d une chaîne simple', () => {
      expect(getErrorMessage('Erreur réseau')).toBe('Erreur réseau');
    });

    it('B1.3 Extrait le message d un objet avec propriété message ou error', () => {
      expect(getErrorMessage({ message: 'Conflit de synchronisation' })).toBe('Conflit de synchronisation');
      expect(getErrorMessage({ error: 'Tenant verrouillé' })).toBe('Tenant verrouillé');
    });

    it('B1.4 Renvoie le fallback en cas d erreur indéterminée ou nulle', () => {
      expect(getErrorMessage(null, 'Secours')).toBe('Secours');
      expect(getErrorMessage(undefined, 'Secours')).toBe('Secours');
      expect(getErrorMessage({}, 'Secours')).toBe('Secours');
    });

    it('B1.5 Formate les résultats actionSuccess et actionFailure', () => {
      const success = actionSuccess({ id: '123' });
      expect(success.success).toBe(true);
      if (success.success) {
        expect(success.data.id).toBe('123');
      }

      const failure = actionFailure(new Error('Accès refusé'));
      expect(failure.success).toBe(false);
      if (!failure.success) {
        expect(failure.error).toBe('Accès refusé');
      }
    });
  });

  describe('Lot Curatif C — Design Psychology & Navigation (Loi de Miller & Formatage)', () => {
    it('C1.1 navItems est partitionné selon la Loi de Miller en 3 groupes cognitifs', () => {
      const salesGroup = navItems.filter((i) => i.group === 'sales');
      const repositoryGroup = navItems.filter((i) => i.group === 'repository');
      const governanceGroup = navItems.filter((i) => i.group === 'governance');
      const bottomGroup = navItems.filter((i) => i.group === 'bottom');

      expect(salesGroup.map((i) => i.id)).toEqual(['dashboard', 'invoices', 'quotes', 'credit-notes']);
      expect(repositoryGroup.map((i) => i.id)).toEqual(['clients', 'services']);
      expect(governanceGroup.map((i) => i.id)).toEqual(['users', 'audit']);
      expect(bottomGroup.map((i) => i.id)).toEqual(['settings']);

      // Vérifie que chaque groupe a moins de 7 éléments (Loi de Miller 7±2)
      expect(salesGroup.length).toBeLessThanOrEqual(7);
      expect(repositoryGroup.length).toBeLessThanOrEqual(7);
      expect(governanceGroup.length).toBeLessThanOrEqual(7);
    });

    it('C1.2 formatExcelDate convertit proprement les dates ISO et YYYY-MM-DD en DD/MM/YYYY', () => {
      expect(formatExcelDate('2026-10-29')).toBe('29/10/2026');
      expect(formatExcelDate('')).toBe('');
    });

    it('C1.3 Les statuts de factures et devis sont traduits de manière lisible pour l export', () => {
      expect(translateInvoiceStatus('PAID')).toBe('Payé');
      expect(translateInvoiceStatus('UNPAID')).toBe('Non payé');
      expect(translateInvoiceStatus('PARTIALLY_PAID')).toBe('Partiel');
      expect(translateQuoteStatus('EN_ATTENTE')).toBe('En attente');
      expect(translateQuoteStatus('CONVERTI')).toBe('Converti');
    });
  });
});

