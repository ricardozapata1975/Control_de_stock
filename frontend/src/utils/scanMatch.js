import { QR_TYPES, parseQrScan } from './qrPayload';

export function parsedFromCodigoParam(codigo) {
  if (!codigo) return null;
  const s = String(codigo).trim();
  return (
    parseQrScan(`inventario://contenedor/${s}`) ||
    parseQrScan(`inventario://estante/${s}`) ||
    parseQrScan(`inventario://armario/${s}`) ||
    parseQrScan(s) || { codigo: s.toUpperCase() }
  );
}

/** Filtra filas de inventario según resultado de escaneo */
export function filterInventarioByScan(items, parsed) {
  if (!parsed || !items?.length) return items || [];
  if (parsed.type === QR_TYPES.ITEM && parsed.itemId) {
    return items.filter((i) => i.itemId === parsed.itemId);
  }
  if (!parsed.codigo) return items;

  const codigo = parsed.codigo.toUpperCase();
  if (parsed.type === QR_TYPES.ARMARIO) {
    return items.filter((i) => i.armario === codigo);
  }
  if (parsed.type === QR_TYPES.ESTANTE) {
    return items.filter((i) => `${i.armario}-${i.estante}` === codigo);
  }
  if (parsed.type === QR_TYPES.CONTENEDOR) {
    return items.filter((i) => i.contenedorCodigo === codigo);
  }
  return items.filter(
    (i) =>
      i.contenedorCodigo === codigo ||
      `${i.armario}-${i.estante}` === codigo ||
      i.armario === codigo
  );
}

export function filterPendientesByScan(movimientos, parsed, inventarioRows = []) {
  if (!parsed || !movimientos?.length) return movimientos || [];
  let list = movimientos;

  if (parsed.type === QR_TYPES.ITEM && parsed.itemId) {
    list = list.filter((m) => m.itemId === parsed.itemId);
  } else if (parsed.codigo) {
    const codigo = parsed.codigo.toUpperCase();
    const invMatch = filterInventarioByScan(inventarioRows, parsed);
    const contIds = new Set(invMatch.map((i) => i.contenedorId));
    const itemIds = new Set(invMatch.map((i) => i.itemId));
    list = list.filter(
      (m) =>
        (m.contenedorCodigo && m.contenedorCodigo.toUpperCase().startsWith(codigo)) ||
        contIds.has(m.contenedorId) ||
        itemIds.has(m.itemId)
    );
  }
  return list;
}
