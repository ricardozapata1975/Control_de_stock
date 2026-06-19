import { getSupabase } from '../db/supabase.js';
import * as demo from './demoService.js';
import { config } from '../config.js';
import {
  ALMACEN_DEFAULT,
  buildCodigo,
  codigoLookupVariants,
  getArmarioNombre,
  getContenedorHelpText,
  listAlmacenes,
  listArmarios,
  mapUbicacionFields,
  normalizeAlmacen,
  normalizeArmario,
  normalizeContenedor,
  normalizeEstante,
  parseCodigo,
} from './ubicacionUtils.js';

function isDemoMode() {
  return config.demoMode;
}

export function getCatalogoUbicacion() {
  const estantes = Array.from({ length: 9 }, (_, i) => {
    const code = `E${String(i + 1).padStart(2, '0')}`;
    return { codigo: code, nombre: `Estante ${i + 1}` };
  });
  return {
    almacenes: listAlmacenes(),
    armarios: listArmarios(),
    estantes,
    contenedorOpcional: true,
    contenedorValidos: getContenedorHelpText(),
    almacenDefault: ALMACEN_DEFAULT,
  };
}

async function findContenedorByParsed(supabase, parsed) {
  const variants = codigoLookupVariants(parsed);
  for (const codigo of variants) {
    const { data, error } = await supabase
      .from('contenedores')
      .select('*')
      .eq('codigo', codigo)
      .maybeSingle();
    if (error) throw Object.assign(new Error(error.message), { status: 500 });
    if (data) return data;
  }
  return null;
}

export async function resolveUbicacion({ almacen, armario, estante, contenedor, codigo }) {
  if (isDemoMode()) {
    return demo.demoResolveUbicacion({ almacen, armario, estante, contenedor, codigo });
  }

  const supabase = getSupabase();
  let parsed = codigo ? parseCodigo(codigo) : null;
  if (!parsed && armario && estante) {
    const alm = almacen ? normalizeAlmacen(almacen) : ALMACEN_DEFAULT;
    parsed = {
      almacen: alm,
      armario: normalizeArmario(armario),
      estante: normalizeEstante(estante),
      contenedor: normalizeContenedor(contenedor),
      codigo: almacen
        ? buildCodigo(alm, armario, estante, contenedor)
        : buildCodigo(armario, estante, contenedor),
    };
  }
  if (!parsed) {
    throw Object.assign(new Error('Ubicación inválida'), { status: 400 });
  }

  const existing = await findContenedorByParsed(supabase, parsed);
  if (existing) return existing;

  const alm = parsed.almacen || ALMACEN_DEFAULT;
  const row = {
    codigo: parsed.codigo,
    almacen: alm,
    armario: parsed.armario,
    estante: parsed.estante,
    contenedor: parsed.contenedor,
    ubicacion: getArmarioNombre(parsed.armario),
  };

  const { data: created, error: insErr } = await supabase.from('contenedores').insert(row).select('*').single();
  if (insErr) throw Object.assign(new Error(insErr.message), { status: 500 });
  return created;
}

export function enrichContenedor(cont) {
  if (!cont) return cont;
  const extra = mapUbicacionFields(cont);
  return { ...cont, ...extra };
}
