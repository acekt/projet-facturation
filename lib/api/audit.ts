import db from '@/lib/db';
import crypto from 'crypto';

export function logAudit(action: string, entityType: string, entityId: string | null, details: string, userId?: string, userName?: string) {
    try {
        db.prepare(`
            INSERT INTO audit_logs (id, userId, userName, action, entityType, entityId, details)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(crypto.randomUUID(), userId || null, userName || 'System', action, entityType, entityId, details);
    } catch (e) {
        console.error("Failed to log audit:", e);
    }
}
