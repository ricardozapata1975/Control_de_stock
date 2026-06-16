import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';
import { getSupabase } from '../db/supabase.js';
import { sign, verifyToken } from './jwtService.js';
import { isEmailConfigured, sendPasswordResetEmail, sendWelcomeEmail } from './emailService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEMO_USERS_PATH = path.join(__dirname, '../data/demo-users.json');
const BCRYPT_ROUNDS = 12;
const SETUP_TTL_MS = 15 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

export function normalizeUsernamePublic(username) {
  return normalizeUsername(username);
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
  const { data, error } = await supabase
    .from('users')
    .update({ ...patch, updated_at: now })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return data;
}

function buildAuthProfile(row) {
  return {
    id: row.id,
    username: row.username,
    name: row.display_name,
    role: row.role,
    mustChangePassword: !!row.must_change_password,
  };
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

export async function authenticateUser(username, password) {
  const row = await findByUsername(username);
  if (!row || row.is_active === false) return null;

  if (!row.password_hash) {
    return {
      requiresPasswordSetup: true,
      setupToken: signSetupToken(row.id),
      user: mapUserPublic(row),
    };
  }

  const pass = String(password || '');
  if (!pass) return null;
  const ok = await verifyPassword(pass, row.password_hash);
  if (!ok) return null;

  const profile = buildAuthProfile(row);
  await updateUserRow(row.id, { last_login_at: new Date().toISOString() });

  if (row.must_change_password) {
    return {
      requiresPasswordChange: true,
      user: mapUserPublic({ ...row, last_login_at: new Date().toISOString() }),
      token: sign(profile),
    };
  }

  return {
    user: mapUserPublic({ ...row, last_login_at: new Date().toISOString() }),
    token: sign(profile),
  };
}

export async function setUserPassword({ setupToken, token, newPassword }) {
  validatePassword(newPassword);

  let userId = null;
  if (setupToken) {
    userId = verifySetupToken(setupToken);
  } else if (token) {
    const payload = verifyToken(token);
    if (!payload?.id) throw Object.assign(new Error('Sesión inválida'), { status: 401 });
    userId = payload.id;
  }
  if (!userId) throw Object.assign(new Error('Token inválido o expirado'), { status: 401 });

  const row = await findById(userId);
  if (!row || row.is_active === false) {
    throw Object.assign(new Error('Usuario no encontrado'), { status: 404 });
  }

  const password_hash = await hashPassword(newPassword);
  const updated = await updateUserRow(userId, {
    password_hash,
    must_change_password: false,
    last_login_at: new Date().toISOString(),
  });

  const profile = buildAuthProfile(updated);
  return {
    user: mapUserPublic(updated),
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

export async function createUser({ username, displayName, role, email }) {
  const u = normalizeUsername(username);
  const name = String(displayName || '').trim();
  const r = role === 'admin' ? 'admin' : 'operario';

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
  const { data, error } = await supabase.from('users').insert(row).select('*').single();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return mapUserAdmin(data);
}

export async function updateUser(id, { displayName, role, isActive }) {
  const row = await findById(id);
  if (!row) throw Object.assign(new Error('Usuario no encontrado'), { status: 404 });

  const patch = {};
  if (displayName !== undefined) {
    const name = String(displayName).trim();
    if (!name) throw Object.assign(new Error('El nombre no puede estar vacío'), { status: 400 });
    patch.display_name = name;
  }
  if (role !== undefined) patch.role = role === 'admin' ? 'admin' : 'operario';
  if (isActive !== undefined) patch.is_active = !!isActive;

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
