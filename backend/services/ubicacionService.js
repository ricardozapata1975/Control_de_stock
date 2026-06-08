import { getSupabase } from '../db/supabase.js';
import * as demo from './demoService.js';
import { config } from '../config.js';
import {
  buildCodigo,
  getArmarioNombre,
  getContenedorHelpText,
  listArmarios,
  mapUbicacionFields,
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
    armarios: listArmarios(),
    estantes,
    contenedorOpcional: true,
    contenedorValidos: getContenedorHelpText(),
  };
}

export async function resolveUbicacion({ armario, estante, contenedor, codigo }) {
  if (isDemoMode()) return demo.demoResolveUbicacion({ armario, estante, contenedor, codigo });

  const supabase = getSupabase();
  let parsed = codigo ? parseCodigo(codigo) : null;
  if (!parsed && armario && estante) {
    parsed = {
      armario: normalizeArmario(armario),
      estante: normalizeEstante(estante),
      contenedor: normalizeContenedor(contenedor),
      codigo: buildCodigo(armario, estante, contenedor),
    };
  }
  if (!parsed) {
    throw Object.assign(new Error('Ubicación inválida'), { status: 400 });
  }

  const { data: existing, error: selErr } = await supabase
    .from('contenedores')
    .select('*')
    .eq('codigo', parsed.codigo)
    .maybeSingle();
  if (selErr) throw Object.assign(new Error(selErr.message), { status: 500 });
  if (existing) return existing;

  const row = {
    codigo: parsed.codigo,
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
