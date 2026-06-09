import { config } from '../config.js';
import { sign, verifyToken } from './jwtService.js';
import * as userService from './userService.js';

export { sign, verifyToken };

/** Login unificado: username + password (password opcional si aún no tiene contraseña) */
export async function loginUser(username, password) {
  const result = await userService.authenticateUser(username, password);
  if (!result) return null;

  if (result.requiresPasswordSetup || result.requiresPasswordChange) {
    return result;
  }

  return {
    user: {
      id: result.user.id,
      username: result.user.username,
      name: result.user.name,
      role: result.user.role,
      mustChangePassword: result.user.mustChangePassword,
    },
    token: result.token,
  };
}

/** Compatibilidad: admin env (solo si no hay tabla users en demo) */
export function loginAdminLegacy(username, password) {
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
    mustChangePassword: false,
  };
  return { user: profile, token: sign(profile) };
}
