import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';
import { getSupabase } from '../db/supabase.js';
import {
  APP_PERMISSIONS,
  defaultRolesSeed,
  normalizePermMap,
  allPermMap,
} from '../permissions/catalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEMO_ROLES_PATH = path.join(__dirname, '../data/demo-roles.json');

function mapRole(row) {
  if (!row) return null;
  return {
    codigo: row.codigo,
    nombre: row.nombre,
    descripcion: row.descripcion || '',
    esSistema: Boolean(row.es_sistema),
    permisos: normalizePermMap(row.permisos),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

async function loadDemoRoles() {
  try {
    const raw = await fs.readFile(DEMO_ROLES_PATH, 'utf-8');
    const data = JSON.parse(raw);
    return Array.isArray(data.roles) ? data.roles : [];
  } catch {
    return [];
  }
}

async function saveDemoRoles(roles) {
  await fs.mkdir(path.dirname(DEMO_ROLES_PATH), { recursive: true });
  await fs.writeFile(DEMO_ROLES_PATH, JSON.stringify({ roles }, null, 2));
}

async function seedDemoIfEmpty() {
  let roles = await loadDemoRoles();
  if (roles.length) return roles;
  roles = defaultRolesSeed().map((r) => ({
    ...r,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));
  await saveDemoRoles(roles);
  return roles;
}

async function ensureDbSeeded(supabase) {
  const { data, error } = await supabase.from('app_roles').select('codigo').limit(1);
  if (error) {
    if (/app_roles|schema cache|does not exist/i.test(error.message || '')) {
      throw Object.assign(
        new Error(
          'Ejecutá supabase/patch-app-roles.sql en Supabase para habilitar roles del sitio'
        ),
        { status: 503 }
      );
    }
    throw Object.assign(new Error(error.message), { status: 500 });
  }
  if ((data || []).length) return;
  const seed = defaultRolesSeed();
  const { error: ei } = await supabase.from('app_roles').upsert(
    seed.map((r) => ({
      codigo: r.codigo,
      nombre: r.nombre,
      descripcion: r.descripcion,
      es_sistema: r.es_sistema,
      permisos: r.permisos,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: 'codigo' }
  );
  if (ei) throw Object.assign(new Error(ei.message), { status: 500 });
}

export function getPermissionsCatalog() {
  return { permissions: APP_PERMISSIONS };
}

export async function listRoles() {
  if (config.demoMode) {
    const roles = await seedDemoIfEmpty();
    return roles.map(mapRole).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }
  const supabase = getSupabase();
  await ensureDbSeeded(supabase);
  const { data, error } = await supabase.from('app_roles').select('*').order('nombre');
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return (data || []).map(mapRole);
}

export async function getRole(codigo) {
  const code = String(codigo || '')
    .trim()
    .toLowerCase();
  if (!code) return null;
  if (config.demoMode) {
    const roles = await seedDemoIfEmpty();
    return mapRole(roles.find((r) => r.codigo === code));
  }
  const supabase = getSupabase();
  await ensureDbSeeded(supabase);
  const { data, error } = await supabase.from('app_roles').select('*').eq('codigo', code).maybeSingle();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return mapRole(data);
}

/** Lista de ids de permiso activos para un código de rol */
export async function getPermissionIdsForRole(codigo) {
  const code = String(codigo || '')
    .trim()
    .toLowerCase();
  if (code === 'admin' || code === 'administrador') {
    return ['*'];
  }
  const role = await getRole(code);
  if (!role) {
    // Rol desconocido: tratar como operario si existe
    const op = await getRole('operario');
    if (!op) return [];
    return Object.entries(op.permisos)
      .filter(([, v]) => v)
      .map(([k]) => k);
  }
  if (role.codigo === 'admin') return ['*'];
  return Object.entries(role.permisos)
    .filter(([, v]) => v)
    .map(([k]) => k);
}

export function roleHasPermission(permissionIds, permId) {
  if (!permId) return true;
  if (!permissionIds?.length) return false;
  if (permissionIds.includes('*')) return true;
  return permissionIds.includes(permId);
}

export async function createRole({ codigo, nombre, descripcion, permisos }) {
  const code = String(codigo || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_');
  const name = String(nombre || '').trim();
  if (!code || code.length < 2) {
    throw Object.assign(new Error('Código de rol inválido (mín. 2 caracteres)'), { status: 400 });
  }
  if (!name) throw Object.assign(new Error('Nombre requerido'), { status: 400 });
  if (code === 'admin') {
    throw Object.assign(new Error('No se puede recrear el rol admin'), { status: 409 });
  }

  const row = {
    codigo: code,
    nombre: name,
    descripcion: String(descripcion || '').trim(),
    es_sistema: false,
    permisos: normalizePermMap(permisos),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (config.demoMode) {
    const roles = await seedDemoIfEmpty();
    if (roles.some((r) => r.codigo === code)) {
      throw Object.assign(new Error('Ya existe un rol con ese código'), { status: 409 });
    }
    roles.push(row);
    await saveDemoRoles(roles);
    return mapRole(row);
  }

  const supabase = getSupabase();
  await ensureDbSeeded(supabase);
  const { data, error } = await supabase
    .from('app_roles')
    .insert({
      codigo: row.codigo,
      nombre: row.nombre,
      descripcion: row.descripcion,
      es_sistema: false,
      permisos: row.permisos,
    })
    .select('*')
    .single();
  if (error) {
    if (/duplicate|unique/i.test(error.message || '')) {
      throw Object.assign(new Error('Ya existe un rol con ese código'), { status: 409 });
    }
    throw Object.assign(new Error(error.message), { status: 500 });
  }
  return mapRole(data);
}

export async function updateRole(codigo, { nombre, descripcion, permisos }) {
  const code = String(codigo || '')
    .trim()
    .toLowerCase();
  const existing = await getRole(code);
  if (!existing) throw Object.assign(new Error('Rol no encontrado'), { status: 404 });

  const patch = { updated_at: new Date().toISOString() };
  if (nombre !== undefined) {
    const name = String(nombre).trim();
    if (!name) throw Object.assign(new Error('Nombre no puede estar vacío'), { status: 400 });
    patch.nombre = name;
  }
  if (descripcion !== undefined) patch.descripcion = String(descripcion || '').trim();
  if (permisos !== undefined) {
    patch.permisos = code === 'admin' ? allPermMap() : normalizePermMap(permisos);
  }

  if (config.demoMode) {
    const roles = await seedDemoIfEmpty();
    const idx = roles.findIndex((r) => r.codigo === code);
    if (idx < 0) throw Object.assign(new Error('Rol no encontrado'), { status: 404 });
    roles[idx] = {
      ...roles[idx],
      nombre: patch.nombre ?? roles[idx].nombre,
      descripcion: patch.descripcion ?? roles[idx].descripcion,
      permisos: patch.permisos ?? roles[idx].permisos,
      updated_at: patch.updated_at,
    };
    await saveDemoRoles(roles);
    return mapRole(roles[idx]);
  }

  const supabase = getSupabase();
  const dbPatch = {};
  if (patch.nombre !== undefined) dbPatch.nombre = patch.nombre;
  if (patch.descripcion !== undefined) dbPatch.descripcion = patch.descripcion;
  if (patch.permisos !== undefined) dbPatch.permisos = patch.permisos;
  dbPatch.updated_at = patch.updated_at;

  const { data, error } = await supabase
    .from('app_roles')
    .update(dbPatch)
    .eq('codigo', code)
    .select('*')
    .single();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return mapRole(data);
}

export async function deleteRole(codigo) {
  const code = String(codigo || '')
    .trim()
    .toLowerCase();
  const existing = await getRole(code);
  if (!existing) throw Object.assign(new Error('Rol no encontrado'), { status: 404 });
  if (existing.esSistema || code === 'admin' || code === 'operario') {
    throw Object.assign(new Error('No se puede eliminar un rol de sistema'), { status: 409 });
  }

  // ¿Hay usuarios con este rol?
  if (config.demoMode) {
    const { demoListUsersRaw } = await import('./userService.js');
    const users = await demoListUsersRaw();
    if (users.some((u) => String(u.role || '').toLowerCase() === code)) {
      throw Object.assign(new Error('Hay usuarios con este rol; reasignalos antes de borrar'), {
        status: 409,
      });
    }
    const roles = (await seedDemoIfEmpty()).filter((r) => r.codigo !== code);
    await saveDemoRoles(roles);
    return { ok: true, codigo: code };
  }

  const supabase = getSupabase();
  const { count, error: ec } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .ilike('role', code);
  if (ec) throw Object.assign(new Error(ec.message), { status: 500 });
  if (count > 0) {
    throw Object.assign(new Error('Hay usuarios con este rol; reasignalos antes de borrar'), {
      status: 409,
    });
  }

  const { error } = await supabase.from('app_roles').delete().eq('codigo', code);
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return { ok: true, codigo: code };
}
