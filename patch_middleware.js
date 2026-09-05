const fs = require('fs');
let code = fs.readFileSync('middleware.ts', 'utf8');

// Replace public route logic
code = code.replace(
  /\/\/ Gestion des routes publiques[\s\S]*?(?=\/\/ Redirection si non authentifié)/,
  `// Gestion des routes publiques
  if (isPublicRoute) {
    if (sessionCookie && !isSessionValid) {
      const response = NextResponse.next()
      response.cookies.delete('auth_session')
      return response
    }
    // Redirection si déjà authentifié
    if (isSessionValid) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return NextResponse.next()
  }

  `
);

// Replace strict RBAC matching and early return for unauthorized users
code = code.replace(
  /if \(role !== 'admin'\) {[\s\S]*?(?=\}\n\n  return NextResponse\.next\(\))/m,
  `if (role !== 'admin') {
      if (isAdminOnlyRoute) {
         return NextResponse.redirect(new URL('/?error=user_restricted', request.url))
      }
      if (isAdminOnlyApi) {
        return new NextResponse(JSON.stringify({ error: 'Accès réservé aux administrateurs' }), {
          status: 403,
          headers: { 'content-type': 'application/json' },
        })
      }
    }`
);

fs.writeFileSync('middleware.ts', code);
