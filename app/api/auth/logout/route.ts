import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { logAudit } from '@/lib/api/audit';

export async function POST() {
    try {
        const sessionCookie = (await cookies()).get('auth_session');
        if (sessionCookie) {
            setTimeout(() => {
                try {
                    logAudit('LOGOUT_SUCCESS', 'user', null, 'Déconnexion réussie', null);
                } catch (e) {
                    console.error('[Audit Log Error]', e);
                }
            }, 0);
        }
        (await cookies()).delete('auth_session');
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Erreur lors de la déconnexion' }, { status: 500 });
    }
}
