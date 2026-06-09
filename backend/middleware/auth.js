import { verifyToken } from '../services/jwtService.js';

function extractToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

export function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Se requiere iniciar sesión' });
  }
  const payload = verifyToken(token);
  if (!payload?.id || !payload?.role) {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
  req.user = payload;
  next();
}

export function requireAdmin(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Se requiere sesión de administrador' });
  }
  const payload = verifyToken(token);
  if (!payload || payload.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso solo para administrador' });
  }
  req.admin = payload;
  req.user = payload;
  next();
}
