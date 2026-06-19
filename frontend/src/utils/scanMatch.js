import { QR_TYPES, parseQrScan } from './qrPayload';
import { getAlmacenNombre, getArmarioNombre } from './ubicacion';

export function parsedFromCodigoParam(codigo, tipoUbicacion) {
  if (!codigo) return null;
  const s = String(codigo).trim();
  if (tipoUbicacion && Object.values(QR_TYPES).includes(tipoUbicacion)) {
    if (tipoUbicacion === QR_TYPES.ITEM) return { type: QR_TYPES.ITEM, itemId: s };
    return { type: tipoUbicacion, codigo: s.toUpperCase() };
  }
  return (
    parseQrScan(`inventario://contenedor/${s}`) ||
    parseQrScan(`inventario://estante/${s}`) ||
    parseQrScan(`inventario://armario/${s}`) ||
    parseQrScan(`inventario://almacen/${s}`) ||
    parseQrScan(s) || { codigo: s.toUpperCase() }
  );
}

function codigoMatchesItem(parsed, item) {
  if (!parsed?.codigo || !item) return false;
  const codigo = parsed.codigo.toUpperCase();
  if (item.contenedorCodigo === codigo) return true;
  if (`${item.almacen}-${item.armario}-${item.estante}` === codigo) return true;
  if (`${item.almacen}-${item.armario}` === codigo) return true;
  if (item.almacen === codigo) return true;
  if (`${item.armario}-${item.estante}` === codigo) return true;
  if (item.armario === codigo) return true;
  return false;
}

/** Filtra filas de inventario según resultado de escaneo */
export function filterInventarioByScan(items, parsed) {
  if (!parsed || !items?.length) return items || [];
  if (parsed.type === QR_TYPES.ITEM && parsed.itemId) {
    return items.filter((i) => i.itemId === parsed.itemId);
  }
  if (!parsed.codigo) return items;

  const codigo = parsed.codigo.toUpperCase();
  if (parsed.type === QR_TYPES.ALMACEN) {
    return items.filter((i) => i.almacen === codigo);
  }
  if (parsed.type === QR_TYPES.ARMARIO) {
    if (codigo.includes('-')) {
      const [alm, arm] = codigo.split('-');
      return items.filter((i) => i.almacen === alm && i.armario === arm);
    }
    return items.filter((i) => i.armario === codigo);
  }
  if (parsed.type === QR_TYPES.ESTANTE) {
    if (codigo.startsWith('ALM')) {
      const [, arm, est] = codigo.split('-');
      return items.filter((i) => i.armario === arm && i.estante === est);
    }
    return items.filter((i) => `${i.armario}-${i.estante}` === codigo);
  }
  if (parsed.type === QR_TYPES.CONTENEDOR) {
    return items.filter((i) => codigoMatchesItem(parsed, i));
  }
  return items.filter((i) => codigoMatchesItem(parsed, i));
}

export function filterPendientesByScan(movimientos, parsed, inventarioRows = []) {
  if (!parsed || !movimientos?.length) return movimientos || [];
  let list = movimientos;

  if (parsed.type === QR_TYPES.ITEM && parsed.itemId) {
    list = list.filter((m) => m.itemId === parsed.itemId);
  } else if (parsed.codigo) {
    const invMatch = filterInventarioByScan(inventarioRows, parsed);
    const contIds = new Set(invMatch.map((i) => i.contenedorId));
    const itemIds = new Set(invMatch.map((i) => i.itemId));
    list = list.filter(
      (m) => contIds.has(m.contenedorId) || itemIds.has(m.itemId)
    );
  }
  return list;
}

/** Texto descriptivo de la ubicación escaneada */
export function getUbicacionScanLabel(parsed, contenedor) {
  if (!parsed?.codigo) return '';
  const codigo = parsed.codigo.toUpperCase();

  if (parsed.type === QR_TYPES.ALMACEN) {
    return `Almacén ${codigo} — ${getAlmacenNombre(codigo)}`;
  }
  if (parsed.type === QR_TYPES.ARMARIO) {
    if (codigo.includes('-')) {
      const [alm, arm] = codigo.split('-');
      return `Almacén ${alm} (${getAlmacenNombre(alm)}) · Armario ${arm} — ${getArmarioNombre(arm)}`;
    }
    return `Armario ${codigo} — ${getArmarioNombre(codigo)}`;
  }
  if (parsed.type === QR_TYPES.ESTANTE) {
    if (codigo.startsWith('ALM')) {
      const [, arm, est] = codigo.split('-');
      return `Armario ${arm} (${getArmarioNombre(arm)}) · Estante ${est}`;
    }
    const [arm, est] = codigo.split('-');
    return `Armario ${arm} (${getArmarioNombre(arm)}) · Estante ${est}`;
  }
  if (parsed.type === QR_TYPES.CONTENEDOR) {
    if (contenedor?.ubicacionLabel) return contenedor.ubicacionLabel;
    if (codigo.startsWith('ALM')) {
      const [, arm, est, caja] = codigo.split('-');
      return `${getAlmacenNombre(codigo.split('-')[0])} · Armario ${arm} (${getArmarioNombre(arm)}) · ${est}${caja ? ` · ${caja}` : ''}`;
    }
    const parts = codigo.split('-');
    const arm = parts[0];
    const est = parts[1];
    const caja = parts[2];
    return `Armario ${arm} (${getArmarioNombre(arm)}) · ${est}${caja ? ` · ${caja}` : ''}`;
  }
  return codigo;
}

export function buildInventarioScanUrl(parsed) {
  const p = new URLSearchParams();
  if (parsed?.codigo) p.set('codigo', parsed.codigo);
  if (parsed?.type && parsed.type !== QR_TYPES.ITEM) p.set('tipoUbicacion', parsed.type);
  return `/?${p.toString()}`;
}

export function buildEgresoUrlForItem(item) {
  const p = new URLSearchParams({ stockId: item.id });
  return `/egreso?${p.toString()}`;
}

export function buildIngresoUrlForItem(item) {
  const p = new URLSearchParams({
    itemId: item.itemId,
    contenedorId: item.contenedorId,
  });
  return `/ingreso?${p.toString()}`;
}
