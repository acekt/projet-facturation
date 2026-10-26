import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Appel obligatoire à getUser() pour rafraîchir et initialiser la session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  const isPublicAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname === "/forbidden" ||
    pathname === "/unauthorized";

  // 1. Redirection si non authentifié et sur route protégée
  if (!user) {
    if (!isPublicAuthRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // Si déjà connecté et tente d'aller sur /login, on redirige vers /
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // 2. Vérification stricte du rôle Super Admin (Hook JWT en priorité, repli sur profiles)
  let userRole = (user.app_metadata?.user_role as string | undefined)?.toLowerCase();

  if (!userRole) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .single();

    if (!profile || profile.is_active === false) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set(
        "message",
        "Compte inactif ou profil introuvable."
      );
      return NextResponse.redirect(url);
    }

    userRole = profile.role?.toLowerCase();
  }

  const allowedSuperadminEmails = (process.env.SUPERADMIN_EMAILS || "admin@facturier.cloud")
    .split(",")
    .map((e) => e.trim().toLowerCase());

  const isSuperadmin =
    userRole === "superadmin" || 
    userRole === "super_admin" ||
    Boolean(user.email && allowedSuperadminEmails.includes(user.email.toLowerCase()));

  if (!isSuperadmin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set(
      "message",
      "Accès refusé : cet espace est strictement réservé aux Super Administrateurs."
    );
    return NextResponse.redirect(url);
  }

  // 3. Vérification MFA (TOTP Assurance Level)
  // Ne pas bloquer la navigation vers les pages de validation/enrôlement MFA
  if (!pathname.startsWith("/mfa")) {
    const { data: aalData } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (
      aalData &&
      aalData.nextLevel === "aal2" &&
      aalData.currentLevel !== "aal2"
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/mfa/verify";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
