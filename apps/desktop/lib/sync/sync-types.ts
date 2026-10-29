export interface SyncReport {
  tenantId: string;
  pushed: number;
  pulled: number;
  deleted: number;
  skipped: number;
  errors: string[];
}

export interface SyncContext {
  tenantId: string;
  userId: string;
  role: string;
}

export interface HubFlagItem {
  id: string;
  tenant_id: string;
  flag_key: string;
  enabled: boolean;
  payload?: Record<string, unknown>;
}

export interface HubAnnouncementItem {
  id: string;
  tenant_id: string;
  title: string;
  message: string;
  level: 'info' | 'warning' | 'critical';
  published_at: string;
}

