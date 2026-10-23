import db from '@/lib/db';
import crypto from 'crypto';
import { resolveActiveTenantId } from '@/lib/api/tenant';

const getUserStmt = db.prepare('SELECT name, username, tenant_id FROM users WHERE id = ?');
const insertAuditStmt = db.prepare(`
    INSERT INTO audit_logs (id, userId, userName, action, entityType, entityId, details, tenant_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

export function logAudit(
    action: string,
    entityType: string,
    entityId: string | null,
    details: string,
    userId: string | null,
    userName?: string | null,
    tenantId?: string | null
) {
    try {
        let finalUserName = userName || null;
        let resolvedTenantId = tenantId || null;
        if (userId && (!finalUserName || !resolvedTenantId)) {
            try {
                const u = getUserStmt.get(userId) as { name?: string; username?: string; tenant_id?: string | null } | undefined;
                if (u) {
                    if (!finalUserName) finalUserName = u.name || u.username || null;
                    if (!resolvedTenantId) resolvedTenantId = u.tenant_id || null;
                }
            } catch {
                // ignore
            }
        }
        if (!resolvedTenantId) {
            resolvedTenantId = resolveActiveTenantId(userId, null);
        }
        const loggedUserName = finalUserName || (userId ? userId : 'System');
        insertAuditStmt.run(
            crypto.randomUUID(),
            userId || null,
            loggedUserName,
            action,
            entityType,
            entityId,
            details,
            resolvedTenantId
        );
    } catch (e) {
        console.error("Failed to log audit:", e);
    }
}
