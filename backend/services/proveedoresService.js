import { getSupabase } from '../db/supabase.js';
import * as demo from './demoService.js';

function mapProveedor(row) {
  if (!row) return null;
  return {
    id: row.id,
    nombre: row.nombre,
    razonSocial: row.razon_social || row.razonSocial || '',
    iva: row.iva || '',
    domicilio: row.domicilio || '',
    localidad: row.localidad || '',
    vRef: row.v_ref || row.vRef || '',
    cuit: row.cuit || '',
    rubro: row.rubro || '',
    contacto: row.contacto || '',
    telefono: row.telefono || '',
    email: row.email || '',
    web: row.web || '',
    notas: row.notas || '',
    activo: row.activo !== false,
  };
}

function payloadFromBody(body, { partial = false } = {}) {
  const src = body || {};
  const pick = (camel, snake) => {
    if (src[camel] !== undefined) return src[camel];
    if (src[snake] !== undefined) return src[snake];
    return undefined;
  };

  const patch = {};
  const nombre = pick('nombre');
  const razonSocial = pick('razonSocial', 'razon_social');
  const iva = pick('iva');
  const domicilio = pick('domicilio');
  const localidad = pick('localidad');
  const vRef = pick('vRef', 'v_ref');
  const cuit = pick('cuit');
  const rubro = pick('rubro');
  const telefono = pick('telefono');
  const email = pick('email');
  const contacto = pick('contacto');
  const web = pick('web', 'pagina');
  const notas = pick('notas');
  const activo = pick('activo');

  if (nombre !== undefined) patch.nombre = String(nombre || '').trim();
  if (razonSocial !== undefined) patch.razon_social = String(razonSocial || '').trim() || null;
  if (iva !== undefined) patch.iva = String(iva || '').trim() || null;
  if (domicilio !== undefined) patch.domicilio = String(domicilio || '').trim() || null;
  if (localidad !== undefined) patch.localidad = String(localidad || '').trim() || null;
  if (vRef !== undefined) patch.v_ref = String(vRef || '').trim() || null;
  if (cuit !== undefined) patch.cuit = String(cuit || '').trim() || null;
  if (rubro !== undefined) patch.rubro = String(rubro || '').trim() || null;
  if (telefono !== undefined) patch.telefono = String(telefono || '').trim() || null;
  if (email !== undefined) patch.email = String(email || '').trim() || null;
  if (contacto !== undefined) patch.contacto = String(contacto || '').trim() || null;
  if (web !== undefined) patch.web = String(web || '').trim() || null;
  if (notas !== undefined) patch.notas = String(notas || '').trim() || null;
  if (activo !== undefined) patch.activo = !!activo;

  if (!partial) {
    if (!patch.nombre) {
      throw Object.assign(new Error('Nombre del proveedor requerido'), { status: 400 });
    }
    if (!patch.razon_social) patch.razon_social = patch.nombre;
  } else if (patch.nombre !== undefined && !patch.nombre) {
    throw Object.assign(new Error('Nombre del proveedor requerido'), { status: 400 });
  }

  return patch;
}

function isMissingTableError(error) {
  if (!error) return false;
  const msg = String(error.message || '');
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /does not exist/i.test(msg) ||
    /could not find the table/i.test(msg) ||
    /schema cache/i.test(msg)
  );
}

export async function searchProveedores(q = '', { includeInactive = false, limit = 20 } = {}) {
  if (demo.isDemoMode()) return demo.demoSearchProveedores(q, { includeInactive, limit });

  const supabase = getSupabase();
  let query = supabase
    .from('proveedores')
    .select('*')
    .order('nombre')
    .limit(Math.min(Number(limit) || 20, 500));

  if (!includeInactive) {
    query = query.or('activo.is.null,activo.eq.true');
  }

  const term = String(q || '').trim();
  if (term) {
    query = query.or(
      `nombre.ilike.%${term}%,razon_social.ilike.%${term}%,cuit.ilike.%${term}%,localidad.ilike.%${term}%,rubro.ilike.%${term}%,contacto.ilike.%${term}%,email.ilike.%${term}%`
    );
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingTableError(error)) {
      throw Object.assign(
        new Error('Ejecutá supabase/patch-proveedores.sql en Supabase para habilitar proveedores'),
        { status: 503 }
      );
    }
    throw Object.assign(new Error(error.message), { status: 500 });
  }
  return (data || []).map(mapProveedor);
}

export async function listProveedoresAgenda(q = '') {
  return searchProveedores(q, { includeInactive: true, limit: 500 });
}

export async function createProveedor(payload) {
  if (demo.isDemoMode()) return demo.demoCreateProveedor(payload);

  const patch = payloadFromBody(payload, { partial: false });
  if (patch.activo === undefined) patch.activo = true;
  patch.updated_at = new Date().toISOString();

  const supabase = getSupabase();
  const { data, error } = await supabase.from('proveedores').insert(patch).select('*').single();
  if (error) {
    if (isMissingTableError(error)) {
      throw Object.assign(
        new Error('Ejecutá supabase/patch-proveedores.sql en Supabase para habilitar proveedores'),
        { status: 503 }
      );
    }
    throw Object.assign(new Error(error.message), { status: 400 });
  }
  return mapProveedor(data);
}

export async function updateProveedor(id, payload) {
  if (!id) throw Object.assign(new Error('id requerido'), { status: 400 });
  if (demo.isDemoMode()) return demo.demoUpdateProveedor(id, payload);

  const patch = payloadFromBody(payload, { partial: true });
  if (!Object.keys(patch).length) {
    throw Object.assign(new Error('No hay campos para actualizar'), { status: 400 });
  }
  patch.updated_at = new Date().toISOString();

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('proveedores')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) {
    if (isMissingTableError(error)) {
      throw Object.assign(
        new Error('Ejecutá supabase/patch-proveedores.sql en Supabase para habilitar proveedores'),
        { status: 503 }
      );
    }
    throw Object.assign(new Error(error.message), { status: 400 });
  }
  if (!data) throw Object.assign(new Error('Proveedor no encontrado'), { status: 404 });
  return mapProveedor(data);
}

export async function deactivateProveedor(id) {
  if (!id) throw Object.assign(new Error('id requerido'), { status: 400 });
  if (demo.isDemoMode()) return demo.demoUpdateProveedor(id, { activo: false });

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('proveedores')
    .update({ activo: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) {
    if (isMissingTableError(error)) {
      throw Object.assign(
        new Error('Ejecutá supabase/patch-proveedores.sql en Supabase para habilitar proveedores'),
        { status: 503 }
      );
    }
    throw Object.assign(new Error(error.message), { status: 400 });
  }
  if (!data) throw Object.assign(new Error('Proveedor no encontrado'), { status: 404 });
  return mapProveedor(data);
}
