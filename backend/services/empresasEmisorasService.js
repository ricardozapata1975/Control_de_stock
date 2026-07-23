import { getSupabase } from '../db/supabase.js';
import * as demo from './demoService.js';
import { publicEmpresaAssetUrl } from './empresaAssetService.js';

export function mapEmpresa(row) {
  if (!row) return null;
  const logoUrl = row.logo_url || row.logoUrl || publicEmpresaAssetUrl(row.logo_path || row.logoPath);
  const firmaUrl =
    row.firma_url || row.firmaUrl || publicEmpresaAssetUrl(row.firma_path || row.firmaPath);
  return {
    id: row.id,
    nombre: row.nombre,
    razonSocial: row.razon_social || row.razonSocial,
    cuit: row.cuit || '',
    ingBrutos: row.ing_brutos || row.ingBrutos || '',
    domicilio: row.domicilio || '',
    localidad: row.localidad || '',
    telefono: row.telefono || '',
    fax: row.fax || '',
    email: row.email || '',
    web: row.web || '',
    fechaInicioActividades: row.fecha_inicio_actividades || row.fechaInicioActividades || '',
    codigoDocumento: row.codigo_documento || row.codigoDocumento || '91',
    sedeCodigo: row.sede_codigo || row.sedeCodigo || '',
    notas: row.notas || '',
    logoPath: row.logo_path || row.logoPath || '',
    logoUrl: logoUrl || '',
    firmaPath: row.firma_path || row.firmaPath || '',
    firmaUrl: firmaUrl || '',
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
  const cuit = pick('cuit');
  const ingBrutos = pick('ingBrutos', 'ing_brutos');
  const domicilio = pick('domicilio');
  const localidad = pick('localidad');
  const telefono = pick('telefono');
  const fax = pick('fax');
  const email = pick('email');
  const web = pick('web');
  const fechaInicio = pick('fechaInicioActividades', 'fecha_inicio_actividades');
  const codigoDocumento = pick('codigoDocumento', 'codigo_documento');
  const sedeCodigo = pick('sedeCodigo', 'sede_codigo');
  const notas = pick('notas');
  const activo = pick('activo');

  if (nombre !== undefined) patch.nombre = String(nombre || '').trim();
  if (razonSocial !== undefined) patch.razon_social = String(razonSocial || '').trim() || null;
  if (cuit !== undefined) patch.cuit = String(cuit || '').trim() || null;
  if (ingBrutos !== undefined) patch.ing_brutos = String(ingBrutos || '').trim() || null;
  if (domicilio !== undefined) patch.domicilio = String(domicilio || '').trim() || null;
  if (localidad !== undefined) patch.localidad = String(localidad || '').trim() || null;
  if (telefono !== undefined) patch.telefono = String(telefono || '').trim() || null;
  if (fax !== undefined) patch.fax = String(fax || '').trim() || null;
  if (email !== undefined) patch.email = String(email || '').trim() || null;
  if (web !== undefined) patch.web = String(web || '').trim() || null;
  if (fechaInicio !== undefined) {
    const v = String(fechaInicio || '').trim();
    patch.fecha_inicio_actividades = v || null;
  }
  if (codigoDocumento !== undefined) {
    patch.codigo_documento = String(codigoDocumento || '91').trim() || '91';
  }
  if (sedeCodigo !== undefined) {
    patch.sede_codigo = String(sedeCodigo || '').trim().toUpperCase() || null;
  }
  if (notas !== undefined) patch.notas = String(notas || '').trim() || null;
  if (activo !== undefined) patch.activo = !!activo;

  if (!partial) {
    if (!patch.nombre) {
      throw Object.assign(new Error('Nombre de la oficina/empresa requerido'), { status: 400 });
    }
    if (!patch.razon_social) patch.razon_social = patch.nombre;
  } else if (patch.nombre !== undefined && !patch.nombre) {
    throw Object.assign(new Error('Nombre de la oficina/empresa requerido'), { status: 400 });
  }

  return patch;
}

export async function listEmpresasEmisoras({ includeInactive = false } = {}) {
  if (demo.isDemoMode()) return demo.demoListEmpresasEmisoras({ includeInactive });

  const supabase = getSupabase();
  let query = supabase.from('empresas_emisoras').select('*').order('nombre');
  if (!includeInactive) query = query.eq('activo', true);

  const { data, error } = await query;
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return (data || []).map(mapEmpresa);
}

export async function getEmpresaEmisoraById(id) {
  if (demo.isDemoMode()) return demo.demoGetEmpresaEmisoraById(id);

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('empresas_emisoras')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return data ? mapEmpresa(data) : null;
}

export async function createEmpresaEmisora(body) {
  if (demo.isDemoMode()) return demo.demoCreateEmpresaEmisora(body);

  const patch = payloadFromBody(body, { partial: false });
  if (patch.activo === undefined) patch.activo = true;

  const supabase = getSupabase();
  const { data, error } = await supabase.from('empresas_emisoras').insert(patch).select('*').single();
  if (error) throw Object.assign(new Error(error.message), { status: 400 });
  return mapEmpresa(data);
}

export async function updateEmpresaEmisora(id, body) {
  if (!id) throw Object.assign(new Error('id requerido'), { status: 400 });
  if (demo.isDemoMode()) return demo.demoUpdateEmpresaEmisora(id, body);

  const patch = payloadFromBody(body, { partial: true });
  if (!Object.keys(patch).length) {
    throw Object.assign(new Error('No hay campos para actualizar'), { status: 400 });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('empresas_emisoras')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) throw Object.assign(new Error(error.message), { status: 400 });
  if (!data) throw Object.assign(new Error('Empresa no encontrada'), { status: 404 });
  return mapEmpresa(data);
}

export async function getNextRemitoNumero(empresaEmisoraId) {
  if (demo.isDemoMode()) return demo.demoGetNextRemitoNumero(empresaEmisoraId);

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('remitos')
    .select('numero')
    .eq('empresa_emisora_id', empresaEmisoraId)
    .order('numero', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  return (data?.numero || 0) + 1;
}
