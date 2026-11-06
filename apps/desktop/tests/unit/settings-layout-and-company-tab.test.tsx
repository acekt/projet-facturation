import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { CompanySettingsTab } from '@/components/features/settings/CompanySettingsTab';
import type { Settings } from '@/lib/store';

describe('LOT 3 : Settings Layout & CompanySettingsTab Design System', () => {
  const baseSettings: Settings = {
    id: 1,
    companyName: 'Global Maintenance SARL',
    legalForm: 'SARL',
    email: 'contact@global-maintenance.ga',
    phone: '+241 01 23 45 67',
    nif: '123456789',
    rccm: 'RG-2026-B-1234',
    address: 'Zone Industrielle Oloumi, Libreville',
    logo: '',
    tvaRate: 18,
    cssRate: 1,
    tpsRate: 9.5,
    sessionTimeout: 60,
    smtpHost: 'smtp.office365.com',
    smtpPort: 587,
    smtpUser: 'facturation@global-maintenance.ga',
    smtpPass: 'secret',
    smtpSecure: false,
    bankName: '',
    bankAgency: '',
    accountNumber: '',
    iban: '',
    swiftCode: '',
    invoicePrefix: 'FAC',
    quotePrefix: 'DEV',
    companyCode: 'GM',
    mentionsLegales: '',
  };

  it('1. Affiche /logo.png par défaut avec badge "Logo par défaut" et overlay "Modifier le logo" si logo vide', () => {
    const { container } = render(
      <CompanySettingsTab
        formData={baseSettings}
        setFormData={() => {}}
        errors={{}}
        setErrors={() => {}}
        isAdmin={true}
      />
    );

    const logoImg = screen.getByAltText('Logo preview') as HTMLImageElement;
    expect(logoImg).toBeDefined();
    expect(logoImg.getAttribute('src')).toBe('/logo.png');

    expect(screen.getByText('Logo par défaut')).toBeDefined();
    expect(screen.getByText('Modifier le logo')).toBeDefined();
  });

  it('2. Affiche le logo personnalisé et l\'action "Remplacer le logo" lorsque formData.logo est défini', () => {
    const customSettings: Settings = {
      ...baseSettings,
      logo: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    };

    render(
      <CompanySettingsTab
        formData={customSettings}
        setFormData={() => {}}
        errors={{}}
        setErrors={() => {}}
        isAdmin={true}
      />
    );

    const logoImg = screen.getByAltText('Logo preview') as HTMLImageElement;
    expect(logoImg.getAttribute('src')).toContain('data:image/png;base64');
    expect(screen.getByText('Remplacer le logo')).toBeDefined();
    expect(screen.getByText(/Supprimer le logo/i)).toBeDefined();
  });

  it('3. Vérifie les placeholders sans "ex:" et avec les libellés canoniques requis', () => {
    render(
      <CompanySettingsTab
        formData={baseSettings}
        setFormData={() => {}}
        errors={{}}
        setErrors={() => {}}
        isAdmin={true}
      />
    );

    const hostInput = screen.getByPlaceholderText("Entrez l'hôte du serveur SMTP");
    expect(hostInput).toBeDefined();

    const userInput = screen.getByPlaceholderText("Entrez l'adresse email d'expédition");
    expect(userInput).toBeDefined();

    const portInput = screen.getByPlaceholderText("Entrez le port SMTP");
    expect(portInput).toBeDefined();
  });

  it('4. Vérifie que le bouton "Tester la connexion" respecte le Design System (aucun text-emerald)', () => {
    const { container } = render(
      <CompanySettingsTab
        formData={baseSettings}
        setFormData={() => {}}
        errors={{}}
        setErrors={() => {}}
        isAdmin={true}
      />
    );

    const testBtn = screen.getByRole('button', { name: /Tester la connexion/i });
    expect(testBtn).toBeDefined();

    // Vérifie qu'il n'y a plus aucune classe text-emerald-600 sur l'icône
    const emeraldIcons = container.querySelectorAll('.text-emerald-600');
    expect(emeraldIcons.length).toBe(0);
  });

  it('5. La grille CompanySettingsTab utilise une disposition équilibrée xl:grid-cols-12', () => {
    const { container } = render(
      <CompanySettingsTab
        formData={baseSettings}
        setFormData={() => {}}
        errors={{}}
        setErrors={() => {}}
        isAdmin={true}
      />
    );

    const rootGrid = container.firstChild as HTMLElement;
    expect(rootGrid.className).toContain('grid');
    expect(rootGrid.className).toContain('xl:grid-cols-12');
  });
});

