import { config } from '../config.js';
import { sign, verifyToken } from './jwtService.js';
import * as userService from './userService.js';
import { resolveSedeInfo } from './sedeScope.js';

export { sign, verifyToken };

/** Login unificado: username + password + sucursal de trabajo */
export async function loginUser(username, password, sede) {
  if (!String(sede || '').trim()) {
    throw Object.assign(new Error('Elegí la sucursal donde vas a trabajar'), { status: 400 });
  }

  const result = await userService.authenticateUser(username, password, { sede });
  if (!result) return null;

  if (result.requiresPasswordSetup || result.requiresPasswordChange) {
    return result;
  }

  return {
    user: result.user,
    token: result.token,
  };
}

/** Compatibilidad: admin env (solo si no hay tabla users en demo) */
export function loginAdminLegacy(username, password, sede) {
  const user = String(username || '').trim().toLowerCase();
  const pass = String(password || '');
  if (user !== config.admin.username.toLowerCase() || pass !== config.admin.password) {
    return null;
  }
  const sedeInfo = resolveSedeInfo(sede || 'SED001');
  const profile = {
    id: 'admin',
    name: config.admin.displayName,
    username: config.admin.username,
    role: 'admin',
    mustChangePassword: false,
    sede: sedeInfo.codigo,
    sedeNombre: sedeInfo.nombre,
  };
  return { user: profile, token: sign(profile) };
}
