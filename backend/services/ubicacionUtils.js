const ARMARIOS_DEFAULT = {
  A00: 'Armario Papelería',
  A01: 'Armario Herramientas',
  A02: 'Armario Electrónica',
};

const ALMACENES_DEFAULT = {
  ALM01: { tipo: 'Oficina', nombre: 'Oficina principal' },
};

export const ALMACEN_DEFAULT = 'ALM01';
export const ALMACEN_TIPOS = ['Almacén', 'Depósito', 'Oficina'];

export const CONTENEDOR_ESPECIAL = 'SC';

const CONTENEDOR_REGLAS_DEFAULT = {
  C: { min: 1, max: 99 },
  B: { min: 0, max: 99 },
  H: { min: 1, max: 99 },
};

/** Sufijo en código completo: A01-E03-C05, A01-E03-B12, A01-E03-SC */
export const CONTENEDOR_SUFIJO_RE = '(?:C\\d{2}|B\\d{2}|H\\d{2}|SC)';

const ALMACEN_RE = /^ALM\d{2}$/i;
const ARMARIO_RE = /^A\d{2}$/;

let armariosMap = { ...ARMARIOS_DEFAULT };
let almacenesMap = { ...ALMACENES_DEFAULT };
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
  if (catalogo?.almacenes) almacenesMap = catalogo.almacenes;
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

export function getAlmacenesMapSync() {
  return almacenesMap;
}

export function listAlmacenes() {
  return Object.entries(almacenesMap).map(([codigo, info]) => ({
    codigo,
    tipo: info?.tipo || '',
    nombre: info?.nombre || codigo,
  }));
}

export function getAlmacenInfo(almacen) {
  const code = String(almacen || ALMACEN_DEFAULT).toUpperCase();
  return almacenesMap[code] || { tipo: '', nombre: code };
}

export function getAlmacenNombre(almacen) {
  const info = getAlmacenInfo(almacen);
  return info.nombre || almacen || '';
}

