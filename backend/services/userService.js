import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';
import { getSupabase } from '../db/supabase.js';
import { sign, verifyToken } from './jwtService.js';
import { isEmailConfigured, sendPasswordResetEmail, sendWelcomeEmail } from './emailService.js';
import { resolveSedeInfo } from './sedeScope.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEMO_USERS_PATH = path.join(__dirname, '../data/demo-users.json');
const BCRYPT_ROUNDS = 12;
const SETUP_TTL_MS = 15 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

export function normalizeUsernamePublic(username) {
  return normalizeUsername(username);
}

/** Código de rol: 'admin' | 'operario' | custom (tolera "Administrador"). */
export function normalizeRole(role) {
  const value = String(role || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (!value) return 'operario';
  if (value === 'administrador') return 'admin';
  return value.replace(/[^a-z0-9_]/g, '_') || 'operario';
}

export function isAdminRole(role) {
  return normalizeRole(role) === 'admin';
}

/** Perfil actual desde DB; null si no existe o está inactivo. */
export async function getSessionUser(userId) {
  const row = await findById(userId);
  if (!row || row.is_active === false) return null;
  const profile = mapUserPublic(row);
  const role = normalizeRole(profile.role);
  let permissions = [];
  try {
    const { getPermissionIdsForRole } = await import('./rolesService.js');
    permissions = await getPermissionIdsForRole(role);
  } catch {
    permissions = isAdminRole(role) ? ['*'] : [];
  }
  return { ...profile, role, permissions };
}

function normalizeUsername(username) {
  return String(username || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function validatePassword(password) {
  const p = String(password || '');
  if (p.length < 6) {
    throw Object.assign(new Error('La contraseña debe tener al menos 6 caracteres'), { status: 400 });
  }
}

/** Normaliza lista de códigos de sede desde DB (array, JSON o CSV). */
export function parseSedesHabilitadas(raw) {
  if (Array.isArray(raw)) {
    return [...new Set(raw.map((s) => String(s || '').trim().toUpperCase()).filter(Boolean))];
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parseSedesHabilitadas(parsed);
    } catch {
      /* CSV */
    }
    return [
      ...new Set(
        trimmed
          .split(/[,;\s]+/)
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean)
      ),
    ];
  }
  return [];
}

/** Sedes a las que el usuario puede ingresar (admin = null = todas). */
export function getAllowedSedesForUser(row) {
  if (!row) return [];
  if (isAdminRole(row.role)) return null;
  const list = parseSedesHabilitadas(row.sedes_habilitadas);
  if (list.length) return list;
  const fallback = String(row.sede_default || '').trim().toUpperCase();
  return fallback ? [fallback] : [];
}

function assertSedePermitida(row, sedeCodigo) {
  const code = String(sedeCodigo || '').trim().toUpperCase();
  if (!code) {
    throw Object.assign(new Error('Sucursal requerida'), { status: 400 });
  }
  const allowed = getAllowedSedesForUser(row);
  if (allowed === null) return code;
  if (!allowed.includes(code)) {
    throw Object.assign(
      new Error(
        allowed.length
          ? `No tenés acceso a la sucursal ${code}. Habilitadas: ${allowed.join(', ')}`
          : 'No tenés sucursales habilitadas. Pedile al administrador que te asigne una.'
      ),
      { status: 403 }
    );
  }
  return code;
}

export function mapUserPublic(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    name: row.display_name,
    displayName: row.display_name,
    email: row.email || null,
    role: row.role,
    isActive: row.is_active !== false,
    mustChangePassword: !!row.must_change_password,
    hasPassword: !!row.password_hash,
    lastLoginAt: row.last_login_at || null,
    createdAt: row.created_at || null,
    sedeDefault: row.sede_default || null,
    sedesHabilitadas: parseSedesHabilitadas(row.sedes_habilitadas),
  };
}

function mapUserAdmin(row) {
  return {
    ...mapUserPublic(row),
    updatedAt: row.updated_at || null,
  };
}

