import { NextResponse } from 'next/server';
import { getSession } from '@/lib/api/auth';
import { logAudit } from '@/lib/api/audit';
import { UserRepository } from '@/lib/repositories/UserRepository';
import bcrypt from 'bcryptjs';
import { userCreateSchema } from '@/lib/validations';
import type { UserCreateRequest, UserResponse, ErrorResponse, DbUser } from '@/lib/types/api';

const SALT_ROUNDS = 10;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      const errorResponse: ErrorResponse = {
        error: 'Forbidden',
      };
      return NextResponse.json(errorResponse, { status: 403 });
    }

    const users = UserRepository.findAllActive();

    const userResponses: UserResponse[] = users.map((user): UserResponse => ({
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      role: user.role,
      is_active: user.is_active,
      created_at: user.created_at,
      last_login_at: user.last_login_at || undefined,
      phone: String(user.phone || ''),
      deletedAt: user.deletedAt || undefined,
    }));

    const response = NextResponse.json(userResponses);
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    return response;
  } catch (error) {
    console.error('[API Users] Error:', error);
    const errorResponse: ErrorResponse = {
      error: 'Failed to fetch users',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      const errorResponse: ErrorResponse = {
        error: 'Forbidden',
      };
      return NextResponse.json(errorResponse, { status: 403 });
    }
    if (!session.userId) {
      const errorResponse: ErrorResponse = {
        error: 'User ID manquant dans la session',
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const body: unknown = await request.json();

    // Validate request payload with Zod
    const validation = userCreateSchema.safeParse(body);
    if (!validation.success) {
      const errorResponse: ErrorResponse = {
        error: 'Données invalides',
        details: {
          fieldErrors: validation.error.flatten().fieldErrors,
        },
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const { name, email, role, password, phone, force_password_change, is_active } = validation.data; const username = validation.data.username || '';

    const id = globalThis.crypto.randomUUID();
    const cleanUsername = username.toLowerCase().trim();
    const cleanEmail = email?.toLowerCase().trim() || null;
    const cleanName = name.trim();
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    try {
      UserRepository.create({
        id,
        name: cleanName,
        email: cleanEmail || '',
        username: cleanUsername,
        password: hashedPassword,
        role: role,
        is_active: is_active ? 1 : 0,
        created_by: session.userId,
        phone: phone || undefined
      });
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.message?.includes('UNIQUE constraint failed')) {
        return NextResponse.json({ error: 'Un utilisateur avec cet email ou identifiant existe déjà.' }, { status: 400 });
      }
      throw error;
    }

    logAudit('CREATE', 'user', id, `Nouvel utilisateur créé: ${cleanUsername} (${role})`, session.userId, session.name || session.username || null);

    const userResponse: UserResponse = {
      id,
      name: cleanName,
      email: cleanEmail || '',
      username: cleanUsername as string,
      role,
      is_active: is_active ? 1 : 0,
      created_at: new Date().toISOString(),
      phone: phone || '',
    };

    return NextResponse.json(userResponse);
  } catch (error: any) {
    console.error('[API Users] Error:', error);
    
    // Handle SQLite constraint errors
    if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE' || error?.message?.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: 'Un utilisateur avec cet email ou identifiant existe déjà.' }, { status: 400 });
    }

    const errorResponse: ErrorResponse = {
      error: 'Failed to create user',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
