import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import db from '@/lib/db';
import { getInitials, escapeCsvCell } from '@/lib/utils';
import { createClient, updateClient, getClients } from '@/app/actions/client.actions';
import { createService, updateService, getServices } from '@/app/actions/service.actions';
import * as authApi from '@/lib/api/auth';

vi.mock('@/lib/api/auth', () => ({
  getSession: vi.fn(),
}));

describe('Module 1 Curatif — Anti-Parasites, Intégrité & Dédoublonnage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.exec(`
      DELETE FROM clients;
      DELETE FROM services;
      DELETE FROM audit_logs;
    `);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // 1. UTILITAIRES ROBUSTES (Avatar Initials & RFC 4180 CSV Escaping)
  // ==========================================================================
  describe('1. Robustesse des Utilitaires (lib/utils.ts)', () => {
    it('getInitials extrait proprement les initiales sans jamais crasher sur des espaces multiples ou chaînes vides', () => {
      expect(getInitials('Total Gabon')).toBe('TG');
      expect(getInitials('   Total     Gabon   ')).toBe('TG');
      expect(getInitials('Airtel')).toBe('AI');
      expect(getInitials('X')).toBe('X');
      expect(getInitials('')).toBe('CL');
      expect(getInitials('   ')).toBe('CL');
      expect(getInitials(null as any)).toBe('CL');
      expect(getInitials(undefined as any)).toBe('CL');
      expect(getInitials('Société Anonyme Des Boissons Du Gabon')).toBe('SA');
    });

    it('escapeCsvCell protège les cellules CSV contre l injection de virgules, retours chariot et guillemets', () => {
      expect(escapeCsvCell('Libreville')).toBe('"Libreville"');
      expect(escapeCsvCell('Boulevard Triomphal, Libreville')).toBe('"Boulevard Triomphal, Libreville"');
      expect(escapeCsvCell('Société "Gabon Services"')).toBe('"Société ""Gabon Services"""');
      expect(escapeCsvCell("Ligne 1\nLigne 2")).toBe("\"Ligne 1\nLigne 2\"");
      expect(escapeCsvCell(150000)).toBe('"150000"');
      expect(escapeCsvCell(null)).toBe('""');
      expect(escapeCsvCell(undefined)).toBe('""');
    });
  });

  // ==========================================================================
  // 2. DÉDOUBLONNAGE ET ISOLATION CLIENTS (client.actions.ts)
  // ==========================================================================
  describe('2. Intégrité Référentielle Clients & Dédoublonnage (client.actions.ts)', () => {
    it('rejette la création d un client avec une adresse email déjà existante dans le même tenant', async () => {
      vi.mocked(authApi.getSession).mockResolvedValue({
        userId: 'admin-1',
        name: 'Admin One',
        role: 'admin',
        tenantId: 'tenant-alpha',
      });

      // 1er client créé avec succès
      const res1 = await createClient({
        name: 'Client Alpha 1',
        email: 'contact@alpha.ga',
        phone: '+241 077 00 11 22',
        address: 'Libreville',
      });
      expect(res1.success).toBe(true);

      // 2e tentative de création avec le même email (casse différente)
      const res2 = await createClient({
        name: 'Client Alpha Doublon',
        email: 'CONTACT@alpha.ga',
        phone: '+241 077 33 44 55',
        address: 'Port-Gentil',
      });
      expect(res2.success).toBe(false);
      expect(res2.error).toBe('Un client avec cette adresse email existe déjà');
    });

    it('autorise la même adresse email dans deux tenants distincts (Isolation Multi-Tenant)', async () => {
      // Tenant Alpha
      vi.mocked(authApi.getSession).mockResolvedValue({
        userId: 'admin-1',
        name: 'Admin Alpha',
        role: 'admin',
        tenantId: 'tenant-alpha',
      });

      const resAlpha = await createClient({
        name: 'Client Partagé',
        email: 'partage@entreprise.ga',
        phone: '+241 077 00 00 00',
        address: 'Libreville',
      });
      expect(resAlpha.success).toBe(true);

      // Tenant Beta
      vi.mocked(authApi.getSession).mockResolvedValue({
        userId: 'admin-2',
        name: 'Admin Beta',
        role: 'admin',
        tenantId: 'tenant-beta',
      });

      const resBeta = await createClient({
        name: 'Client Partagé Chez Beta',
        email: 'partage@entreprise.ga',
        phone: '+241 077 11 11 11',
        address: 'Franceville',
      });
      expect(resBeta.success).toBe(true);
      expect(resBeta.data?.tenant_id).toBe('tenant-beta');
    });

    it('rejette la mise à jour d un client si la nouvelle adresse email appartient déjà à un autre client', async () => {
      vi.mocked(authApi.getSession).mockResolvedValue({
        userId: 'admin-1',
        name: 'Admin One',
        role: 'admin',
        tenantId: 'tenant-alpha',
      });

      const c1 = await createClient({
        name: 'Client 1',
        email: 'client1@alpha.ga',
        phone: '+241 01 00 00 01',
      });
      const c2 = await createClient({
        name: 'Client 2',
        email: 'client2@alpha.ga',
        phone: '+241 01 00 00 02',
      });

      expect(c1.success).toBe(true);
      expect(c2.success).toBe(true);

      // Tentative de renommer l'email de c2 avec celui de c1
      const updateRes = await updateClient(c2.data!.id, {
        name: 'Client 2 Renommé',
        email: 'client1@alpha.ga',
        phone: '+241 01 00 00 02',
      });

      expect(updateRes.success).toBe(false);
      expect(updateRes.error).toBe('Un client avec cette adresse email existe déjà');

      // Mise à jour de c2 sans changer son email (ou en gardant le sien) -> autorisée
      const selfUpdate = await updateClient(c2.data!.id, {
        name: 'Client 2 Nom Modifié',
        email: 'client2@alpha.ga',
        phone: '+241 01 00 00 02',
      });
      expect(selfUpdate.success).toBe(true);
      expect(selfUpdate.data?.name).toBe('Client 2 Nom Modifié');
    });
  });

  // ==========================================================================
  // 3. DÉDOUBLONNAGE ET ISOLATION SERVICES (service.actions.ts)
  // ==========================================================================
  describe('3. Intégrité Référentielle Services & Dédoublonnage (service.actions.ts)', () => {
    it('rejette la création d un service avec un libellé déjà existant dans le catalogue du tenant', async () => {
      vi.mocked(authApi.getSession).mockResolvedValue({
        userId: 'admin-1',
        name: 'Admin One',
        role: 'admin',
        tenantId: 'tenant-alpha',
      });

      const s1 = await createService({
        name: 'Audit de Sécurité',
        category: 'Consulting',
        unitPrice: 500000,
        description: 'Audit réseau',
      });
      expect(s1.success).toBe(true);

      // Doublon insensible à la casse et aux espaces
      const s2 = await createService({
        name: '  audit de sécurité  ',
        category: 'Sécurité',
        unitPrice: 750000,
      });
      expect(s2.success).toBe(false);
      expect(s2.error).toBe('Un service avec ce nom existe déjà');
    });

    it('autorise le même nom de service dans des tenants différents', async () => {
      vi.mocked(authApi.getSession).mockResolvedValue({
        userId: 'admin-1',
        name: 'Admin Alpha',
        role: 'admin',
        tenantId: 'tenant-alpha',
      });

      const sAlpha = await createService({
        name: 'Formation Informatique',
        category: 'Education',
        unitPrice: 200000,
      });
      expect(sAlpha.success).toBe(true);

      vi.mocked(authApi.getSession).mockResolvedValue({
        userId: 'admin-2',
        name: 'Admin Beta',
        role: 'admin',
        tenantId: 'tenant-beta',
      });

      const sBeta = await createService({
        name: 'Formation Informatique',
        category: 'Formation',
        unitPrice: 250000,
      });
      expect(sBeta.success).toBe(true);
      expect(sBeta.data?.tenant_id).toBe('tenant-beta');
    });

    it('rejette la mise à jour d un service vers un nom déjà pris par un autre service du tenant', async () => {
      vi.mocked(authApi.getSession).mockResolvedValue({
        userId: 'admin-1',
        name: 'Admin One',
        role: 'admin',
        tenantId: 'tenant-alpha',
      });

      const s1 = await createService({
        name: 'Service A',
        category: 'Cat A',
        unitPrice: 100000,
      });
      const s2 = await createService({
        name: 'Service B',
        category: 'Cat B',
        unitPrice: 200000,
      });

      expect(s1.success).toBe(true);
      expect(s2.success).toBe(true);

      // Tentative de renommer s2 en Service A
      const res = await updateService(s2.data!.id, {
        name: 'Service A',
        category: 'Cat B',
        unitPrice: 200000,
      });
      expect(res.success).toBe(false);
      expect(res.error).toBe('Un service avec ce nom existe déjà');

      // Mise à jour de son propre prix/description sans conflit
      const selfUpdate = await updateService(s2.data!.id, {
        name: 'Service B',
        category: 'Cat B Modifiée',
        unitPrice: 220000,
      });
      expect(selfUpdate.success).toBe(true);
      expect(selfUpdate.data?.unitPrice).toBe(220000);
    });
  });
});
