import { getSupabase } from '../db/supabase.js';
import * as demo from './demoService.js';

function mapCliente(row) {
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
    telefono: row.telefono || '',
    email: row.email || '',
    contacto: row.contacto || '',
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
  const telefono = pick('telefono');
  const email = pick('email');
  const contacto = pick('contacto');
  const notas = pick('notas');
  const activo = pick('activo');

  if (nombre !== undefined) patch.nombre = String(nombre || '').trim();
  if (razonSocial !== undefined) patch.razon_social = String(razonSocial || '').trim() || null;
  if (iva !== undefined) patch.iva = String(iva || '').trim() || null;
  if (domicilio !== undefined) patch.domicilio = String(domicilio || '').trim() || null;
  if (localidad !== undefined) patch.localidad = String(localidad || '').trim() || null;
  if (vRef !== undefined) patch.v_ref = String(vRef || '').trim() || null;
  if (cuit !== undefined) patch.cuit = String(cuit || '').trim() || null;
  if (telefono !== undefined) patch.telefono = String(telefono || '').trim() || null;
  if (email !== undefined) patch.email = String(email || '').trim() || null;
  if (contacto !== undefined) patch.contacto = String(contacto || '').trim() || null;
  if (notas !== undefined) patch.notas = String(notas || '').trim() || null;
  if (activo !== undefined) patch.activo = !!activo;

  if (!partial) {
    if (!patch.nombre) {
      throw Object.assign(new Error('Nombre del cliente requerido'), { status: 400 });
    }
    if (!patch.razon_social) patch.razon_social = patch.nombre;
  } else if (patch.nombre !== undefined && !patch.nombre) {
    throw Object.assign(new Error('Nombre del cliente requerido'), { status: 400 });
  }

  return patch;
}

export async function searchClientes(q = '', { includeInactive = false, limit = 20 } = {}) {
  if (demo.isDemoMode()) return demo.demoSearchClientes(q, { includeInactive, limit });

  const supabase = getSupabase();
  let query = supabase
    .from('clientes')
    .select('*')
    .order('nombre')
    .limit(Math.min(Number(limit) || 20, 500));

  if (!includeInactive) {
    // Tolerar columnas sin activo (antes del patch)
    query = query.or('activo.is.null,activo.eq.true');
  }

  const term = String(q || '').trim();
  if (term) {
    query = query.or(
      `nombre.ilike.%${term}%,razon_social.ilike.%${term}%,cuit.ilike.%${term}%,localidad.ilike.%${term}%`
    );
  }

  const { data, error } = await query;
  if (error) {
    // Fallback si faltan columnas nuevas
    if (/telefono|email|contacto|notas|activo|column/i.test(error.message || '')) {
      let fallback = supabase.from('clientes').select('*').order('nombre').limit(Math.min(Number(limit) || 20, 500));
      if (term) fallback = fallback.ilike('nombre', `%${term}%`);
      const { data: data2, error: e2 } = await fallback;
      if (e2) throw Object.assign(new Error(e2.message), { status: 500 });
      return (data2 || []).map(mapCliente);
    }
    throw Object.assign(new Error(error.message), { status: 500 });
  }
  return (data || []).map(mapCliente);
}

export async function listClientesAgenda(q = '') {
  return searchClientes(q, { includeInactive: true, limit: 500 });
}

export async function getClienteById(id) {
  if (demo.isDemoMode()) return demo.demoGetClienteById(id);

  const supabase = getSupabase();
  const { data, error } = await supabase.from('clientes').select('*').eq('id', id).maybeSingle();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return data ? mapCliente(data) : null;
}

export async function createCliente(payload) {
  if (demo.isDemoMode()) return demo.demoCreateCliente(payload);

  const patch = payloadFromBody(payload, { partial: false });
  if (patch.activo === undefined) patch.activo = true;

  const supabase = getSupabase();
  const { data, error } = await supabase.from('clientes').insert(patch).select('*').single();
  if (error) {
    // Reintentar sin columnas nuevas si el patch no se ejecutó
    if (/telefono|email|contacto|notas|activo|column/i.test(error.message || '')) {
      const minimal = {
        nombre: patch.nombre,
        razon_social: patch.razon_social,
        iva: patch.iva,
        domicilio: patch.domicilio,
        localidad: patch.localidad,
        v_ref: patch.v_ref,
        cuit: patch.cuit,
      };
      const { data: data2, error: e2 } = await supabase
        .from('clientes')
        .insert(minimal)
        .select('*')
        .single();
      if (e2) throw Object.assign(new Error(e2.message), { status: 400 });
      return mapCliente(data2);
    }
    throw Object.assign(new Error(error.message), { status: 400 });
  }
  return mapCliente(data);
}

export async function updateCliente(id, payload) {
  if (!id) throw Object.assign(new Error('id requerido'), { status: 400 });
  if (demo.isDemoMode()) return demo.demoUpdateCliente(id, payload);

  const patch = payloadFromBody(payload, { partial: true });
  if (!Object.keys(patch).length) {
    throw Object.assign(new Error('No hay campos para actualizar'), { status: 400 });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('clientes')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) throw Object.assign(new Error(error.message), { status: 400 });
  if (!data) throw Object.assign(new Error('Cliente no encontrado'), { status: 404 });
  return mapCliente(data);
}

export async function deactivateCliente(id) {
  if (!id) throw Object.assign(new Error('id requerido'), { status: 400 });
  if (demo.isDemoMode()) return demo.demoUpdateCliente(id, { activo: false });

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('clientes')
    .update({ activo: false })
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) {
    if (/activo|column/i.test(error.message || '')) {
      throw Object.assign(
        new Error('Ejecutá supabase/patch-agenda.sql para poder desactivar clientes'),
        { status: 503 }
      );
    }
    throw Object.assign(new Error(error.message), { status: 400 });
  }
  if (!data) throw Object.assign(new Error('Cliente no encontrado'), { status: 404 });
  return mapCliente(data);
}
