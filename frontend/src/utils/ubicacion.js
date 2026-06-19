export const ALMACEN_DEFAULT = 'ALM01';
export const ALMACEN_TIPOS = ['Almacén', 'Depósito', 'Oficina'];
export const ARMARIO_TIPOS = ['Armario', 'Estantería', 'Gabinete'];

export const ALMACENES = {
  ALM01: { tipo: 'Oficina', nombre: 'Oficina principal' },
};

export const ARMARIOS = {
  A00: 'Armario Papelería',
  A01: 'Armario Herramientas',
  A02: 'Armario Electrónica',
};

export const ESTANTES = Array.from({ length: 9 }, (_, i) => {
  const codigo = `E${String(i + 1).padStart(2, '0')}`;
  return { codigo, nombre: `Estante ${i + 1}` };
});

export function getAlmacenNombre(almacen) {
  const info = ALMACENES[String(almacen || ALMACEN_DEFAULT).toUpperCase()];
  return info?.nombre || almacen || '';
}

export function getArmarioNombre(armario, almacen, armariosPorAlmacen) {
  const ac = String(armario || '').toUpperCase();
  if (!ac) return '';
  if (almacen && armariosPorAlmacen?.[almacen]) {
    const found = armariosPorAlmacen[almacen].find((a) => a.codigo === ac);
    if (found?.nombre) return found.nombre;
  }
  return ARMARIOS[ac] || armario || '';
}

export function getArmariosForAlmacen(catalogo, almacen) {
  const alm = String(almacen || ALMACEN_DEFAULT).toUpperCase();
  if (catalogo?.armariosPorAlmacen?.[alm]?.length) {
    return catalogo.armariosPorAlmacen[alm];
  }
  if (catalogo?.armarios?.length && catalogo.armarios[0]?.almacen === alm) {
    return catalogo.armarios;
  }
  if (alm === ALMACEN_DEFAULT) {
    return Object.entries(ARMARIOS).map(([codigo, nombre]) => ({ codigo, nombre, tipo: 'armario' }));
  }
  return [];
}

export function formatUbicacionLabel(item) {
  if (!item) return '—';
  if (item.ubicacionLabel) return item.ubicacionLabel;
  const parts = [
    item.almacenNombre || getAlmacenNombre(item.almacen),
    item.armarioNombre || getArmarioNombre(item.armario, item.almacen) || item.ubicacion,
    item.estante,
    item.contenedor,
  ].filter(Boolean);
  return parts.join(' / ') || '—';
}

import { normalizeContenedorPreview } from './contenedorCodigo';

/** Vista previa: ALM01-A01-E03-C05 o A01-E03 (legacy ALM01) */
export function buildCodigoPreview(almacen, armarioOrEstante, estanteOrContenedor, contenedorMaybe) {
  let alm;
  let armario;
  let estante;
  let contenedor;

  if (/^ALM\d{2}$/i.test(String(almacen || ''))) {
    alm = String(almacen).toUpperCase();
    armario = armarioOrEstante;
    estante = estanteOrContenedor;
    contenedor = contenedorMaybe;
  } else {
    alm = ALMACEN_DEFAULT;
    armario = almacen;
    estante = armarioOrEstante;
    contenedor = estanteOrContenedor;
  }

  if (!armario || !estante) return '';
  const a = String(armario).toUpperCase();
  const eRaw = String(estante).toUpperCase();
  const eNum = eRaw.match(/E?(\d{1,2})/);
  if (!eNum) return '';
  const e = `E${String(eNum[1]).padStart(2, '0')}`;
  const c = normalizeContenedorPreview(contenedor);
  const suffix = c ? `${a}-${e}-${c}` : `${a}-${e}`;
  if (alm && alm !== ALMACEN_DEFAULT) return `${alm}-${suffix}`;
  if (alm === ALMACEN_DEFAULT && /^ALM\d{2}$/i.test(String(almacen || ''))) {
    return `${alm}-${suffix}`;
  }
  return suffix;
}

export function applyCatalogoToState(catalogo, setAlmacenes, setArmariosPorAlmacen) {
  if (catalogo?.almacenes && setAlmacenes) {
    setAlmacenes(catalogo.almacenes);
  }
  if (catalogo?.armariosPorAlmacen && setArmariosPorAlmacen) {
    setArmariosPorAlmacen(catalogo.armariosPorAlmacen);
  }
}

export function pickDefaultArmario(armarios) {
  if (!armarios?.length) return '';
  const preferred = armarios.find((a) => a.codigo === 'A01');
  return preferred?.codigo || armarios[0].codigo;
}
