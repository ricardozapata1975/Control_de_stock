export const ALMACEN_DEFAULT = 'ALM01';
export const ALMACEN_TIPOS = ['Almacén', 'Depósito', 'Oficina'];

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

export function getArmarioNombre(armario) {
  return ARMARIOS[String(armario || '').toUpperCase()] || armario || '';
}

export function formatUbicacionLabel(item) {
  if (!item) return '—';
  if (item.ubicacionLabel) return item.ubicacionLabel;
  const parts = [
    item.almacenNombre || getAlmacenNombre(item.almacen),
    item.armarioNombre || getArmarioNombre(item.armario) || item.ubicacion,
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

export function applyCatalogoToState(catalogo, setAlmacenes, setArmarios) {
  if (catalogo?.almacenes && setAlmacenes) {
    setAlmacenes(catalogo.almacenes);
  }
  if (catalogo?.armarios && setArmarios) {
    Object.assign(ARMARIOS, catalogo.armarios);
  }
}
