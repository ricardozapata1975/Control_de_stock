import { verifyToken } from '../services/jwtService.js';
import { getSessionUser, normalizeRole } from '../services/userService.js';

function extractToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

async function attachSessionUser(req, res) {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Se requiere iniciar sesión' });
    return null;
  }

  const payload = verifyToken(token);
  if (!payload?.id) {
    res.status(401).json({ error: 'Sesión inválida o expirada' });
    return null;
  }

  const sessionUser = await getSessionUser(payload.id);
  if (!sessionUser) {
    res.status(401).json({ error: 'Sesión inválida o cuenta desactivada' });
    return null;
  }

  req.user = {
    id: sessionUser.id,
    username: sessionUser.username,
    name: sessionUser.name,
    role: normalizeRole(sessionUser.role),
    mustChangePassword: sessionUser.mustChangePassword,
    isActive: sessionUser.isActive,
    sedeDefault: sessionUser.sedeDefault || null,
    // Sucursal de trabajo de esta sesión (elige en login / cambio de sede)
    sede: payload.sede || sessionUser.sedeDefault || null,
    sedeNombre: payload.sedeNombre || null,
  };
  return req.user;
}

export async function requireAuth(req, res, next) {
  const user = await attachSessionUser(req, res);
  if (!user) return;
  next();
}

export async function requireAdmin(req, res, next) {
  const user = await attachSessionUser(req, res);
  if (!user) return;
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso solo para administrador' });
  }
  req.admin = user;
  next();
}

/** Adjunta usuario si hay token válido; no bloquea si no hay sesión. */
export async function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return next();

  const payload = verifyToken(token);
  if (!payload?.id) return next();

  try {
    const sessionUser = await getSessionUser(payload.id);
    if (!sessionUser) return next();
    req.user = {
      id: sessionUser.id,
      username: sessionUser.username,
      name: sessionUser.name,
      role: normalizeRole(sessionUser.role),
      mustChangePassword: sessionUser.mustChangePassword,
      isActive: sessionUser.isActive,
      sedeDefault: sessionUser.sedeDefault || null,
      sede: payload.sede || sessionUser.sedeDefault || null,
      sedeNombre: payload.sedeNombre || null,
    };
  } catch {
    /* ignore */
  }
  next();
}
