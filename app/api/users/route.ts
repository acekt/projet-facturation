import { NextResponse } from 'next/server';
import { getSession } from '@/lib/api/auth';
import db from '@/lib/db';
import bcrypt from 'bcryptjs';
import { userCreateSchema } from '@/lib/validations';
import type { UserCreateRequest, UserResponse, ErrorResponse, DbUser } from '@/lib/types/api';

const SALT_ROUNDS = 10;

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      const errorResponse: ErrorResponse = {
        error: 'Forbidden',
      };
      return NextResponse.json(errorResponse, { status: 403 });
    }

    const users = db.prepare('SELECT id, name, email, username, role, is_active, created_at, last_login_at, phone, deletedAt FROM users').all() as DbUser[];
    const userResponses: UserResponse[] = users.map((user): UserResponse => ({
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      role: user.role,
      is_active: user.is_active,
      created_at: user.created_at,
      last_login_at: user.last_login_at,
      phone: user.phone,
      deletedAt: user.deletedAt,
    }));

    return NextResponse.json(userResponses);
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

    const { name, email, username, role, password, phone, force_password_change, is_active }: UserCreateRequest = validation.data;

    const id = crypto.randomUUID();
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    db.prepare(`
      INSERT INTO users (id, name, email, username, password, role, is_active, created_by, phone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, email, username, hashedPassword, role, is_active ? 1 : 0, session.userId, phone || null);

    const userResponse: UserResponse = {
      id,
      name,
      email,
      username,
      role,
      is_active: is_active ? 1 : 0,
      created_at: new Date().toISOString(),
      phone,
    };

    return NextResponse.json(userResponse);
  } catch (error: unknown) {
    console.error('[API Users] Error:', error);
    
    // Handle SQLite constraint errors
    if (error instanceof Error && 'code' in error && error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      const errorResponse: ErrorResponse = {
        error: 'Cet email ou identifiant est déjà utilisé',
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const errorResponse: ErrorResponse = {
      error: 'Failed to create user',
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
