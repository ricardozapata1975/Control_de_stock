export function normalizeCodigoFabricante(val) {
  const s = String(val ?? '').trim();
  return s || null;
}

function parseOptionalNumber(val) {
  if (val === undefined || val === null || val === '') return null;
  const n = Number(String(val).replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function pickCatalogFromItem(item) {
  return {
    unidad: item.unidad || '',
    packing: item.packing || '',
    precioLista:
      item.precio_lista != null
        ? Number(item.precio_lista)
        : item.precioLista != null
          ? Number(item.precioLista)
          : null,
    moneda: item.moneda || '',
    pesoKg:
      item.peso_kg != null
        ? Number(item.peso_kg)
        : item.pesoKg != null
          ? Number(item.pesoKg)
          : null,
    familia: item.familia || '',
    subfamilia: item.subfamilia || '',
    tema: item.tema || '',
    catalogoFuente: item.catalogo_fuente || item.catalogoFuente || '',
    catalogoVigencia: item.catalogo_vigencia || item.catalogoVigencia || '',
  };
}

export function mapItemCampos(item) {
  if (!item) return {};
  const fecha = item.fecha_relevamiento ?? item.fechaRelevamiento ?? null;
  const codigoFab = item.codigo_fabricante ?? item.codigoFabricante ?? null;
  return {
    calibracion: item.calibracion || '',
    comentario: item.comentario || '',
    fechaRelevamiento: fecha ? String(fecha).slice(0, 10) : null,
    codigoFabricante: codigoFab ? String(codigoFab).trim() : '',
    imagenUrl: item.imagen_url || item.imagenUrl || '',
    imagenPath: item.imagen_path || item.imagenPath || '',
    ...pickCatalogFromItem(item),
  };
}

function applyCatalogPayload(target, body) {
  if (body.unidad !== undefined) target.unidad = String(body.unidad || '').trim();
  if (body.packing !== undefined) target.packing = String(body.packing || '').trim();
  if (body.precioLista !== undefined || body.precio_lista !== undefined) {
    target.precio_lista = parseOptionalNumber(body.precioLista ?? body.precio_lista);
  }
  if (body.moneda !== undefined) target.moneda = String(body.moneda || '').trim().toUpperCase();
  if (body.pesoKg !== undefined || body.peso_kg !== undefined) {
    target.peso_kg = parseOptionalNumber(body.pesoKg ?? body.peso_kg);
  }
  if (body.familia !== undefined) target.familia = String(body.familia || '').trim();
  if (body.subfamilia !== undefined) target.subfamilia = String(body.subfamilia || '').trim();
  if (body.tema !== undefined) target.tema = String(body.tema || '').trim();
  if (body.catalogoFuente !== undefined || body.catalogo_fuente !== undefined) {
    target.catalogo_fuente = String(body.catalogoFuente ?? body.catalogo_fuente ?? '').trim();
  }
  if (body.catalogoVigencia !== undefined || body.catalogo_vigencia !== undefined) {
    target.catalogo_vigencia = String(body.catalogoVigencia ?? body.catalogo_vigencia ?? '').trim();
  }
}

export function itemPayloadFromBody(body) {
  const fecha = body.fechaRelevamiento ?? body.fecha_relevamiento;
  const payload = {
    nombre: body.nombre?.trim(),
    marca: body.marca?.trim() || '',
    modelo: body.modelo?.trim() || '',
    tipo: body.tipo?.trim() || '',
    detalle: body.detalle?.trim() || '',
    calibracion: body.calibracion?.trim() || '',
    comentario: body.comentario?.trim() || '',
    fecha_relevamiento: parseFechaRelevamiento(fecha),
  };
  if (body.codigoFabricante !== undefined || body.codigo_fabricante !== undefined) {
    payload.codigo_fabricante = normalizeCodigoFabricante(
      body.codigoFabricante ?? body.codigo_fabricante
    );
  }
  applyCatalogPayload(payload, body);
  return payload;
}

/** Actualización parcial de ítem (solo campos presentes en body). */
export function itemPartialUpdateFromBody(body) {
  const updates = {};
  if (body.nombre !== undefined) updates.nombre = String(body.nombre || '').trim();
  if (body.marca !== undefined) updates.marca = String(body.marca || '').trim();
  if (body.modelo !== undefined) updates.modelo = String(body.modelo || '').trim();
  if (body.tipo !== undefined) updates.tipo = String(body.tipo || '').trim();
  if (body.detalle !== undefined) updates.detalle = String(body.detalle || '').trim();
  if (body.calibracion !== undefined) updates.calibracion = String(body.calibracion || '').trim();
  if (body.comentario !== undefined) updates.comentario = String(body.comentario || '').trim();
  if (body.fechaRelevamiento !== undefined || body.fecha_relevamiento !== undefined) {
    updates.fecha_relevamiento = parseFechaRelevamiento(
      body.fechaRelevamiento ?? body.fecha_relevamiento
    );
  }
  if (body.codigoFabricante !== undefined || body.codigo_fabricante !== undefined) {
    updates.codigo_fabricante = normalizeCodigoFabricante(
      body.codigoFabricante ?? body.codigo_fabricante
    );
  }
  applyCatalogPayload(updates, body);
  return updates;
}

/** Acepta AAAA-MM-DD, DD/MM/AAAA, D/M/AAAA (Excel en español) */
export function parseFechaRelevamiento(val) {
  const raw = String(val ?? '').trim();
  if (!raw || raw.toLowerCase() === 'no' || raw === '-') {
    return new Date().toISOString().slice(0, 10);
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10);
  }

  const dmy = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (dmy) {
    const day = parseInt(dmy[1], 10);
    const month = parseInt(dmy[2], 10);
    let year = parseInt(dmy[3], 10);
    if (year < 100) year += 2000;
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      throw Object.assign(new Error(`fecha_relevamiento inválida: ${raw}`), { status: 400 });
    }
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw Object.assign(
      new Error(`fecha_relevamiento inválida: "${raw}". Use AAAA-MM-DD o DD/MM/AAAA`),
      { status: 400 }
    );
  }
  return d.toISOString().slice(0, 10);
}

export function itemCamposFromCsv(row) {
  const fechaRaw =
    row.fecha_relevamiento ??
    row.fecha_relevamiento_ ??
    row['fecha_relevamiento'] ??
    '';
  return {
    calibracion: row.calibracion?.trim() || '',
    comentario: row.comentario?.trim() || '',
    fecha_relevamiento: parseFechaRelevamiento(fechaRaw),
  };
}
