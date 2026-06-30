import { getSupabase } from '../db/supabase.js';
import * as demo from './demoService.js';

export function mapEmpresa(row) {
  return {
    id: row.id,
    nombre: row.nombre,
    razonSocial: row.razon_social || row.razonSocial,
    cuit: row.cuit,
    ingBrutos: row.ing_brutos || row.ingBrutos,
    domicilio: row.domicilio,
    localidad: row.localidad,
    telefono: row.telefono,
    fax: row.fax,
    email: row.email,
    web: row.web,
    fechaInicioActividades: row.fecha_inicio_actividades || row.fechaInicioActividades,
    codigoDocumento: row.codigo_documento || row.codigoDocumento || '91',
    activo: row.activo !== false,
  };
}

export async function listEmpresasEmisoras() {
  if (demo.isDemoMode()) return demo.demoListEmpresasEmisoras();

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('empresas_emisoras')
    .select('*')
    .eq('activo', true)
    .order('nombre');

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
