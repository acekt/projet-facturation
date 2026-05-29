import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import db from '@/lib/db';
import crypto from 'crypto';

const SALT = 'letoile-gabon-2026';
function hashPassword(password: string) {
  return crypto.createHash('sha256').update(password + SALT).digest('hex');
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
    try {
        const { id } = await params;
        const sessionId = (await cookies()).get('auth_session')?.value;
        const sessionParts = sessionId?.split('.');
        if (!sessionParts) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const decoded = JSON.parse(atob(sessionParts[0]));

        if (decoded.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { name, role, is_active, password } = body;

        if (password) {
            const hashedPassword = hashPassword(password);
            db.prepare('UPDATE users SET password = ?, force_password_change = 1 WHERE id = ?').run(hashedPassword, id);
        }

        if (name !== undefined && role !== undefined) {
            db.prepare('UPDATE users SET name = ?, role = ? WHERE id = ?').run(name, role, id);
        }

        if (is_active !== undefined) {
            // Prevent self-deactivation
            if (id === decoded.id && is_active === 0) {
                return NextResponse.json({ error: 'Impossible de désactiver votre propre compte' }, { status: 400 });
            }
            db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(is_active, id);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    try {
        const { id } = await params;
        const sessionId = (await cookies()).get('auth_session')?.value;
        const sessionParts = sessionId?.split('.');
        if (!sessionParts) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const decoded = JSON.parse(atob(sessionParts[0]));

        if (decoded.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (id === decoded.id) {
            return NextResponse.json({ error: 'Impossible de supprimer votre propre compte' }, { status: 400 });
        }

        // Soft delete or Hard delete? Spec says "suppression logique (soft delete)"
        db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(id);

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
    }
}
