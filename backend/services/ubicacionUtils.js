const ARMARIOS_DEFAULT = {
  A00: 'Armario Papelería',
  A01: 'Armario Herramientas',
  A02: 'Armario Electrónica',
};

export const CONTENEDOR_ESPECIAL = 'SC';

const CONTENEDOR_REGLAS_DEFAULT = {
  C: { min: 1, max: 99 },
  B: { min: 0, max: 99 },
  H: { min: 1, max: 99 },
};

/** Sufijo en código completo: A01-E03-C05, A01-E03-B12, A01-E03-SC */
export const CONTENEDOR_SUFIJO_RE = '(?:C\\d{2}|B\\d{2}|H\\d{2}|SC)';

let armariosMap = { ...ARMARIOS_DEFAULT };
let catalogRules = {
  estanteMin: 1,
  estanteMax: 9,
  contenedorReglas: { ...CONTENEDOR_REGLAS_DEFAULT },
};

export function getContenedorHelpText() {
  return 'C01–C99, B00–B99, H01–H99 o SC (sin contenedor)';
}

export function getContenedorReglas() {
  return catalogRules.contenedorReglas || CONTENEDOR_REGLAS_DEFAULT;
}

export function applyCatalogo(catalogo) {
  if (catalogo?.armarios) armariosMap = catalogo.armarios;
  if (catalogo) {
    catalogRules = {
      estanteMin: catalogo.estanteMin ?? 1,
      estanteMax: catalogo.estanteMax ?? 9,
      contenedorReglas: catalogo.contenedorReglas || {
        C: {
          min: catalogo.contenedorMin ?? CONTENEDOR_REGLAS_DEFAULT.C.min,
          max: catalogo.contenedorMax ?? CONTENEDOR_REGLAS_DEFAULT.C.max,
        },
        B: { ...CONTENEDOR_REGLAS_DEFAULT.B, ...catalogo.contenedorReglas?.B },
        H: { ...CONTENEDOR_REGLAS_DEFAULT.H, ...catalogo.contenedorReglas?.H },
      },
    };
  }
}

export const ARMARIOS = armariosMap;

export function getArmariosMapSync() {
  return armariosMap;
}

export function getArmarioNombre(armario) {
  return armariosMap[String(armario || '').toUpperCase()] || armario || '';
}

export function listArmarios() {
  return Object.entries(armariosMap).map(([codigo, nombre]) => ({ codigo, nombre }));
}

