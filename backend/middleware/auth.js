import { verifyToken } from '../services/jwtService.js';
import { getSessionUser, isAdminRole, normalizeRole } from '../services/userService.js';

function extractToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

function hasAnyPermission(user, permIds) {
  if (!user) return false;
  if (isAdminRole(user.role)) return true;
  const perms = user.permissions || [];
  if (perms.includes('*')) return true;
  return permIds.some((id) => perms.includes(id));
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
    permissions: sessionUser.permissions || [],
    mustChangePassword: sessionUser.mustChangePassword,
    isActive: sessionUser.isActive,
    sedeDefault: sessionUser.sedeDefault || null,
    sedesHabilitadas: sessionUser.sedesHabilitadas || [],
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
  if (!isAdminRole(user.role) && !user.permissions?.includes('*')) {
    return res.status(403).json({ error: 'Acceso solo para administrador' });
  }
  req.admin = user;
  next();
}

/** Requiere al menos uno de los permisos (admin siempre pasa). */
export function requirePermission(...permIds) {
  return async (req, res, next) => {
    const user = await attachSessionUser(req, res);
    if (!user) return;
    if (!hasAnyPermission(user, permIds)) {
      return res.status(403).json({ error: 'No tenés permiso para esta acción' });
    }
    next();
  };
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
      permissions: sessionUser.permissions || [],
      mustChangePassword: sessionUser.mustChangePassword,
      isActive: sessionUser.isActive,
      sedeDefault: sessionUser.sedeDefault || null,
      sedesHabilitadas: sessionUser.sedesHabilitadas || [],
      sede: payload.sede || sessionUser.sedeDefault || null,
      sedeNombre: payload.sedeNombre || null,
    };
  } catch {
    /* ignore */
  }
  next();
}
