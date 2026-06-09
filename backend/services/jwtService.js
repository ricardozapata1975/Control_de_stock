import crypto from 'crypto';
import { config } from '../config.js';

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function decodeBase64url(str) {
  return Buffer.from(str, 'base64url').toString('utf8');
}

export function sign(payload) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Date.now();
  const body = {
    ...payload,
    iat: now,
    exp: payload.exp ?? now + DEFAULT_TTL_MS,
  };
  const encoded = base64url(JSON.stringify(body));
  const sig = crypto
    .createHmac('sha256', config.jwtSecret)
    .update(`${header}.${encoded}`)
    .digest('base64url');
  return `${header}.${encoded}.${sig}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, encoded, sig] = parts;
  const expected = crypto
    .createHmac('sha256', config.jwtSecret)
    .update(`${header}.${encoded}`)
    .digest('base64url');
  if (sig !== expected) return null;

  try {
    const payload = JSON.parse(decodeBase64url(encoded));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
