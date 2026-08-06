/** Tipos de etiqueta QR */
export const QR_TYPES = {
  SEDE: 'sede',
  ALMACEN: 'almacen',
  ARMARIO: 'armario',
  ESTANTE: 'estante',
  CONTENEDOR: 'contenedor',
  ITEM: 'item',
  DEVOLUCION: 'devolucion',
  REMITO: 'remito',
};

export function buildQrPayload({ type, codigo, itemId, loteId, remitoId }) {
  const t = type || QR_TYPES.CONTENEDOR;
  if (t === QR_TYPES.ITEM && itemId) {
    return `inventario://item/${encodeURIComponent(itemId)}`;
  }
  if (t === QR_TYPES.DEVOLUCION && (loteId || codigo)) {
    // Prefijo corto: QR menos denso y más legible con el celular (pantalla/papel).
    return `inv://d/${encodeURIComponent(loteId || codigo)}`;
  }
  if (t === QR_TYPES.REMITO && (remitoId || codigo)) {
    return `inv://r/${encodeURIComponent(remitoId || codigo)}`;
  }
  const code = String(codigo || '')
    .trim()
    .toUpperCase();
  if (!code) return '';
  return `inventario://${t}/${code}`;
}

/**
 * Interpreta texto escaneado o pegado → { type, codigo?, itemId? }
 */
export function parseQrScan(text) {
  const s = String(text || '').trim();
  if (!s) return null;

  const deepLink = s.match(
    /(?:inventario|inv):\/\/(sede|almacen|armario|estante|contenedor|item|devolucion|d|remito|r)\/([^?\s#]+)/i
  );
  if (deepLink) {
    let type = deepLink[1].toLowerCase();
    if (type === 'd') type = QR_TYPES.DEVOLUCION;
    if (type === 'r') type = QR_TYPES.REMITO;
    const raw = decodeURIComponent(deepLink[2]);
    if (type === QR_TYPES.ITEM) {
      return { type: QR_TYPES.ITEM, itemId: raw };
    }
    if (type === QR_TYPES.DEVOLUCION) {
      return { type: QR_TYPES.DEVOLUCION, loteId: raw };
    }
    if (type === QR_TYPES.REMITO) {
      return { type: QR_TYPES.REMITO, remitoId: raw };
    }
    return { type, codigo: raw.toUpperCase() };
  }

  // UUID pegado desde el remito (debajo del QR) → devolución de lote
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)) {
    return { type: QR_TYPES.DEVOLUCION, loteId: s.toLowerCase() };
  }

  const itemParam = s.match(/(?:item[_-]?id|itemId)[=:]([a-zA-Z0-9._-]+)/i);
  if (itemParam) {
    return { type: QR_TYPES.ITEM, itemId: itemParam[1] };
  }

  if (/^item[/:]/i.test(s)) {
    const id = s.replace(/^item[/:]/i, '').trim();
    if (id) return { type: QR_TYPES.ITEM, itemId: id };
  }

  const codigo = extractCodigoUbicacion(s);
  if (!codigo) return null;

  if (/^SED\d{3}$/i.test(codigo)) {
    return { type: QR_TYPES.SEDE, codigo };
  }
  if (/^SED\d{3}-ALM\d{2}-[A-Z]\d{2}-E\d{2}$/i.test(codigo)) {
    return { type: QR_TYPES.ESTANTE, codigo };
  }
  if (
    /^SED\d{3}-ALM\d{2}-[A-Z]\d{2}-E\d{2}-(?:C|B|H)\d{2}$/i.test(codigo) ||
    /^SED\d{3}-ALM\d{2}-[A-Z]\d{2}-E\d{2}-SC$/i.test(codigo)
  ) {
    return { type: QR_TYPES.CONTENEDOR, codigo };
  }
  if (/^SED\d{3}-ALM\d{2}$/i.test(codigo)) {
    return { type: QR_TYPES.ALMACEN, codigo };
  }
  if (/^SED\d{3}-ALM\d{2}-[A-Z]\d{2}$/i.test(codigo)) {
    return { type: QR_TYPES.ARMARIO, codigo };
  }

  if (/^ALM\d{2}$/i.test(codigo)) {
    return { type: QR_TYPES.ALMACEN, codigo };
  }
  if (/^ALM\d{2}-A\d{2}$/i.test(codigo)) {
    return { type: QR_TYPES.ARMARIO, codigo };
  }
  if (/^ALM\d{2}-A\d{2}-E\d{2}$/i.test(codigo)) {
    return { type: QR_TYPES.ESTANTE, codigo };
  }
  if (
    /^ALM\d{2}-A\d{2}-E\d{2}-(?:C|B|H)\d{2}$/i.test(codigo) ||
    /^ALM\d{2}-A\d{2}-E\d{2}-SC$/i.test(codigo)
  ) {
    return { type: QR_TYPES.CONTENEDOR, codigo };
  }

  if (/^[A-Z]\d{2}$/.test(codigo)) {
    return { type: QR_TYPES.ARMARIO, codigo };
  }
  if (/^[A-Z]\d{2}-E\d{2}-(?:C|B|H)\d{2}$/.test(codigo) || /^[A-Z]\d{2}-E\d{2}-SC$/.test(codigo)) {
    return { type: QR_TYPES.CONTENEDOR, codigo };
  }
  if (/^[A-Z]\d{2}-E\d{2}$/.test(codigo)) {
    return { type: QR_TYPES.ESTANTE, codigo };
  }
  return { type: QR_TYPES.CONTENEDOR, codigo };
}

