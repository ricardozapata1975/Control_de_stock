import crypto from 'crypto';
import { config } from '../config.js';

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function sign(payload) {
  const body = {
    ...payload,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const data = Buffer.from(JSON.stringify(body)).toString('base64url');
  const sig = crypto.createHmac('sha256', config.jwtSecret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyToken(token) {
  if (!token || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', config.jwtSecret).update(data).digest('base64url');
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function loginAdmin(username, password) {
  const user = String(username || '').trim().toLowerCase();
  const pass = String(password || '');
  if (user !== config.admin.username.toLowerCase() || pass !== config.admin.password) {
    return null;
  }
  const profile = {
    id: 'admin',
    name: config.admin.displayName,
    username: config.admin.username,
    role: 'admin',
  };
  return { user: profile, token: sign(profile) };
}

export function loginOperario(nombre) {
  const name = String(nombre || '').trim();
  if (!name) return null;
  return {
    user: {
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name,
      role: 'operario',
    },
  };
}
