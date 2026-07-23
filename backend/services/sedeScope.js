import {
  canonicalSedeCode,
  listAlmacenes,
  listSedes,
  SEDE_DEFAULT,
} from './ubicacionUtils.js';

/**
 * Valida y resuelve una sede del catálogo.
 * @returns {{ codigo: string, nombre: string }}
 */
export function resolveSedeInfo(sedeCodigo) {
  const code = canonicalSedeCode(sedeCodigo || SEDE_DEFAULT) || SEDE_DEFAULT;
  const found = listSedes().find((s) => s.codigo === code);
  if (!found) {
    throw Object.assign(
      new Error(`Sucursal inválida: ${sedeCodigo || ''}. Elegí una sucursal del listado.`),
      { status: 400 }
    );
  }
  return { codigo: found.codigo, nombre: found.nombre || found.codigo };
}

export function almacenesCodigosDeSede(sedeCodigo) {
  const code = canonicalSedeCode(sedeCodigo || SEDE_DEFAULT) || SEDE_DEFAULT;
  return listAlmacenes(code).map((a) => a.codigo);
}

/** Extrae sede de query/body/usuario de sesión (prioridad: explícito → sesión). */
export function pickSedeFilter({ querySede, bodySede, sessionSede } = {}) {
  const raw = querySede || bodySede || sessionSede || '';
  if (!raw) return null;
  try {
    return resolveSedeInfo(raw).codigo;
  } catch {
    return null;
  }
}