export function extractCodigoUbicacion(text) {
  const s = String(text || '').trim();
  const sufijo = '(?:C\\d{2}|B\\d{2}|H\\d{2}|SC)';
  const almPrefix = 'ALM\\d{2}';
  const sedePrefix = 'SED\\d{3}';

  const urlMatch = s.match(
    new RegExp(
      `(?:sede|almacen|contenedor|estante|armario)/((?:${sedePrefix}-)?(?:${almPrefix}-)?[A-Z]\\d{2}(?:-E\\d{2})?(?:-${sufijo})?)`,
      'i'
    )
  );
  if (urlMatch) return urlMatch[1].toUpperCase();

  const sedeFull = s.match(
    new RegExp(`\\b(${sedePrefix}-${almPrefix}-[A-Z]\\d{2}-E\\d{2}-${sufijo})\\b`, 'i')
  );
  if (sedeFull) return sedeFull[1].toUpperCase();

  const sedeShelf = s.match(
    new RegExp(`\\b(${sedePrefix}-${almPrefix}-[A-Z]\\d{2}-E\\d{2})\\b`, 'i')
  );
  if (sedeShelf) return sedeShelf[1].toUpperCase();

  const almOnly = s.match(/\b(ALM\d{2})\b/i);
  if (almOnly && !s.includes('-')) return almOnly[1].toUpperCase();

  const almFull = s.match(
    new RegExp(`\\b(${almPrefix}-[A-Z]\\d{2}-E\\d{2}-${sufijo})\\b`, 'i')
  );
  if (almFull) return almFull[1].toUpperCase();

  const almShelf = s.match(new RegExp(`\\b(${almPrefix}-[A-Z]\\d{2}-E\\d{2})\\b`, 'i'));
  if (almShelf) return almShelf[1].toUpperCase();

  const almArm = s.match(new RegExp(`\\b(${almPrefix}-[A-Z]\\d{2})\\b`, 'i'));
  if (almArm) return almArm[1].toUpperCase();

  const full = s.match(new RegExp(`\\b([A-Z]\\d{2}-E\\d{2}-${sufijo})\\b`, 'i'));
  if (full) return full[1].toUpperCase();

  const shelf = s.match(/\b([A-Z]\d{2}-E\d{2})\b/i);
  if (shelf) return shelf[1].toUpperCase();

  const arm = s.match(/\b([A-Z]\d{2})\b/);
  if (arm && !s.includes('-')) return arm[1].toUpperCase();

  const legacy = s.match(new RegExp(`([A-Z]\\d{2}-E\\d{1,2}(?:-${sufijo}|[A-Z]?\\d{1,2})?)`, 'i'));
  if (legacy) {
    const parts = legacy[1].toUpperCase().split('-');
    const a = parts[0];
    const e = `E${String(parts[1].replace(/\D/g, '')).padStart(2, '0')}`;
    if (parts[2]) {
      const c = `C${String(parts[2].replace(/\D/g, '')).padStart(2, '0')}`;
      return `${a}-${e}-${c}`;
    }
    return `${a}-${e}`;
  }
  return null;
}

/** Compatibilidad con escáner anterior */
export function extractContenedorIdFromScan(text) {
  const parsed = parseQrScan(text);
  if (!parsed) return null;
  if (parsed.type === QR_TYPES.ITEM) return null;
  return parsed.codigo;
}

export function qrTypeLabel(type) {
  switch (type) {
    case QR_TYPES.ALMACEN:
      return 'Almacén';
    case QR_TYPES.ARMARIO:
      return 'Armario';
    case QR_TYPES.ESTANTE:
      return 'Estante';
    case QR_TYPES.CONTENEDOR:
      return 'Contenedor';
    case QR_TYPES.ITEM:
      return 'Artículo';
    case QR_TYPES.DEVOLUCION:
      return 'Devolución kit';
    case QR_TYPES.REMITO:
      return 'Remito transferencia';
    default:
      return 'Ubicación';
  }
}
