import { verifyToken } from '../services/authService.js';

export function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Se requiere sesión de administrador' });
  }
  const payload = verifyToken(token);
  if (!payload || payload.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso solo para administrador' });
  }
  req.admin = payload;
  next();
}
