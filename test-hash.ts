import crypto from 'crypto';
const bcrypt = require('bcryptjs');

const salt = 'facturier-gabon-2026';
const p = 'operator123';
const operatorHash = crypto.createHash('sha256').update(p + salt).digest('hex');
console.log('SHA:', operatorHash);
console.log('bcrypt:', bcrypt.hashSync(p, 10));
