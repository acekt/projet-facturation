# Diagnostic : Résolution de l'Erreur 500 dans le build standalone Electron

## 1. Audit de la Base de données (Lecture/Écriture)
- **Le chemin vers AppData (`ELECTRON_USERDATA_PATH`)** : C'est correct, `main.js` transmettait déjà `ELECTRON_USERDATA_PATH: USER_DATA_PATH` (qui résout vers `app.getPath('userData')`) à Next.js dans l'objet d'environnement `env`.
- **Mécanisme de fallback (`lib/db.ts`)** : Le code Next.js de la base de données récupère bien `process.env.ELECTRON_USERDATA_PATH`, et construit la base SQLite de façon sécurisée en lecture/écriture dans le sous-dossier `data` de `userData`. S'il n'existe pas, SQLite créera automatiquement le fichier.
- **Requêtes directes** : L'application utilise `better-sqlite3` et effectue des requêtes SQL paramétrées directement. Aucune migration initiale via un script de "copie de la base initiale" (seed file) n'est nécessaire car `lib/db.ts` contient la création des tables et des migrations `IF NOT EXISTS` intégrées.
- **Diagnostic :** La base de données n'est pas le blocage ici, la persistance dans `userData` est déjà configurée.

## 2. Audit de l'Environnement de Production (Variables d'environnement)
- L'objet `env` de `spawn` envoyait `PORT` et `NODE_ENV`, **mais manquait `SESSION_SECRET`**.
- L'API d'authentification (`lib/api/auth.ts`) bloque brutalement en cas d'absence de la variable d'environnement `SESSION_SECRET` par une erreur fatale (`throw new Error('[SECURITY] SESSION_SECRET environment variable is missing')`).
- **Correction apportée** : `SESSION_SECRET` est désormais généré à la volée via `crypto.randomBytes(32).toString('hex')` (si non fourni explicitement) et injecté de façon robuste dans le `main.js` à l'initialisation du `spawn()`.
- L'application n'utilise ni NextAuth ni base d'authentification externe qui requiert `NEXTAUTH_URL`.

## 3. Audit de l'ORM (Prisma / Drizzle)
- L'application utilise l'interface native **`better-sqlite3`** (ex: `db.prepare().all()`), et n'utilise pas Prisma ni Drizzle.
- Il n'y a donc pas de `query-engine.node` ou de dossier `.prisma/client` capricieux avec le mode `standalone`.
- **Action requise :** Aucune action spécifique post-build sur l'ORM n'est requise. `better-sqlite3` est explicitement déclaré dans `serverExternalPackages` de `next.config.mjs`, ce qui est suffisant pour le bundle standalone.

## 4. Traçabilité absolue de l'Erreur 500
- L'erreur 500 persistante était complètement masquée dans l'invite de commande car le serveur Next.js en production dans `main.js` avait son paramètre `stdio` réglé sur `'ignore'`, noyant toutes les erreurs et stack traces fatales.
- **Correction apportée** : Le paramètre a été changé de `'ignore'` vers `'pipe'`, et des hooks `nextProcess.stdout.on('data')` et `nextProcess.stderr.on('data')` ont été mis en place pour recracher les exceptions Next.js directement dans la console ou les fichiers de log Electron.

## Corrections dans \`main.js\`
Les lignes suivantes ont été modifiées dans `startNextServer` :
\`\`\`javascript
  const crypto = require('crypto');
  const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

  nextProcess = spawn(process.execPath, [STANDALONE_SERVER], {
    env: {
      ...process.env,
      ELECTRON_USERDATA_PATH: USER_DATA_PATH,
      PORT: String(port),
      NODE_ENV: 'production',
      NEXT_TELEMETRY_DISABLED: '1',
      SESSION_SECRET: sessionSecret, // <- INJECTION DU SECRET ABSENT
    },
    stdio: 'pipe',  // <- CAPTURE DE LA CONSOLE (était 'ignore')
  });

  nextProcess.stdout.on('data', (data) => console.log(`[Next.js]: ${data.toString()}`));
  nextProcess.stderr.on('data', (data) => console.error(`[Next.js ERROR]: ${data.toString()}`));
\`\`\`
