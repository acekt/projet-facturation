import { NextResponse } from "next/server";
import { UserRepository } from "@/lib/repositories/UserRepository";
import db from "@/lib/db";
import { cookies } from "next/headers";
import crypto from "crypto";
import { loginSchema } from "@/lib/validations";
import type {
  LoginRequest,
  SessionResponse,
  ErrorResponse,
  DbUser,
} from "@/lib/types/api";
import { logAudit } from "@/lib/api/audit";
import bcrypt from "bcryptjs";

/**
 * Assure la présence et la longueur minimale d'une variable d'environnement critique.
 */
function getRequiredEnv(varName: string, minLength: number = 16): string {
  const value = process.env[varName];
  if (!value || value.length < minLength) {
    throw new Error(
      `[SECURITY] Environment variable '${varName}' is missing or too short (minimum ${minLength} characters).`,
    );
  }
  return value;
}

function hashPassword(password: string): string {
  const salt = getRequiredEnv("PASSWORD_SALT", 16);
  return crypto
    .createHash("sha256")
    .update(password + salt)
    .digest("hex");
}

async function signSession(data: string): Promise<string> {
  const secret = getRequiredEnv("SESSION_SECRET", 32);
  const key = await crypto.webcrypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.webcrypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data),
  );

  const base64Signature = btoa(
    String.fromCharCode(...new Uint8Array(signature)),
  );
  return `${data}.${base64Signature}`;
}

/**
 * Helper asynchrone pour les logs d'audit non-bloquants
 */
const logAuditAsync = (
  action: string,
  entityType: string,
  entityId: string | null,
  details: string,
  userId: string | null,
  userName?: string | null,
) => {
  setTimeout(() => {
    try {
      logAudit(action, entityType, entityId, details, userId, userName);
    } catch (e) {
      console.error("[Audit Log Error]", e);
    }
  }, 0);
};

export async function POST(request: Request) {
  try {
    try {
      getRequiredEnv("PASSWORD_SALT", 16);
      getRequiredEnv("SESSION_SECRET", 32);
    } catch (configError) {
      logAuditAsync(
        "LOGIN_ERROR",
        "system",
        null,
        "Configuration serveur invalide (variables environnement manquantes)",
        null,
      );
      return NextResponse.json(
        {
          error: "Configuration serveur invalide. Contactez l'administrateur.",
        } as ErrorResponse,
        { status: 503 },
      );
    }

    const body: unknown = await request.json();
    const validation = loginSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Données de connexion invalides",
          details: { fieldErrors: validation.error.flatten().fieldErrors },
        } as ErrorResponse,
        { status: 400 },
      );
    }

    const { username, password }: LoginRequest = validation.data;
    const cleanUsername = username.toLowerCase().trim();

    const user = db
      .prepare(
        `
      SELECT id, name, email, username, password, role, is_active, force_password_change, created_at, last_login_at, phone
      FROM users
      WHERE (LOWER(username) = ? OR LOWER(email) = ?) AND deletedAt IS NULL
    `,
      )
      .get(cleanUsername, cleanUsername) as DbUser | undefined;

    if (!user) {
      logAuditAsync(
        "LOGIN_FAILED",
        "user",
        null,
        "Tentative de connexion échouée avec: " + cleanUsername,
        null,
      );
      return NextResponse.json(
        { error: "Identifiants invalides" } as ErrorResponse,
        { status: 401 },
      );
    }

    let isPasswordValid = false;
    try {
      isPasswordValid = await bcrypt.compare(password, user.password);
    } catch (e) {
      isPasswordValid = false;
    }

    // Fallback legacy SHA-256
    if (!isPasswordValid && user.password) {
      const legacyHash = hashPassword(password);
      isPasswordValid = user.password === legacyHash;

      // Seamlessly upgrade to bcrypt
      if (isPasswordValid) {
        try {
          const newBcryptHash = await bcrypt.hash(password, 10);
          db.prepare("UPDATE users SET password = ? WHERE id = ?").run(
            newBcryptHash,
            user.id,
          );
        } catch (upgradeError) {
          console.error(
            "[Login] Failed to seamlessly upgrade password hash to bcrypt:",
            upgradeError,
          );
        }
      }
    }

    if (!isPasswordValid) {
      logAuditAsync(
        "LOGIN_FAILED",
        "user",
        user.id,
        "Tentative de connexion échouée (mauvais mot de passe) pour: " +
          cleanUsername,
        user.id,
        user.name,
      );
      return NextResponse.json(
        { error: "Identifiants invalides" } as ErrorResponse,
        { status: 401 },
      );
    }

    if (user.is_active === 0) {
      return NextResponse.json(
        {
          error: "Compte inactif. Veuillez contacter votre administrateur.",
        } as ErrorResponse,
        { status: 403 },
      );
    }

    try {
      UserRepository.updateLastLogin(user.id);
    } catch (e) {
      console.error("[Login] Failed to update last_login_at:", e);
    }

    const sessionData = JSON.stringify({
      userId: user.id,
      name: user.name,
      role: user.role,
      exp: Date.now() + 24 * 60 * 60 * 1000,
    });

    const base64Data = Buffer.from(sessionData).toString("base64");
    const signedSession = await signSession(base64Data);

    const sessionPayload: SessionResponse = {
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        is_active: user.is_active,
        created_at: user.created_at,
        last_login_at: user.last_login_at,
        phone: user.phone,
      },
    };

    logAuditAsync(
      "LOGIN_SUCCESS",
      "user",
      user.id,
      "Connexion réussie",
      user.id,
      user.name,
    );

    const response = NextResponse.json(sessionPayload);

    // Cookie NextResponse
    response.cookies.set("auth_session", signedSession, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    });

    // Cookie next/headers for RSC context
    try {
      (await cookies()).set("auth_session", signedSession, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24,
        path: "/",
      });
    } catch (e) {
      // Ignore outside request scope
    }

    return response;
  } catch (error) {
    console.error("[Login] Error:", error);
    logAuditAsync(
      "LOGIN_ERROR",
      "system",
      null,
      "Erreur serveur lors de la connexion",
      null,
    );
    return NextResponse.json({ error: "Erreur serveur" } as ErrorResponse, {
      status: 500,
    });
  }
}
