import { NextResponse } from 'next/server';
import { getSession } from '@/lib/api/auth';
import db from '@/lib/db';
import bcrypt from 'bcryptjs';
import { userUpdateSchema } from '@/lib/validations';

const SALT_ROUNDS = 10;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const session = await getSession();

        if (!session || session.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        
        const validation = userUpdateSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ 
                error: 'Données invalides', 
                details: validation.error.flatten().fieldErrors 
            }, { status: 400 });
        }

        const { name, role, is_active, password, phone } = validation.data;

        if (password) {
            const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
            db.prepare('UPDATE users SET password = ?, force_password_change = 1 WHERE id = ?').run(hashedPassword, id);
        }

        if (name !== undefined && role !== undefined) {
            db.prepare('UPDATE users SET name = ?, role = ?, phone = ? WHERE id = ?').run(name, role, phone !== undefined ? phone : null, id);
        } else if (phone !== undefined) {
            db.prepare('UPDATE users SET phone = ? WHERE id = ?').run(phone, id);
        }

        if (is_active !== undefined) {
            // Prevent self-deactivation
            if (id === session.userId && is_active === 0) {
                return NextResponse.json({ error: 'Impossible de désactiver votre propre compte' }, { status: 400 });
            }
            if (is_active === 1) {
                db.prepare('UPDATE users SET is_active = 1, deletedAt = NULL WHERE id = ?').run(id);
            } else {
                db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(id);
            }
        }

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

        if (id === session.userId) {
            return NextResponse.json({ error: 'Impossible de supprimer votre propre compte' }, { status: 400 });
        }

        // Suppression logique (soft delete)
        db.prepare('UPDATE users SET is_active = 0, deletedAt = CURRENT_TIMESTAMP WHERE id = ?').run(id);

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
    }
}