async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function verifyPassword(password, hash) {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

function signSetupToken(userId) {
  return sign({
    purpose: 'password_setup',
    userId,
    exp: Date.now() + SETUP_TTL_MS,
  });
}

function verifySetupToken(token) {
  const payload = verifyToken(token);
  if (!payload || payload.purpose !== 'password_setup' || !payload.userId) return null;
  return payload.userId;
}

function newId() {
  return crypto.randomUUID();
}

async function loadDemoUsers() {
  try {
    const raw = await fs.readFile(DEMO_USERS_PATH, 'utf-8');
    const data = JSON.parse(raw);
    return Array.isArray(data.users) ? data.users : [];
  } catch {
    return [];
  }
}

async function saveDemoUsers(users) {
  await fs.mkdir(path.dirname(DEMO_USERS_PATH), { recursive: true });
  await fs.writeFile(DEMO_USERS_PATH, JSON.stringify({ users }, null, 2));
}

async function seedDemoUsersIfEmpty(users) {
  if (users.length) return users;
  const adminHash = await hashPassword(config.admin.password);
  const seeded = [
    {
      id: 'usr-admin',
      username: normalizeUsername(config.admin.username),
      display_name: config.admin.displayName,
      password_hash: adminHash,
      role: 'admin',
      must_change_password: false,
      is_active: true,
      last_login_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
  await saveDemoUsers(seeded);
  return seeded;
}

async function findByEmail(email) {
  const e = String(email || '')
    .trim()
    .toLowerCase();
  if (!e) return null;

  if (config.demoMode) {
    const users = await loadDemoUsers();
    return users.find((row) => String(row.email || '').toLowerCase() === e) || null;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.from('users').select('*').ilike('email', e).maybeSingle();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return data;
}

async function findByResetToken(token) {
  if (!token) return null;

  if (config.demoMode) {
    const users = await loadDemoUsers();
    return users.find((row) => row.reset_token === token) || null;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('reset_token', token)
    .maybeSingle();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return data;
}

async function findByUsername(username) {
  const u = normalizeUsername(username);
  if (!u) return null;

  if (config.demoMode) {
    let users = await loadDemoUsers();
    users = await seedDemoUsersIfEmpty(users);
    return users.find((row) => row.username === u) || null;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .ilike('username', u)
    .maybeSingle();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return data;
}

async function findById(id) {
  if (!id) return null;

  if (config.demoMode) {
    const users = await loadDemoUsers();
    return users.find((row) => row.id === id) || null;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.from('users').select('*').eq('id', id).maybeSingle();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return data;
}

export async function updateUserRowPublic(id, patch) {
  return updateUserRow(id, patch);
}

async function updateUserRow(id, patch) {
  const now = new Date().toISOString();

  if (config.demoMode) {
    const users = await loadDemoUsers();
    const idx = users.findIndex((row) => row.id === id);
    if (idx < 0) throw Object.assign(new Error('Usuario no encontrado'), { status: 404 });
    users[idx] = { ...users[idx], ...patch, updated_at: now };
    await saveDemoUsers(users);
    return users[idx];
  }

  const supabase = getSupabase();
  let payload = { ...patch, updated_at: now };
  let { data, error } = await supabase.from('users').update(payload).eq('id', id).select('*').single();

  if (
    error &&
    (payload.sede_default !== undefined || payload.sedes_habilitadas !== undefined) &&
    /sede_default|sedes_habilitadas|schema cache|column/i.test(error.message || '')
  ) {
    const { sede_default, sedes_habilitadas, ...rest } = payload;
    ({ data, error } = await supabase.from('users').update(rest).eq('id', id).select('*').single());
    if (!error && (sede_default !== undefined || sedes_habilitadas !== undefined)) {
      console.warn(
        '[Users] Columnas sede_default/sedes_habilitadas no disponibles. Ejecutá patch-users-sede.sql y patch-users-sedes-habilitadas.sql'
      );
    }
  }

  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return data;
}

function buildAuthProfile(row, sedeInfo = null, permissions = null) {
  const profile = {
    id: row.id,
    username: row.username,
    name: row.display_name,
    role: normalizeRole(row.role),
    mustChangePassword: !!row.must_change_password,
  };
  if (permissions) profile.permissions = permissions;
  if (sedeInfo) {
    profile.sede = sedeInfo.codigo;
    profile.sedeNombre = sedeInfo.nombre;
  }
  return profile;
}

async function permissionsForRow(row) {
  const role = normalizeRole(row?.role);
  try {
    const { getPermissionIdsForRole } = await import('./rolesService.js');
    return await getPermissionIdsForRole(role);
  } catch {
    return isAdminRole(role) ? ['*'] : [];
  }
}

function resolveLoginSede(requestedSede, row) {
  const allowed = getAllowedSedesForUser(row);
  let preferred = String(requestedSede || '').trim().toUpperCase();
  if (!preferred) {
    preferred =
      (allowed === null
        ? row?.sede_default
        : allowed.includes(String(row?.sede_default || '').toUpperCase())
          ? row.sede_default
          : allowed[0]) || 'SED001';
  }
  if (allowed !== null) {
    assertSedePermitida(row, preferred);
  }
  return resolveSedeInfo(preferred);
}

/** Primer ingreso: valida usuario sin contraseña y devuelve token para crearla */
export async function beginFirstLogin(username) {
  const row = await findByUsername(username);
  if (!row || row.is_active === false) {
    throw Object.assign(new Error('Usuario no encontrado o inactivo. Pedile al administrador que te cree la cuenta.'), {
      status: 404,
    });
  }
  if (row.password_hash) {
    throw Object.assign(
      new Error('Este usuario ya tiene contraseña. Ingresá con usuario y contraseña.'),
      { status: 400 }
    );
  }
  return {
    requiresPasswordSetup: true,
    setupToken: signSetupToken(row.id),
    user: mapUserPublic(row),
  };
}

export async function authenticateUser(username, password, { sede } = {}) {
  const row = await findByUsername(username);
  if (!row || row.is_active === false) return null;

  if (!row.password_hash) {
    return {
      requiresPasswordSetup: true,
      setupToken: signSetupToken(row.id),
      user: mapUserPublic(row),
      sedePending: sede || row.sede_default || null,
    };
  }

  const pass = String(password || '');
  if (!pass) return null;
  const ok = await verifyPassword(pass, row.password_hash);
  if (!ok) return null;

  const sedeInfo = resolveLoginSede(sede, row);
  const permissions = await permissionsForRow(row);
  const profile = buildAuthProfile(row, sedeInfo, permissions);
  await updateUserRow(row.id, {
    last_login_at: new Date().toISOString(),
    sede_default: sedeInfo.codigo,
  });

  if (row.must_change_password) {
    return {
      requiresPasswordChange: true,
      user: {
        ...mapUserPublic({ ...row, last_login_at: new Date().toISOString() }),
        role: normalizeRole(row.role),
        permissions,
        sede: sedeInfo.codigo,
        sedeNombre: sedeInfo.nombre,
      },
      token: sign(profile),
    };
  }

  return {
    user: {
      ...mapUserPublic({ ...row, last_login_at: new Date().toISOString(), sede_default: sedeInfo.codigo }),
      role: normalizeRole(row.role),
      permissions,
      sede: sedeInfo.codigo,
      sedeNombre: sedeInfo.nombre,
    },
    token: sign(profile),
  };
}

export async function setUserPassword({ setupToken, token, newPassword, sede }) {
  validatePassword(newPassword);

  let userId = null;
  let tokenSede = null;
  if (setupToken) {
    userId = verifySetupToken(setupToken);
  } else if (token) {
    const payload = verifyToken(token);
    if (!payload?.id) throw Object.assign(new Error('Sesión inválida'), { status: 401 });
    userId = payload.id;
    tokenSede = payload.sede || null;
  }
  if (!userId) throw Object.assign(new Error('Token inválido o expirado'), { status: 401 });

  const row = await findById(userId);
  if (!row || row.is_active === false) {
    throw Object.assign(new Error('Usuario no encontrado'), { status: 404 });
  }

  const sedeInfo = resolveLoginSede(sede || tokenSede, row);
  const password_hash = await hashPassword(newPassword);
  const updated = await updateUserRow(userId, {
    password_hash,
    must_change_password: false,
    last_login_at: new Date().toISOString(),
    sede_default: sedeInfo.codigo,
  });

  const permissions = await permissionsForRow(updated);
  const profile = buildAuthProfile(updated, sedeInfo, permissions);
  return {
    user: {
      ...mapUserPublic(updated),
      role: normalizeRole(updated.role),
      permissions,
      sede: sedeInfo.codigo,
      sedeNombre: sedeInfo.nombre,
    },
    token: sign(profile),
  };
}

/** Cambia la sucursal de trabajo de la sesión (nuevo JWT). Requiere admin o permiso. */
export async function switchUserSede(userId, sede) {
  const row = await findById(userId);
  if (!row || row.is_active === false) {
    throw Object.assign(new Error('Usuario no encontrado'), { status: 404 });
  }
  const permissions = await permissionsForRow(row);
  const canSwitch =
    isAdminRole(row.role) || permissions.includes('*') || permissions.includes('admin.cambiar_sede');
  if (!canSwitch) {
    throw Object.assign(
      new Error(
        'No tenés permiso para cambiar de sucursal. Pedile al admin el permiso o cerrá sesión e ingresá de nuevo.'
      ),
      { status: 403 }
    );
  }
  if (!isAdminRole(row.role)) {
    assertSedePermitida(row, sede);
  }
  const sedeInfo = resolveSedeInfo(sede);
  await updateUserRow(userId, { sede_default: sedeInfo.codigo });
  const profile = buildAuthProfile(row, sedeInfo, permissions);
  return {
    user: {
      ...mapUserPublic({ ...row, sede_default: sedeInfo.codigo }),
      role: normalizeRole(row.role),
      permissions,
      sede: sedeInfo.codigo,
      sedeNombre: sedeInfo.nombre,
    },
    token: sign(profile),
  };
}

export async function listUsers() {
  if (config.demoMode) {
    let users = await loadDemoUsers();
    users = await seedDemoUsersIfEmpty(users);
    return users.map(mapUserAdmin).sort((a, b) => a.username.localeCompare(b.username));
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.from('users').select('*').order('username');
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return (data || []).map(mapUserAdmin);
}

export async function requestPasswordReset({ email, username }) {
  if (!isEmailConfigured()) {
    throw Object.assign(new Error('El envío de correos no está configurado en el servidor'), {
      status: 503,
    });
  }

  const identifier = String(email || username || '').trim();
  if (!identifier) {
    throw Object.assign(new Error('Ingresá tu correo electrónico'), { status: 400 });
  }

  let row = null;
  if (identifier.includes('@')) {
    row = await findByEmail(identifier);
  } else {
    row = await findByUsername(identifier);
  }

  const generic = {
    ok: true,
    message:
      'Si existe una cuenta con ese correo, te enviamos un enlace para restablecer la contraseña.',
  };

  if (!row || row.is_active === false || !row.email) {
    return generic;
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + RESET_TTL_MS).toISOString();

  await updateUserRow(row.id, {
    reset_token: token,
    reset_token_expires: expires,
  });

  await sendPasswordResetEmail({
    to: row.email,
    username: row.display_name || row.username,
    token,
  });

  return generic;
}

export async function resetPasswordWithToken({ token, newPassword }) {
  validatePassword(newPassword);

  const row = await findByResetToken(token);
  if (!row || row.is_active === false) {
    throw Object.assign(new Error('El enlace no es válido o ya expiró'), { status: 400 });
  }

  const expires = row.reset_token_expires ? new Date(row.reset_token_expires).getTime() : 0;
  if (!expires || expires < Date.now()) {
    throw Object.assign(new Error('El enlace no es válido o ya expiró'), { status: 400 });
  }

  const password_hash = await hashPassword(newPassword);
  const updated = await updateUserRow(row.id, {
    password_hash,
    must_change_password: false,
    reset_token: null,
    reset_token_expires: null,
    last_login_at: new Date().toISOString(),
  });

  const profile = buildAuthProfile(updated);
  return {
    user: mapUserPublic(updated),
    token: sign(profile),
  };
}

export async function createUser({ username, displayName, role, email, sedesHabilitadas }) {
  const u = normalizeUsername(username);
  const name = String(displayName || '').trim();
  const r = normalizeRole(role || 'operario');

  if (!u || u.length < 3) {
    throw Object.assign(new Error('El usuario debe tener al menos 3 caracteres'), { status: 400 });
  }
  if (!name) throw Object.assign(new Error('Ingresá el nombre para mostrar'), { status: 400 });

  const existing = await findByUsername(u);
  if (existing) throw Object.assign(new Error('Ese nombre de usuario ya existe'), { status: 409 });

  const now = new Date().toISOString();
  const mail = email ? String(email).trim().toLowerCase() : null;
  if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
    throw Object.assign(new Error('El correo no es válido'), { status: 400 });
  }

  const sedes = parseSedesHabilitadas(sedesHabilitadas);
  for (const code of sedes) {
    try {
      resolveSedeInfo(code);
    } catch {
      throw Object.assign(new Error(`Sucursal inválida: ${code}`), { status: 400 });
    }
  }

  const row = {
    id: newId(),
    username: u,
    display_name: name,
    email: mail,
    password_hash: null,
    role: r,
    must_change_password: true,
    is_active: true,
    last_login_at: null,
    reset_token: null,
    reset_token_expires: null,
    sede_default: sedes[0] || 'SED001',
    sedes_habilitadas: sedes,
    created_at: now,
    updated_at: now,
  };

  if (config.demoMode) {
    const users = await loadDemoUsers();
    users.push(row);
    await saveDemoUsers(users);
    return mapUserAdmin(row);
  }

  const supabase = getSupabase();
  let { data, error } = await supabase.from('users').insert(row).select('*').single();
  if (error && /sedes_habilitadas|sede_default|schema cache|column/i.test(error.message || '')) {
    const { sedes_habilitadas, sede_default, ...rest } = row;
    ({ data, error } = await supabase.from('users').insert(rest).select('*').single());
  }
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return mapUserAdmin(data);
}

async function countActiveAdmins(excludeId = null) {
  if (config.demoMode) {
    let users = await loadDemoUsers();
    users = await seedDemoUsersIfEmpty(users);
    return users.filter(
      (row) => row.role === 'admin' && row.is_active !== false && row.id !== excludeId
    ).length;
  }

  const supabase = getSupabase();
  let query = supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'admin')
    .eq('is_active', true);
  if (excludeId) query = query.neq('id', excludeId);
  const { count, error } = await query;
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return count || 0;
}

export async function deleteUser(id, { actorId } = {}) {
  const row = await findById(id);
  if (!row) throw Object.assign(new Error('Usuario no encontrado'), { status: 404 });

  if (actorId && actorId === id) {
    throw Object.assign(new Error('No podés eliminar tu propia cuenta'), { status: 400 });
  }

  if (row.role === 'admin' && row.is_active !== false) {
    const remainingAdmins = await countActiveAdmins(id);
    if (remainingAdmins < 1) {
      throw Object.assign(new Error('No se puede eliminar el último administrador activo'), {
        status: 400,
      });
    }
  }

  if (config.demoMode) {
    const users = await loadDemoUsers();
    const next = users.filter((u) => u.id !== id);
    if (next.length === users.length) {
      throw Object.assign(new Error('Usuario no encontrado'), { status: 404 });
    }
    await saveDemoUsers(next);
    return { ok: true, id };
  }

  const supabase = getSupabase();
  const { error } = await supabase.from('users').delete().eq('id', id);
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return { ok: true, id };
}

export async function updateUser(id, { displayName, role, isActive, sedesHabilitadas }) {
  const row = await findById(id);
  if (!row) throw Object.assign(new Error('Usuario no encontrado'), { status: 404 });

  const patch = {};
  if (displayName !== undefined) {
    const name = String(displayName).trim();
    if (!name) throw Object.assign(new Error('El nombre no puede estar vacío'), { status: 400 });
    patch.display_name = name;
  }
  if (role !== undefined) {
    const nextRole = normalizeRole(role);
    const { getRole } = await import('./rolesService.js');
    const exists = await getRole(nextRole);
    if (!exists && nextRole !== 'admin' && nextRole !== 'operario') {
      throw Object.assign(new Error(`Rol desconocido: ${nextRole}`), { status: 400 });
    }
    patch.role = nextRole;
  }
  if (isActive !== undefined) patch.is_active = !!isActive;
  if (sedesHabilitadas !== undefined) {
    const list = parseSedesHabilitadas(sedesHabilitadas);
    for (const code of list) {
      try {
        resolveSedeInfo(code);
      } catch {
        throw Object.assign(new Error(`Sucursal inválida: ${code}`), { status: 400 });
      }
    }
    patch.sedes_habilitadas = list;
    const currentDefault = String(row.sede_default || '').trim().toUpperCase();
    if (list.length && !list.includes(currentDefault)) {
      patch.sede_default = list[0];
    }
  }

  const updated = await updateUserRow(id, patch);
  return mapUserAdmin(updated);
}

export async function resetUserPassword(id) {
  const row = await findById(id);
  if (!row) throw Object.assign(new Error('Usuario no encontrado'), { status: 404 });

  const updated = await updateUserRow(id, {
    password_hash: null,
    must_change_password: true,
  });
  return mapUserAdmin(updated);
}

export async function sendUserWelcome(id) {
  if (!isEmailConfigured()) {
    throw Object.assign(new Error('El envío de correos no está configurado en el servidor'), {
      status: 503,
    });
  }

  const row = await findById(id);
  if (!row) throw Object.assign(new Error('Usuario no encontrado'), { status: 404 });
  if (row.is_active === false) {
    throw Object.assign(new Error('El usuario está inactivo'), { status: 400 });
  }
  if (!row.email) {
    throw Object.assign(new Error('El usuario no tiene correo electrónico registrado'), { status: 400 });
  }

  const delivery = await sendWelcomeEmail({
    to: row.email,
    displayName: row.display_name,
    username: row.username,
  });

  const isConsole = config.email?.provider === 'console';
  const resendId = delivery?.id ? ` (ID Resend: ${delivery.id})` : '';
  return {
    ok: true,
    message: isConsole
      ? `Modo consola: no se envió correo real. Revisá los logs del backend para ${row.email}.`
      : `Invitación enviada a ${row.email}${resendId}`,
    delivery,
    user: mapUserAdmin(row),
  };
}

export async function ensureSeedAdmin() {
  if (config.demoMode) {
    await seedDemoUsersIfEmpty(await loadDemoUsers());
    return;
  }

  const supabase = getSupabase();
  const { count, error } = await supabase.from('users').select('id', { count: 'exact', head: true });
  if (error) return;
  if (count > 0) return;

  const adminHash = await hashPassword(config.admin.password);
  await supabase.from('users').insert({
    username: normalizeUsername(config.admin.username),
    display_name: config.admin.displayName,
    password_hash: adminHash,
    role: 'admin',
    must_change_password: false,
    is_active: true,
  });
}

export async function demoListUsersRaw() {
  let users = await loadDemoUsers();
  return await seedDemoUsersIfEmpty(users);
}
