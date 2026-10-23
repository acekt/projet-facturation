import db from '@/lib/db';

export interface ILicenseStatus {
  status: 'active' | 'trial' | 'suspended' | 'expired';
  isReadOnly: boolean;
  licenseExpiresAt: string | null;
  daysRemaining: number | null;
  isInGracePeriod: boolean;
  message?: string;
}

export class LicenseRestrictedError extends Error {
  public readonly isReadOnly: boolean = true;
  public readonly licenseStatus: 'expired' | 'suspended';

  constructor(message: string, licenseStatus: 'expired' | 'suspended' = 'expired') {
    super(message);
    this.name = 'LicenseRestrictedError';
    this.licenseStatus = licenseStatus;
  }
}

const GRACE_PERIOD_DAYS = 7;

/**
 * Lit une clé dans la table sync_meta de SQLite local.
 */
function getMeta(key: string): string | null {
  try {
    const row = db.prepare('SELECT value FROM sync_meta WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * Enregistre une clé dans la table sync_meta.
 */
function setMeta(key: string, value: string) {
  try {
    db.prepare('INSERT INTO sync_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
  } catch (err) {
    console.warn('[license] Failed to write to sync_meta:', err);
  }
}

/**
 * Met à jour le cache local de statut de licence (appelé notamment lors de la synchronisation Cloud ou de l'enrôlement).
 */
export function updateCachedLicenseStatus(
  tenantId: string,
  status: 'active' | 'trial' | 'suspended' | 'expired',
  expiresAt?: string | null
): void {
  setMeta(`license:status:${tenantId}`, status);
  if (expiresAt !== undefined) {
    setMeta(`license:expires_at:${tenantId}`, expiresAt || '');
  }
  setMeta('license:last_checked_at', new Date().toISOString());
}

/**
 * Évalue le statut de la licence pour un tenant donné à partir de SQLite local (sync_meta ou tenants local).
 */
export function getLicenseStatus(tenantId?: string | null): ILicenseStatus {
  if (!tenantId) {
    // Si aucun tenant n'est encore configuré, on autorise l'accès (mode setup / standalone initial)
    return {
      status: 'active',
      isReadOnly: false,
      licenseExpiresAt: null,
      daysRemaining: null,
      isInGracePeriod: false,
    };
  }

  // 1. Chercher dans sync_meta
  let rawStatus = getMeta(`license:status:${tenantId}`) || getMeta('license:status');
  let rawExpiresAt = getMeta(`license:expires_at:${tenantId}`) || getMeta('license:expires_at');

  // 2. Si non trouvé dans sync_meta, chercher dans la table tenants locale si elle existe
  if (!rawStatus) {
    try {
      const tenantRow = db.prepare('SELECT status, license_expires_at, trial_ends_at FROM tenants WHERE id = ?').get(tenantId) as {
        status?: string;
        license_expires_at?: string;
        trial_ends_at?: string;
      } | undefined;

      if (tenantRow) {
        rawStatus = tenantRow.status || null;
        rawExpiresAt = tenantRow.license_expires_at || tenantRow.trial_ends_at || null;
      }
    } catch {
      // Table tenants peut ne pas exister dans un SQLite local V1
    }
  }

  const status = (rawStatus as 'active' | 'trial' | 'suspended' | 'expired') || 'active';
  const expiresAt = rawExpiresAt && rawExpiresAt.trim() !== '' ? rawExpiresAt : null;

  let daysRemaining: number | null = null;
  let isInGracePeriod = false;
  let isReadOnly = false;
  let message: string | undefined;

  if (status === 'suspended') {
    isReadOnly = true;
    message = "Organisation suspendue : l'accès d'émission de votre entreprise a été suspendu par l'administrateur du Hub. L'application reste en mode consultation et impression.";
    return {
      status: 'suspended',
      isReadOnly: true,
      licenseExpiresAt: expiresAt,
      daysRemaining: 0,
      isInGracePeriod: false,
      message,
    };
  }

  if (expiresAt) {
    const expiryTime = new Date(expiresAt).getTime();
    if (!isNaN(expiryTime)) {
      const now = Date.now();
      const diffMs = expiryTime - now;
      daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (diffMs < 0) {
        // Expiré
        const daysSinceExpiry = Math.abs(daysRemaining);
        if (daysSinceExpiry <= GRACE_PERIOD_DAYS && status !== 'expired') {
          // Dans la période de grâce de 7 jours
          isInGracePeriod = true;
          isReadOnly = false;
          message = `Attention : votre abonnement a expiré il y a ${daysSinceExpiry} jour(s). Période de grâce active (${GRACE_PERIOD_DAYS - daysSinceExpiry} jour(s) restant(s)). Renouvelez votre licence pour éviter le passage en consultation seule.`;
        } else {
          // Période de grâce dépassée ou statut explicitement 'expired'
          isReadOnly = true;
          message = "Licence Facturier expirée : l'application est en mode consultation seule. Vous pouvez consulter, exporter et imprimer vos documents existants. Renouvelez votre abonnement pour émettre de nouveaux documents.";
        }
      } else if (daysRemaining <= 15) {
        message = `Votre licence Facturier expire dans ${daysRemaining} jour(s). Pensez à renouveler votre abonnement.`;
      }
    }
  } else if (status === 'expired') {
    isReadOnly = true;
    message = "Licence Facturier expirée : l'application est en mode consultation seule. Vous pouvez consulter, exporter et imprimer vos documents existants.";
  }

  return {
    status: isReadOnly ? 'expired' : status,
    isReadOnly,
    licenseExpiresAt: expiresAt,
    daysRemaining,
    isInGracePeriod,
    message,
  };
}

/**
 * Garde d'autorisation d'émission de document comptable (facture, devis, avoir).
 * Lève une exception si l'entreprise est en mode lecture seule (licence échue hors période de grâce ou suspendue).
 */
export function assertLicenseAllowsCreation(tenantId?: string | null): void {
  const license = getLicenseStatus(tenantId);
  if (license.isReadOnly) {
    const errorMsg = license.message || "Licence Facturier expirée : l'application est en mode consultation seule. Renouvelez votre abonnement pour émettre de nouveaux documents.";
    throw new LicenseRestrictedError(errorMsg, license.status === 'suspended' ? 'suspended' : 'expired');
  }
}
