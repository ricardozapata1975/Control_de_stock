/** Tipos de etiqueta QR */
export const QR_TYPES = {
  ALMACEN: 'almacen',
  ARMARIO: 'armario',
  ESTANTE: 'estante',
  CONTENEDOR: 'contenedor',
  ITEM: 'item',
};

export function buildQrPayload({ type, codigo, itemId }) {
  const t = type || QR_TYPES.CONTENEDOR;
  if (t === QR_TYPES.ITEM && itemId) {
    return `inventario://item/${encodeURIComponent(itemId)}`;
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
    /inventario:\/\/(almacen|armario|estante|contenedor|item)\/([^?\s#]+)/i
  );
  if (deepLink) {
    const type = deepLink[1].toLowerCase();
    const raw = decodeURIComponent(deepLink[2]);
    if (type === QR_TYPES.ITEM) {
      return { type: QR_TYPES.ITEM, itemId: raw };
    }
    return { type, codigo: raw.toUpperCase() };
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

  const urlMatch = s.match(
    new RegExp(
      `(?:almacen|contenedor|estante|armario)/((?:${almPrefix}-)?[A-Z]\\d{2}(?:-E\\d{2})?(?:-${sufijo})?)`,
      'i'
    )
  );
  if (urlMatch) return urlMatch[1].toUpperCase();

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
    default:
      return 'Ubicación';
  }
}
