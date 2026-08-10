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

/** Stock “disponible general”: excluye aduana, reservados, producción y pañol. */
export function almacenesGeneralesCodigosDeSede(sedeCodigo) {
  const code = canonicalSedeCode(sedeCodigo || SEDE_DEFAULT) || SEDE_DEFAULT;
  return listAlmacenes(code)
    .filter((a) => !a.esAduana && !a.esReservados && !a.esProduccion && !a.esHerramientas)
    .map((a) => a.codigo);
}

export function getProyectosAlmacenesSede(sedeCodigo) {
  const code = canonicalSedeCode(sedeCodigo || SEDE_DEFAULT) || SEDE_DEFAULT;
  const list = listAlmacenes(code);
  const reservados = list.find((a) => a.esReservados)?.codigo || null;
  const produccion = list.find((a) => a.esProduccion)?.codigo || null;
  return { reservados, produccion };
}

export function getHerramientasAlmacenSede(sedeCodigo) {
  const code = canonicalSedeCode(sedeCodigo || SEDE_DEFAULT) || SEDE_DEFAULT;
  const list = listAlmacenes(code);
  return list.find((a) => a.esHerramientas)?.codigo || null;
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
