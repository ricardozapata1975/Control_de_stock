export function mapItemCampos(item) {
  if (!item) return {};
  const fecha = item.fecha_relevamiento ?? item.fechaRelevamiento ?? null;
  return {
    calibracion: item.calibracion || '',
    comentario: item.comentario || '',
    fechaRelevamiento: fecha ? String(fecha).slice(0, 10) : null,
  };
}

export function itemPayloadFromBody(body) {
  const fecha = body.fechaRelevamiento ?? body.fecha_relevamiento;
  return {
    nombre: body.nombre?.trim(),
    marca: body.marca?.trim() || '',
    modelo: body.modelo?.trim() || '',
    tipo: body.tipo?.trim() || '',
    detalle: body.detalle?.trim() || '',
    calibracion: body.calibracion?.trim() || '',
    comentario: body.comentario?.trim() || '',
    fecha_relevamiento: parseFechaRelevamiento(fecha),
  };
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
