import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { logAudit } from '@/lib/api/audit';
import { getSession } from '@/lib/api/auth';

export async function POST() {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('auth_session');
        
        if (sessionCookie) {
            // Extraction de la session pour identifier l'utilisateur avant de détruire le cookie
            const session = await getSession(sessionCookie.value);
            
            if (session && session.userId) {
                try {
                    // Écriture synchrone/bloquante assurée avant la fin de la requête
                    await logAudit(
                        'LOGOUT_SUCCESS', 
                        'user', 
                        session.userId, 
                        'Déconnexion réussie', 
                        session.userId,
                        session.name || null
                    );
                } catch (e) {
                    console.error('[Audit Log Error]', e);
                }
            }
        }
        
        // Suppression du cookie de session
        cookieStore.delete('auth_session');
        
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Logout Error]', error);
        return NextResponse.json({ error: 'Erreur lors de la déconnexion' }, { status: 500 });
    }
}
