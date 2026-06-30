import { getSupabase } from '../db/supabase.js';
import * as demo from './demoService.js';

function mapCliente(row) {
  return {
    id: row.id,
    nombre: row.nombre,
    razonSocial: row.razon_social || row.razonSocial,
    iva: row.iva,
    domicilio: row.domicilio,
    localidad: row.localidad,
    vRef: row.v_ref || row.vRef,
    cuit: row.cuit,
  };
}

export async function searchClientes(q = '') {
  if (demo.isDemoMode()) return demo.demoSearchClientes(q);

  const supabase = getSupabase();
  let query = supabase
    .from('clientes')
    .select('*')
    .order('nombre')
    .limit(20);

  const term = String(q || '').trim();
  if (term) {
    query = query.ilike('nombre', `%${term}%`);
  }

  const { data, error } = await query;
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return (data || []).map(mapCliente);
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

  const nombre = String(payload?.nombre || '').trim();
  if (!nombre) {
    throw Object.assign(new Error('Nombre del cliente requerido'), { status: 400 });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('clientes')
    .insert({
      nombre,
      razon_social: payload.razonSocial || payload.razon_social || nombre,
      iva: payload.iva || null,
      domicilio: payload.domicilio || null,
      localidad: payload.localidad || null,
      v_ref: payload.vRef || payload.v_ref || null,
      cuit: payload.cuit || null,
    })
    .select('*')
    .single();

  if (error) throw Object.assign(new Error(error.message), { status: 400 });
  return mapCliente(data);
}
