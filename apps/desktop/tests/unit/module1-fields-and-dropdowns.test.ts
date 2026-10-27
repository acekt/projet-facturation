import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import db from '@/lib/db';
import { clientSchema, clientUpdateSchema, serviceSchema, serviceUpdateSchema } from '@/lib/validations';
import { createClient, updateClient, getClients } from '@/app/actions/client.actions';
import { createService, getServices } from '@/app/actions/service.actions';
import * as authApi from '@/lib/api/auth';

vi.mock('@/lib/api/auth', () => ({
  getSession: vi.fn(),
}));

describe('Module 1 — Validation des Champs Obligatoires/Optionnels & Listes Déroulantes', () => {
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
  // 1. ZOD SCHEMAS: CLIENTS (Champs Obligatoires vs Optionnels)
  // ==========================================================================
  describe('1. clientSchema & clientUpdateSchema (Champs Obligatoires vs Optionnels)', () => {
    it('exige obligatoirement le nom du client (champ obligatoire avec *)', () => {
      const invalidNoName = clientSchema.safeParse({
        name: '',
        email: 'test@client.ga',
      });
      expect(invalidNoName.success).toBe(false);

      const invalidMissingName = clientSchema.safeParse({
        email: 'test@client.ga',
      });
      expect(invalidMissingName.success).toBe(false);
    });

    it('permet de créer un client sans email (champ optionnel)', () => {
      // Cas 1: email omis
      const validWithoutEmail = clientSchema.safeParse({
        name: 'Client Comptoir Gabon',
        phone: '+241 01 02 03 04',
      });
      expect(validWithoutEmail.success).toBe(true);

      // Cas 2: email vide ""
      const validEmptyEmail = clientSchema.safeParse({
        name: 'Client Sans Email',
        email: '',
        phone: '+241 01 02 03 04',
      });
      expect(validEmptyEmail.success).toBe(true);

      // Cas 3: email null
      const validNullEmail = clientSchema.safeParse({
        name: 'Client Null Email',
        email: null,
        phone: '+241 01 02 03 04',
      });
      expect(validNullEmail.success).toBe(true);
    });

    it('exige obligatoirement le numéro de téléphone du client (champ obligatoire avec *)', () => {
      const invalidNoPhone = clientSchema.safeParse({
        name: 'Client Sans Phone',
        email: 'test@client.ga',
      });
      expect(invalidNoPhone.success).toBe(false);

      const invalidEmptyPhone = clientSchema.safeParse({
        name: 'Client Sans Phone',
        phone: '',
      });
      expect(invalidEmptyPhone.success).toBe(false);

      const invalidFormatPhone = clientSchema.safeParse({
        name: 'Client Phone Invalide',
        phone: '123',
      });
      expect(invalidFormatPhone.success).toBe(false);

      const validPhone = clientSchema.safeParse({
        name: 'Client Phone Valide',
        phone: '+241 077 12 34 56',
      });
      expect(validPhone.success).toBe(true);
    });

    it('valide le format email uniquement si un email non-vide est fourni', () => {
      const invalidEmail = clientSchema.safeParse({
        name: 'Client Invalide',
        email: 'pas-un-email',
        phone: '+241 01 02 03 04',
      });
      expect(invalidEmail.success).toBe(false);

      const validEmail = clientSchema.safeParse({
        name: 'Client Valide',
        email: 'contact@entreprise.ga',
        phone: '+241 01 02 03 04',
      });
      expect(validEmail.success).toBe(true);
    });

    it('accepte les statuts de liste déroulante (active/inactive) et applique active par défaut', () => {
      const defaultStatus = clientSchema.parse({
        name: 'Client Statut Defaut',
        phone: '+241 01 02 03 04',
      });
      expect(defaultStatus.status).toBe('active');

      const inactiveStatus = clientSchema.parse({
        name: 'Client Suspendu',
        phone: '+241 01 02 03 04',
        status: 'inactive',
      });
      expect(inactiveStatus.status).toBe('inactive');

      const invalidStatus = clientSchema.safeParse({
        name: 'Client Statut Invalide',
        phone: '+241 01 02 03 04',
        status: 'unknown_status',
      });
      expect(invalidStatus.success).toBe(false);
    });

    it('considère adresse, NIF et RCCM comme optionnels mais exige un téléphone valide', () => {
      const parsed = clientSchema.safeParse({
        name: 'Societe Moderne SARL',
        phone: '+241 01 02 03 04',
        address: '',
        nif: null,
        rccm: undefined,
      });
      expect(parsed.success).toBe(true);
    });
  });

  // ==========================================================================
  // 2. ZOD SCHEMAS: SERVICES (Champs Obligatoires vs Optionnels)
  // ==========================================================================
  describe('2. serviceSchema & serviceUpdateSchema (Catalogue de Prestations)', () => {
    it('exige obligatoirement le nom et le prix unitaire XAF', () => {
      const missingName = serviceSchema.safeParse({
        unitPrice: 50000,
      });
      expect(missingName.success).toBe(false);

      const missingPrice = serviceSchema.safeParse({
        name: 'Audit Sécurité',
      });
      expect(missingPrice.success).toBe(false);

      const negativePrice = serviceSchema.safeParse({
        name: 'Audit Sécurité',
        unitPrice: -100,
      });
      expect(negativePrice.success).toBe(false);
    });

    it('exige la catégorie ou applique la catégorie par défaut, et rejette une catégorie vide', () => {
      const minimalService = serviceSchema.parse({
        name: 'Consulting IT',
        unitPrice: 250000,
      });
      expect(minimalService.category).toBe('Prestation de services');

      const invalidEmptyCategory = serviceSchema.safeParse({
        name: 'Consulting IT',
        unitPrice: 250000,
        category: '',
      });
      expect(invalidEmptyCategory.success).toBe(false);

      const fullService = serviceSchema.safeParse({
        name: 'Développement Web',
        unitPrice: 750000,
        category: 'Développement & IT',
        description: 'Création application web sur mesure',
      });
      expect(fullService.success).toBe(true);
    });
  });

  // ==========================================================================
  // 3. SERVER ACTIONS: COMPORTEMENT RUNTIME DES CHAMPS & LISTES
  // ==========================================================================
  describe('3. Server Actions: Clients sans email & Statuts (Active/Inactive)', () => {
    it('crée avec succès des clients sans email sans conflit d unicité', async () => {
      vi.mocked(authApi.getSession).mockResolvedValue({
        userId: 'admin-1',
        name: 'Admin Gabon',
        role: 'admin',
        tenantId: 'tenant-libreville',
      });

      // 1er client sans email (vente au comptoir)
      const res1 = await createClient({
        name: 'Client Comptoir 1',
        email: '',
        phone: '+241 077 11 22 33',
        status: 'active',
      });
      expect(res1.success).toBe(true);
      expect(res1.data.email).toBeNull();
      expect(res1.data.status).toBe('active');

      // 2e client sans email (artisan local) — ne doit PAS lever d erreur de doublon
      const res2 = await createClient({
        name: 'Client Comptoir 2',
        email: null,
        phone: '+241 066 44 55 66',
        status: 'inactive',
      });
      expect(res2.success).toBe(true);
      expect(res2.data.email).toBeNull();
      expect(res2.data.status).toBe('inactive');

      // Vérification en base de données
      const list = await getClients();
      expect(list.data.length).toBe(2);
      expect(list.data.find(c => c.name === 'Client Comptoir 2')?.status).toBe('inactive');
    });

    it('permet de modifier un client pour changer son statut de liste déroulante', async () => {
      vi.mocked(authApi.getSession).mockResolvedValue({
        userId: 'admin-1',
        name: 'Admin Gabon',
        role: 'admin',
        tenantId: 'tenant-libreville',
      });

      const createRes = await createClient({
        name: 'Client Transition SARL',
        email: 'transition@sarl.ga',
        phone: '+241 01 02 03 04',
        status: 'active',
      });
      expect(createRes.success).toBe(true);
      const clientId = createRes.data.id;

      // Basculer le statut en "inactive"
      const updateRes = await updateClient(clientId, {
        name: 'Client Transition SARL',
        email: 'transition@sarl.ga',
        status: 'inactive',
      });
      expect(updateRes.success).toBe(true);
      expect(updateRes.data.status).toBe('inactive');
    });
  });
});
