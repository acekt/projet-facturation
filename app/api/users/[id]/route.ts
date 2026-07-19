import db from '@/lib/db';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/api/auth';
import { UserRepository } from '@/lib/repositories/UserRepository';
import bcrypt from 'bcryptjs';
import { userUpdateSchema } from '@/lib/validations';
import { logAudit } from '@/lib/api/audit';

const SALT_ROUNDS = 10;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const session = await getSession();

        if (!session || session.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        if (!session.userId) {
            return NextResponse.json({ error: 'User ID manquant dans la session' }, { status: 400 });
        }

        const body = await request.json();
        
        const validation = userUpdateSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ 
                error: 'Données invalides', 
                details: validation.error.flatten().fieldErrors 
            }, { status: 400 });
        }

        const { name, email, role, is_active, password, phone } = validation.data;

        if (id === session.userId && role && role !== 'admin') {
            return NextResponse.json({ error: 'Impossible de rétrograder votre propre rôle administrateur' }, { status: 400 });
        }

        if (password && password !== '') {
            const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
            db.prepare('UPDATE users SET password = ?, force_password_change = 1 WHERE id = ?').run(hashedPassword, id);
        }

        if (name !== undefined && role !== undefined) {
            if (email !== undefined && email !== null && email !== "") {
                db.prepare('UPDATE users SET name = ?, email = ?, role = ?, phone = ? WHERE id = ?').run(name, email, role, phone !== undefined && phone !== "" ? phone : null, id);
            } else {
                db.prepare('UPDATE users SET name = ?, role = ?, phone = ? WHERE id = ?').run(name, role, phone !== undefined && phone !== "" ? phone : null, id);
            }
        } else if (phone !== undefined) {
            db.prepare('UPDATE users SET phone = ? WHERE id = ?').run(phone !== "" ? phone : null, id);
        }

        if (is_active !== undefined) {
            // SQLite stores booleans as 0/1 integers
            const isActiveInt = is_active ? 1 : 0;
            // Prevent self-deactivation
            if (id === session.userId && isActiveInt === 0) {
                return NextResponse.json({ error: 'Impossible de désactiver votre propre compte' }, { status: 400 });
            }
            if (isActiveInt === 1) {
                db.prepare('UPDATE users SET is_active = 1, deletedAt = NULL WHERE id = ?').run(id);
            } else {
                db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(id);
            }
        }

        logAudit('UPDATE', 'user', id, `Utilisateur mis à jour: ${id}`, session.userId, session.name || session.username || null);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const session = await getSession();

        if (!session || session.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        if (!session.userId) {
            return NextResponse.json({ error: 'User ID manquant dans la session' }, { status: 400 });
        }

        if (id === session.userId) {
            return NextResponse.json({ error: 'Impossible de supprimer votre propre compte' }, { status: 400 });
        }

        // Suppression logique (soft delete)
        db.prepare('UPDATE users SET is_active = 0, deletedAt = CURRENT_TIMESTAMP WHERE id = ?').run(id);
        logAudit('DELETE', 'user', id, `Utilisateur désactivé/supprimé: ${id}`, session.userId, session.name || session.username || null);

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
    }
}

export const PUT = PATCH;
