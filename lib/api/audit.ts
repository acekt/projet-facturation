import db from '@/lib/db';
import crypto from 'crypto';

export function logAudit(action: string, entityType: string, entityId: string | null, details: string, userId: string | null, userName?: string | null) {
    try {
        let finalUserName = userName || null;
        if (userId && !finalUserName) {
            try {
                const u = db.prepare('SELECT name, username FROM users WHERE id = ?').get(userId) as { name?: string; username?: string } | undefined;
                if (u) {
                    finalUserName = u.name || u.username || null;
                }
            } catch (e) {
                // ignore
            }
        }
        const loggedUserName = finalUserName || (userId ? userId : 'System');
        db.prepare(`
            INSERT INTO audit_logs (id, userId, userName, action, entityType, entityId, details)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(crypto.randomUUID(), userId || null, loggedUserName, action, entityType, entityId, details);
    } catch (e) {
        console.error("Failed to log audit:", e);
    }
}
