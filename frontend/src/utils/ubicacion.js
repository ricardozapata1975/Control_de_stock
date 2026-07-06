export const ALMACEN_DEFAULT = 'ALM01';
export const SEDE_DEFAULT = 'SED001';
export const ALMACEN_TIPOS = ['Almacén', 'Depósito', 'Oficina'];
export const SEDE_TIPOS = ['Oficina', 'Depósito', 'Planta', 'Cliente'];
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

export function getSedesFromCatalog(catalogo) {
  if (catalogo?.sedes?.length) return catalogo.sedes;
  return [{ codigo: SEDE_DEFAULT, nombre: 'Sede principal' }];
}

export function getSedeNombreFromCatalog(catalogo, sede) {
  const code = String(sede || SEDE_DEFAULT).toUpperCase();
  const found = getSedesFromCatalog(catalogo).find((s) => String(s.codigo).toUpperCase() === code);
  return found?.nombre || sede || '';
}

export function getAlmacenesForSede(catalogo, sede) {
  const code = String(sede || SEDE_DEFAULT).toUpperCase();
  const all = catalogo?.almacenes?.length
    ? catalogo.almacenes
    : [{ codigo: ALMACEN_DEFAULT, nombre: 'Oficina principal', sede: SEDE_DEFAULT }];
  return all.filter((a) => String(a.sede || SEDE_DEFAULT).toUpperCase() === code);
}

export function getAduanaForSede(catalogo, sede) {
  const code = String(sede || SEDE_DEFAULT).toUpperCase();
  if (catalogo?.aduanasPorSede?.[code]) return catalogo.aduanasPorSede[code];
  const found = getSedesFromCatalog(catalogo).find((s) => String(s.codigo).toUpperCase() === code);
  return found?.aduana || null;
}

export function resolveAduanaUbicacion(catalogo, sede) {
  const aduana = getAduanaForSede(catalogo, sede);
  if (!aduana) return null;
  return {
    sede: codeFromSede(sede),
    almacen: aduana.almacen,
    armario: aduana.armario || 'A00',
    estante: aduana.estante || 'E01',
    contenedor: aduana.contenedor || 'C01',
  };
}

function codeFromSede(sede) {
  return String(sede || SEDE_DEFAULT).toUpperCase();
}

export function getAlmacenNombreFromCatalog(catalogo, almacen) {
  const code = String(almacen || ALMACEN_DEFAULT).toUpperCase();
  const found = catalogo?.almacenes?.find((a) => String(a.codigo).toUpperCase() === code);
  if (found?.nombre) return found.nombre;
  return getAlmacenNombre(almacen);
}

/** Etiqueta legible de sede/ubicación */
export function buildCedeLabel(catalogo, { sede, almacen, armario, estante, contenedor } = {}) {
  const parts = [];
  const sedeNombre = getSedeNombreFromCatalog(catalogo, sede);
  if (sedeNombre) parts.push(sedeNombre);
  const almNombre = getAlmacenNombreFromCatalog(catalogo, almacen);
  if (almNombre) parts.push(almNombre);
  const armNombre = getArmarioNombre(armario, almacen, catalogo?.armariosPorAlmacen);
  if (armNombre) parts.push(armNombre);
  else if (armario) parts.push(String(armario).toUpperCase());
  if (estante) parts.push(String(estante).toUpperCase());
  if (contenedor) {
    const c = String(contenedor).toUpperCase();
    parts.push(/^C\d|^B\d|^H\d|^SC$/i.test(c) ? `contenedor ${c}` : c);
  }
  return parts.join(' — ');
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
  if (catalogo?.armariosPorAlmacen && Object.keys(catalogo.armariosPorAlmacen).length > 0) {
    return catalogo.armariosPorAlmacen[alm] || [];
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
    item.sedeNombre || getSedeNombreFromCatalog({ sedes: [] }, item.sede),
    item.almacenNombre || getAlmacenNombre(item.almacen),
    item.armarioNombre || getArmarioNombre(item.armario, item.almacen) || item.ubicacion,
    item.estante,
    item.contenedor,
  ].filter(Boolean);
  return parts.join(' / ') || '—';
}

import { normalizeContenedorPreview } from './contenedorCodigo';

/** Vista previa: ALM01-A01-E03-C05 o A01-E03 (legacy ALM01) */
/** Código QR: ALM02, ALM02-A00, ALM02-A00-E01, ALM02-A00-E01-C05 */
export function buildUbicacionCodigo(almacen, armario, estante, contenedor) {
  const alm = String(almacen || ALMACEN_DEFAULT).toUpperCase();
  if (!armario) return alm;
  const arm = String(armario).toUpperCase();
  if (!estante) {
    if (alm !== ALMACEN_DEFAULT) return `${alm}-${arm}`;
    return arm;
  }
  const preview = buildCodigoPreview(alm, arm, estante, contenedor);
  if (preview) return preview;
  const est = String(estante).toUpperCase();
  if (contenedor) {
    return `${alm}-${arm}-${est}-${String(contenedor).toUpperCase()}`;
  }
  return `${alm}-${arm}-${est}`;
}

export function buildCodigoCompletoPreview(sede, almacen, armario, estante, contenedor) {
  const s = String(sede || SEDE_DEFAULT).toUpperCase();
  const alm = String(almacen || ALMACEN_DEFAULT).toUpperCase();
  if (!armario || !estante) return '';
  const a = String(armario).toUpperCase();
  const eRaw = String(estante).toUpperCase();
  const eNum = eRaw.match(/E?(\d{1,2})/);
  if (!eNum) return '';
  const e = `E${String(eNum[1]).padStart(2, '0')}`;
  const c = normalizeContenedorPreview(contenedor);
  const tail = c ? `${a}-${e}-${c}` : `${a}-${e}`;
  return `${s}-${alm}-${tail}`;
}

export function buildCodigoPreview(almacen, armarioOrEstante, estanteOrContenedor, contenedorMaybe, sedeMaybe) {
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
  if (sedeMaybe) {
    return buildCodigoCompletoPreview(sedeMaybe, alm, armario, estante, contenedor);
  }
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
