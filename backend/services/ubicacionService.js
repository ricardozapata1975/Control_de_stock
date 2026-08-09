import { getSupabase } from '../db/supabase.js';
import * as demo from './demoService.js';
import { config } from '../config.js';
import {
  ALMACEN_DEFAULT,
  buildCodigoCompleto,
  getArmarioNombre,
  getContenedorHelpText,
  listAlmacenes,
  listArmarios,
  listArmariosPorAlmacen,
  listSedes,
  getAduanaUbicacion,
  getSedeForAlmacen,
  mapUbicacionFields,
  normalizeAlmacen,
  normalizeArmario,
  normalizeContenedor,
  normalizeEstante,
  normalizeSede,
  parseCodigo,
  buildCodigo,
  codigoLookupVariants,
  contenedorMatchesParsed,
  formatArmarioCode,
} from './ubicacionUtils.js';

function isDemoMode() {
  return config.demoMode;
}

export function getCatalogoUbicacion(almacenFilter, sedeFilter) {
  const estantes = Array.from({ length: 100 }, (_, i) => {
    const code = `E${String(i).padStart(2, '0')}`;
    return { codigo: code, nombre: i === 0 ? 'Estante / gaveta 0' : `Estante / gaveta ${i}` };
  });
  const armariosPorAlmacen = listArmariosPorAlmacen();
  const sedes = listSedes();
  const aduanasPorSede = Object.fromEntries(
    sedes.filter((s) => s.aduana).map((s) => [s.codigo, { ...s.aduana, sedeNombre: s.nombre }])
  );
  const proyectosAlmacenesPorSede = Object.fromEntries(
    sedes.map((s) => [
      s.codigo,
      {
        reservados: s.reservados || null,
        produccion: s.produccion || null,
      },
    ])
  );
  const almacenes = listAlmacenes(sedeFilter || undefined);
  return {
    sedes,
    aduanasPorSede,
    proyectosAlmacenesPorSede,
    almacenes,
    armarios: almacenFilter ? listArmarios(almacenFilter) : [],
    armariosPorAlmacen,
    estantes,
    contenedorOpcional: true,
    contenedorValidos: getContenedorHelpText(),
    almacenDefault: ALMACEN_DEFAULT,
    sedeFilter: sedeFilter || null,
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
    if (data && contenedorMatchesParsed(data, parsed)) return data;
  }
  return null;
}

export async function resolveUbicacion({
  sede,
  almacen,
  armario,
  estante,
  contenedor,
  codigo,
  skipArmarioCheck = false,
}) {
  if (isDemoMode()) {
    return demo.demoResolveUbicacion({ sede, almacen, armario, estante, contenedor, codigo });
  }

  const supabase = getSupabase();
  let parsed = codigo ? parseCodigo(codigo) : null;
  if (!parsed && armario && estante) {
    if (!almacen) {
      throw Object.assign(new Error('Almacén obligatorio para resolver ubicación'), { status: 400 });
    }
    const alm = normalizeAlmacen(almacen);
    const sed = normalizeSede(sede || getSedeForAlmacen(alm));
    const arm = skipArmarioCheck ? formatArmarioCode(armario) : normalizeArmario(armario, alm);
    parsed = {
      sede: sed,
      almacen: alm,
      armario: arm,
      estante: normalizeEstante(estante),
      contenedor: normalizeContenedor(contenedor),
      codigo: buildCodigoCompleto({
        sede: sed,
        almacen: alm,
        armario: arm,
        estante,
        contenedor,
        skipArmarioCheck: true,
      }),
    };
  }
  if (!parsed) {
    throw Object.assign(new Error('Ubicación inválida'), { status: 400 });
  }

  const existing = await findContenedorByParsed(supabase, parsed);
  if (existing) return existing;

  const alm = parsed.almacen || ALMACEN_DEFAULT;
  const sed = parsed.sede || normalizeSede(sede || getSedeForAlmacen(alm));
  const row = {
    codigo: parsed.codigo?.includes('-')
      ? parsed.codigo
      : buildCodigoCompleto({
          sede: sed,
          almacen: alm,
          armario: parsed.armario,
          estante: parsed.estante,
          contenedor: parsed.contenedor,
          skipArmarioCheck: true,
        }),
    sede: sed,
    almacen: alm,
    armario: parsed.armario,
    estante: parsed.estante,
    contenedor: parsed.contenedor,
    ubicacion: getArmarioNombre(parsed.armario, alm) || parsed.armario,
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
