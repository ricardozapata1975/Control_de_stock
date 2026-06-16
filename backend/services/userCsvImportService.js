import {
  createUser,
  listUsers,
  normalizeUsernamePublic,
  updateUser,
  updateUserRowPublic,
} from './userService.js';

const MS_HEADERS = {
  display_name: ['display name', 'display_name', 'nombre para mostrar'],
  upn: ['user principal name', 'user_principal_name', 'upn'],
  first_name: ['first name', 'first_name', 'nombre'],
  last_name: ['last name', 'last_name', 'apellido'],
  block_credential: ['block credential', 'block_credential'],
  proxy_addresses: ['proxy addresses', 'proxy_addresses'],
};

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function normalizeHeader(h) {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function mapHeaders(headers) {
  const mapped = {};
  headers.forEach((raw, idx) => {
    const key = normalizeHeader(raw);
    for (const [field, aliases] of Object.entries(MS_HEADERS)) {
      if (aliases.includes(key) || key === field.replace(/_/g, ' ')) {
        mapped[field] = idx;
      }
    }
  });
  return mapped;
}

function extractSmtpEmail(proxyAddresses) {
  const raw = String(proxyAddresses || '');
  const parts = raw.split('+');
  for (const part of parts) {
    const m = part.match(/^smtp:(.+)$/i);
    if (m) return m[1].trim().toLowerCase();
  }
  return null;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function usernameFromUpn(upn) {
  const raw = String(upn || '').trim();
  if (!raw) return null;

  if (raw.includes('#EXT#')) {
    const extMatch = raw.match(/^(.+?)_(.+?)#EXT#/i);
    if (extMatch) {
      const local = extMatch[1];
      const domain = extMatch[2].replace(/\./g, '.');
      if (domain.includes('.')) return local.toLowerCase();
    }
    return null;
  }

  if (raw.includes('@')) {
    return raw.split('@')[0].toLowerCase();
  }

  return normalizeUsernamePublic(raw);
}

export function parseMicrosoftUsersCsv(text) {
  const raw = String(text || '').replace(/^\uFEFF/, '').trim();
  if (!raw) throw Object.assign(new Error('El archivo CSV está vacío'), { status: 400 });

  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    throw Object.assign(new Error('El CSV debe tener encabezado y al menos una fila'), { status: 400 });
  }

  const headers = parseCsvLine(lines[0]);
  const col = mapHeaders(headers);
  if (col.upn === undefined && col.display_name === undefined) {
    throw Object.assign(
      new Error('No se reconoce el formato. Se esperan columnas de exportación Microsoft Admin (User principal name, Display name).'),
      { status: 400 }
    );
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.every((v) => !v)) continue;

    const get = (field) => {
      const idx = col[field];
      return idx === undefined ? '' : values[idx] ?? '';
    };

    const upn = get('upn');
    const displayName =
      get('display_name').trim() ||
      [get('first_name'), get('last_name')].filter(Boolean).join(' ').trim();
    const blocked = String(get('block_credential')).toLowerCase() === 'true';
    const proxyEmail = extractSmtpEmail(get('proxy_addresses'));

    let email = isValidEmail(upn) ? upn.trim().toLowerCase() : proxyEmail;
    let username = usernameFromUpn(upn);

    if (!username && email) {
      username = email.split('@')[0].toLowerCase();
    }

    rows.push({
      linea: i + 1,
      username: username ? normalizeUsernamePublic(username) : null,
      displayName: displayName || username || '',
      email,
      upn,
      blocked,
    });
  }

  if (!rows.length) throw Object.assign(new Error('No hay filas de datos'), { status: 400 });
  return rows;
}

async function resolveRowAction(row, existingByUsername) {
  if (row.blocked) {
    return { ...row, action: 'skip', reason: 'Cuenta bloqueada en Microsoft' };
  }
  if (!row.username || row.username.length < 3) {
    return { ...row, action: 'error', reason: 'No se pudo derivar un usuario válido (mín. 3 caracteres)' };
  }
  if (!row.displayName) {
    return { ...row, action: 'error', reason: 'Falta nombre para mostrar' };
  }

  const existing = existingByUsername.get(row.username);
  if (existing) {
    return { ...row, action: 'update', existingId: existing.id, reason: 'Usuario ya existe' };
  }
  return { ...row, action: 'create', reason: 'Nuevo usuario' };
}

export async function previewUsersCsv(csvText) {
  const parsed = parseMicrosoftUsersCsv(csvText);
  const users = await listUsers();
  const existingByUsername = new Map(users.map((u) => [u.username, u]));

  const filas = [];
  for (const row of parsed) {
    filas.push(await resolveRowAction(row, existingByUsername));
  }

  return {
    total: filas.length,
    crear: filas.filter((f) => f.action === 'create').length,
    actualizar: filas.filter((f) => f.action === 'update').length,
    omitir: filas.filter((f) => f.action === 'skip').length,
    errores: filas.filter((f) => f.action === 'error').length,
    filas,
  };
}

export async function importUsersCsv(csvText, { modoDuplicados = 'skip' } = {}) {
  const preview = await previewUsersCsv(csvText);
  const resultado = {
    ok: 0,
    creados: 0,
    actualizados: 0,
    omitidos: 0,
    errores: [],
    filas: preview.total,
    modoDuplicados,
  };

  for (const row of preview.filas) {
    try {
      if (row.action === 'error' || row.action === 'skip') {
        if (row.action === 'skip') resultado.omitidos++;
        else resultado.errores.push({ linea: row.linea, error: row.reason });
        continue;
      }

      if (row.action === 'update') {
        if (modoDuplicados === 'skip') {
          resultado.omitidos++;
          continue;
        }
        await updateUser(row.existingId, { displayName: row.displayName });
        if (row.email) {
          await updateUserRowPublic(row.existingId, { email: row.email });
        }
        resultado.actualizados++;
        resultado.ok++;
        continue;
      }

      const created = await createUser({
        username: row.username,
        displayName: row.displayName,
        role: 'operario',
      });
      if (row.email) {
        await updateUserRowPublic(created.id, { email: row.email });
      }
      resultado.creados++;
      resultado.ok++;
    } catch (e) {
      resultado.errores.push({ linea: row.linea, error: e.message });
    }
  }

  return resultado;
}

export function getUsersImportSpec() {
  return {
    formato: 'CSV UTF-8 exportado desde Microsoft 365 Admin Center (admin.cloud.microsoft).',
    columnas: [
      { nombre: 'Display name', obligatorio: false, descripcion: 'Nombre para mostrar' },
      { nombre: 'User principal name', obligatorio: true, descripcion: 'UPN / correo principal' },
      { nombre: 'First name / Last name', obligatorio: false, descripcion: 'Alternativa al display name' },
      { nombre: 'Block credential', obligatorio: false, descripcion: 'True = se omite la fila' },
      { nombre: 'Proxy addresses', obligatorio: false, descripcion: 'Se usa SMTP: para email en cuentas externas' },
    ],
    modosDuplicados: {
      skip: 'Si el usuario ya existe, no hacer nada',
      update: 'Actualizar nombre y email de usuarios existentes',
    },
    notas: [
      'Los usuarios se crean como operario, sin contraseña inicial (primer ingreso).',
      'El nombre de usuario se deriva del UPN (parte antes de @).',
    ],
  };
}