export function normalizeArmario(armario) {
  const code = String(armario || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  if (!armariosMap[code]) {
    throw Object.assign(
      new Error(`Armario inválido. Usá: ${Object.keys(armariosMap).join(', ')}`),
      { status: 400 }
    );
  }
  return code;
}

export function normalizeEstante(estante) {
  const raw = String(estante || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  const m = raw.match(/^E?(\d{1,2})$/);
  if (!m) {
    throw Object.assign(
      new Error(`Estante inválido. Usá E${String(catalogRules.estanteMin).padStart(2, '0')}–E${String(catalogRules.estanteMax).padStart(2, '0')}`),
      { status: 400 }
    );
  }
  const n = parseInt(m[1], 10);
  if (n < catalogRules.estanteMin || n > catalogRules.estanteMax) {
    throw Object.assign(
      new Error(`Estante debe estar entre E${catalogRules.estanteMin} y E${catalogRules.estanteMax}`),
      { status: 400 }
    );
  }
  return `E${String(n).padStart(2, '0')}`;
}

function normalizeContenedorToken(upper) {
  const reglas = getContenedorReglas();
  if (upper === CONTENEDOR_ESPECIAL) return CONTENEDOR_ESPECIAL;

  const m = upper.match(/^([CBH])(\d{1,2})$/);
  if (!m) return null;

  const pref = m[1];
  const n = parseInt(m[2], 10);
  const r = reglas[pref];
  if (!r || n < r.min || n > r.max) return null;

  return `${pref}${String(n).padStart(2, '0')}`;
}

export function normalizeContenedor(contenedor) {
  const raw = String(contenedor ?? '').trim();
  if (!raw || raw === '-' || /^sin\s*contenedor$/i.test(raw)) return null;

  const upper = raw.toUpperCase().replace(/\s+/g, '');

  const direct = normalizeContenedorToken(upper);
  if (direct) return direct;

  // Legacy CSV: "1" o "C1" → C01
  const legacy = upper.match(/^C?(\d{1,2})$/);
  if (legacy) {
    const asC = normalizeContenedorToken(`C${legacy[1]}`);
    if (asC) return asC;
  }

  throw Object.assign(
    new Error(`Contenedor inválido. Usá ${getContenedorHelpText()} u omitilo`),
    { status: 400 }
  );
}

export function isContenedorSuffix(token) {
  return new RegExp(`^${CONTENEDOR_SUFIJO_RE}$`).test(String(token || '').toUpperCase());
}

export function buildCodigo(armario, estante, contenedor) {
  const a = normalizeArmario(armario);
  const e = normalizeEstante(estante);
  const c = normalizeContenedor(contenedor);
  return c ? `${a}-${e}-${c}` : `${a}-${e}`;
}

export function parseCodigo(codigo) {
  const s = String(codigo || '')
    .trim()
    .toUpperCase();
  const withBox = s.match(new RegExp(`^(A\\d{2})-(E\\d{2})-(${CONTENEDOR_SUFIJO_RE})$`));
  if (withBox) {
    const contenedor = normalizeContenedor(withBox[3]);
    return {
      armario: withBox[1],
      estante: withBox[2],
      contenedor,
      codigo: `${withBox[1]}-${withBox[2]}-${contenedor}`,
    };
  }
  const shelfOnly = s.match(/^(A\d{2})-(E\d{2})$/);
  if (shelfOnly) {
    return { armario: shelfOnly[1], estante: shelfOnly[2], contenedor: null, codigo: s };
  }
  const legacy = s.match(/^(A\d{2})-(E\d{1,2})-([A-Z]?\d{1,2}|SC)$/i);
  if (legacy) {
    const contenedor = normalizeContenedor(legacy[3]);
    return {
      armario: legacy[1],
      estante: normalizeEstante(legacy[2]),
      contenedor,
      codigo: buildCodigo(legacy[1], legacy[2], legacy[3]),
    };
  }
  const legacyShelf = s.match(/^(A\d{2})-(E\d{1,2})$/);
  if (legacyShelf) {
    return {
      armario: legacyShelf[1],
      estante: normalizeEstante(legacyShelf[2]),
      contenedor: null,
      codigo: buildCodigo(legacyShelf[1], legacyShelf[2], null),
    };
  }
  const armarioOnly = s.match(/^(A\d{2})$/);
  if (armarioOnly && armariosMap[armarioOnly[1]]) {
    return {
      armario: armarioOnly[1],
      estante: null,
      contenedor: null,
      codigo: armarioOnly[1],
    };
  }
  return null;
}

export function buildDbId(codigo) {
  return `cnt-${String(codigo).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

export function mapUbicacionFields(cont) {
  if (!cont) return {};
  const armario = cont.armario || parseCodigo(cont.codigo)?.armario;
  const estante = cont.estante || parseCodigo(cont.codigo)?.estante;
  const caja = cont.contenedor ?? parseCodigo(cont.codigo)?.contenedor ?? null;
  const armarioNombre = getArmarioNombre(armario);
  const label = [armarioNombre, estante, caja].filter(Boolean).join(' / ');
  return {
    armario,
    armarioNombre,
    estante,
    contenedor: caja,
    ubicacion: armarioNombre,
    ubicacionLabel: label,
  };
}

export function buildContenedorId(armario, estante, contenedor) {
  return buildCodigo(armario, estante, contenedor);
}
