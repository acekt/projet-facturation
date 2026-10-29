import { describe, it, expect, beforeEach } from 'vitest';
import db from '@/lib/db';
import { 
  saveHubCache, 
  getHubCache, 
  getAllHubCache, 
  isFlagEnabled, 
  getActiveAnnouncements, 
  type HubAnnouncement, 
  type HubTenantFlag 
} from '@/lib/api/hub-cache';
import { getDesktopAnnouncementsAction, checkFeatureFlagAction } from '@/app/actions/hub.actions';

describe('Lot H1 — Canal Descendant Hub & Cache Local (hub_cache)', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM hub_cache').run();
  });

  it('1. Enregistre et restitue des entrées typées dans hub_cache', () => {
    saveHubCache('setting', 'company_code', { code: 'GABON-01' });

    const cached = getHubCache<{ code: string }>('setting', 'company_code');
    expect(cached).toBeDefined();
    expect(cached?.code).toBe('GABON-01');
  });

  it('2. Active et évalue correctement les drapeaux de fonctionnalités (tenant_flags)', async () => {
    expect(isFlagEnabled('beta_features')).toBe(false);
    expect(isFlagEnabled('beta_features', true)).toBe(true);

    const flag: HubTenantFlag = {
      tenant_id: 'tenant-123',
      flag_key: 'beta_features',
      enabled: true,
      config: { max_items: 50 },
      updated_at: new Date().toISOString(),
    };
    saveHubCache('flag', 'beta_features', flag);

    expect(isFlagEnabled('beta_features')).toBe(true);

    const actionRes = await checkFeatureFlagAction('beta_features');
    expect(actionRes.success).toBe(true);
    expect(actionRes.enabled).toBe(true);
  });

  it('3. Filtre les annonces expirées et conserve uniquement les annonces actives', async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 86400000).toISOString();
    const future = new Date(now.getTime() + 86400000).toISOString();
    const farPast = new Date(now.getTime() - 172800000).toISOString();

    const activeAnnouncement: HubAnnouncement = {
      id: 'ann-1',
      title: 'Maintenance Système',
      body: 'Interruption planifiée à 22h UTC.',
      level: 'maintenance',
      is_active: true,
      starts_at: past,
      ends_at: future,
      created_at: past,
    };

    const expiredAnnouncement: HubAnnouncement = {
      id: 'ann-2',
      title: 'Vœux de fin d’année',
      body: 'Bonne année 2025 !',
      level: 'info',
      is_active: true,
      starts_at: farPast,
      ends_at: past, // Expirée !
      created_at: farPast,
    };

    const inactiveAnnouncement: HubAnnouncement = {
      id: 'ann-3',
      title: 'Brouillon non publié',
      body: 'Texte secret',
      level: 'info',
      is_active: false,
      starts_at: past,
      created_at: past,
    };

    saveHubCache('announcement', activeAnnouncement.id, activeAnnouncement);
    saveHubCache('announcement', expiredAnnouncement.id, expiredAnnouncement);
    saveHubCache('announcement', inactiveAnnouncement.id, inactiveAnnouncement);

    const activeList = getActiveAnnouncements();
    expect(activeList.length).toBe(1);
    expect(activeList[0].id).toBe('ann-1');
    expect(activeList[0].level).toBe('maintenance');

    const res = await getDesktopAnnouncementsAction();
    expect(res.success).toBe(true);
    expect(res.data.length).toBe(1);
    expect(res.data[0].title).toBe('Maintenance Système');
  });
});