export function normalizeAlmacen(almacen) {
  const code = String(almacen || ALMACEN_DEFAULT)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  if (!ALMACEN_RE.test(code)) {
    throw Object.assign(new Error('Almacén inválido. Usá ALM01, ALM02…'), { status: 400 });
  }
  if (!almacenesMap[code]) {
    throw Object.assign(
      new Error(`Almacén no registrado: ${code}. Configuralo en el catálogo.`),
      { status: 400 }
    );
  }
  return code;
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

function isAlmacenToken(token) {
  return ALMACEN_RE.test(String(token || '').toUpperCase());
}

function buildCodigoSuffix(armario, estante, contenedor) {
  const a = normalizeArmario(armario);
  const e = normalizeEstante(estante);
  const c = normalizeContenedor(contenedor);
  return c ? `${a}-${e}-${c}` : `${a}-${e}`;
}

/**
 * buildCodigo(almacen, armario, estante, contenedor?) con almacén explícito, o
 * buildCodigo(armario, estante, contenedor?) legacy (ALM01 implícito, sin prefijo en código).
 */
export function buildCodigo(a1, a2, a3, a4) {
  let almacen;
  let armario;
  let estante;
  let contenedor;
  let includeAlmacenPrefix;

  if (isAlmacenToken(a1)) {
    almacen = normalizeAlmacen(a1);
    armario = a2;
    estante = a3;
    contenedor = a4;
    includeAlmacenPrefix = true;
  } else {
    almacen = ALMACEN_DEFAULT;
    armario = a1;
    estante = a2;
    contenedor = a3;
    includeAlmacenPrefix = false;
  }

  const suffix = buildCodigoSuffix(armario, estante, contenedor);
  if (includeAlmacenPrefix) return `${almacen}-${suffix}`;
  return suffix;
}

function parseWithAlmacen(s) {
  const fullBox = s.match(
    new RegExp(`^(ALM\\d{2})-(A\\d{2})-(E\\d{2})-(${CONTENEDOR_SUFIJO_RE})$`)
  );
  if (fullBox) {
    const contenedor = normalizeContenedor(fullBox[4]);
    const almacen = fullBox[1];
    const armario = fullBox[2];
    const estante = fullBox[3];
    return {
      almacen,
      armario,
      estante,
      contenedor,
      codigo: `${almacen}-${armario}-${estante}-${contenedor}`,
    };
  }

  const shelfOnly = s.match(/^(ALM\d{2})-(A\d{2})-(E\d{2})$/);
  if (shelfOnly) {
    return {
      almacen: shelfOnly[1],
      armario: shelfOnly[2],
      estante: shelfOnly[3],
      contenedor: null,
      codigo: s,
    };
  }

  const armarioOnly = s.match(/^(ALM\d{2})-(A\d{2})$/);
  if (armarioOnly && armariosMap[armarioOnly[2]]) {
    return {
      almacen: armarioOnly[1],
      armario: armarioOnly[2],
      estante: null,
      contenedor: null,
      codigo: s,
    };
  }

  const almacenOnly = s.match(/^(ALM\d{2})$/);
  if (almacenOnly && almacenesMap[almacenOnly[1]]) {
    return {
      almacen: almacenOnly[1],
      armario: null,
      estante: null,
      contenedor: null,
      codigo: almacenOnly[1],
    };
  }

  return null;
}

function parseLegacy(s) {
  const withBox = s.match(new RegExp(`^(A\\d{2})-(E\\d{2})-(${CONTENEDOR_SUFIJO_RE})$`));
  if (withBox) {
    const contenedor = normalizeContenedor(withBox[3]);
    return {
      almacen: ALMACEN_DEFAULT,
      armario: withBox[1],
      estante: withBox[2],
      contenedor,
      codigo: `${withBox[1]}-${withBox[2]}-${contenedor}`,
    };
  }

  const shelfOnly = s.match(/^(A\d{2})-(E\d{2})$/);
  if (shelfOnly) {
    return {
      almacen: ALMACEN_DEFAULT,
      armario: shelfOnly[1],
      estante: shelfOnly[2],
      contenedor: null,
      codigo: s,
    };
  }

  const legacy = s.match(/^(A\d{2})-(E\d{1,2})-([A-Z]?\d{1,2}|SC)$/i);
  if (legacy) {
    const contenedor = normalizeContenedor(legacy[3]);
    return {
      almacen: ALMACEN_DEFAULT,
      armario: legacy[1],
      estante: normalizeEstante(legacy[2]),
      contenedor,
      codigo: buildCodigo(legacy[1], legacy[2], legacy[3]),
    };
  }

  const legacyShelf = s.match(/^(A\d{2})-(E\d{1,2})$/);
  if (legacyShelf) {
    return {
      almacen: ALMACEN_DEFAULT,
      armario: legacyShelf[1],
      estante: normalizeEstante(legacyShelf[2]),
      contenedor: null,
      codigo: buildCodigo(legacyShelf[1], legacyShelf[2], null),
    };
  }

  const armarioOnly = s.match(/^(A\d{2})$/);
  if (armarioOnly && armariosMap[armarioOnly[1]]) {
    return {
      almacen: ALMACEN_DEFAULT,
      armario: armarioOnly[1],
      estante: null,
      contenedor: null,
      codigo: armarioOnly[1],
    };
  }

  return null;
}

export function parseCodigo(codigo) {
  const s = String(codigo || '')
    .trim()
    .toUpperCase();
  if (!s) return null;

  if (isAlmacenToken(s)) {
    return parseWithAlmacen(s) || {
      almacen: s,
      armario: null,
      estante: null,
      contenedor: null,
      codigo: s,
    };
  }

  if (s.startsWith('ALM')) {
    const withAlm = parseWithAlmacen(s);
    if (withAlm) return withAlm;
  }

  return parseLegacy(s);
}

/** Variantes de código para búsqueda en BD (legacy sin prefijo ALM + con prefijo). */
export function codigoLookupVariants(parsed) {
  if (!parsed) return [];
  const variants = new Set();
  if (parsed.codigo) variants.add(parsed.codigo);

  const alm = parsed.almacen || ALMACEN_DEFAULT;
  const { armario, estante, contenedor } = parsed;

  if (armario && estante) {
    const legacy = buildCodigo(armario, estante, contenedor);
    variants.add(legacy);
    variants.add(`${alm}-${legacy}`);
  } else if (armario) {
    variants.add(armario);
    variants.add(`${alm}-${armario}`);
  } else if (alm) {
    variants.add(alm);
  }

  return [...variants];
}

export function buildDbId(codigo) {
  return `cnt-${String(codigo).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

export function mapUbicacionFields(cont) {
  if (!cont) return {};
  const parsed = parseCodigo(cont.codigo);
  const almacen = cont.almacen || parsed?.almacen || ALMACEN_DEFAULT;
  const armario = cont.armario || parsed?.armario;
  const estante = cont.estante || parsed?.estante;
  const caja = cont.contenedor ?? parsed?.contenedor ?? null;
  const almacenInfo = getAlmacenInfo(almacen);
  const armarioNombre = getArmarioNombre(armario);
  const label = [almacenInfo.nombre, armarioNombre, estante, caja].filter(Boolean).join(' / ');
  return {
    almacen,
    almacenNombre: almacenInfo.nombre,
    almacenTipo: almacenInfo.tipo,
    armario,
    armarioNombre,
    estante,
    contenedor: caja,
    ubicacion: armarioNombre,
    ubicacionLabel: label,
  };
}

export function buildContenedorId(armario, estante, contenedor, almacen) {
  if (almacen && isAlmacenToken(almacen)) {
    return buildCodigo(almacen, armario, estante, contenedor);
  }
  return buildCodigo(armario, estante, contenedor);
}
