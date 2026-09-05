const fs = require('fs');
let code = fs.readFileSync('app/api/auth/login/route.ts', 'utf8');

// Replace fallback legacy SHA-256 and bcrypt upgrade logic
code = code.replace(
  /\/\/ Fallback legacy SHA-256[\s\S]*?(?=\/\/ OPTIONAL: Update to bcrypt here seamlessly if successful|\n    if \(!isPasswordValid\))/,
  `// Fallback legacy SHA-256
    if (!isPasswordValid && user.password) {
      const legacyHash = hashPassword(password);
      isPasswordValid = user.password === legacyHash;

      // Seamlessly upgrade to bcrypt
      if (isPasswordValid) {
        try {
          const newBcryptHash = await bcrypt.hash(password, 10);
          db.prepare('UPDATE users SET password = ? WHERE id = ?').run(newBcryptHash, user.id);
        } catch (upgradeError) {
          console.error('[Login] Failed to seamlessly upgrade password hash to bcrypt:', upgradeError);
        }
      }
    }`
);

// Specifically replace the optional comment logic if it matches
code = code.replace(
  /\/\/ Fallback legacy SHA-256[\s\S]*?if \(!isPasswordValid\)/,
  `// Fallback legacy SHA-256
    if (!isPasswordValid && user.password) {
      const legacyHash = hashPassword(password);
      isPasswordValid = user.password === legacyHash;

      // Seamlessly upgrade to bcrypt
      if (isPasswordValid) {
        try {
          const newBcryptHash = await bcrypt.hash(password, 10);
          db.prepare('UPDATE users SET password = ? WHERE id = ?').run(newBcryptHash, user.id);
        } catch (upgradeError) {
          console.error('[Login] Failed to seamlessly upgrade password hash to bcrypt:', upgradeError);
        }
      }
    }

    if (!isPasswordValid)`
);

fs.writeFileSync('app/api/auth/login/route.ts', code);
