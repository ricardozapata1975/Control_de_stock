const ARMARIOS_DEFAULT = {
  A00: { nombre: 'Armario Papelería', tipo: 'armario' },
  A01: { nombre: 'Armario Herramientas', tipo: 'armario' },
  A02: { nombre: 'Armario Electrónica', tipo: 'armario' },
};

const ALMACENES_DEFAULT = {
  ALM01: {
    tipo: 'Oficina',
    nombre: 'Oficina principal',
    nextArmarioNum: 3,
    armarios: { ...ARMARIOS_DEFAULT },
  },
};

export const ALMACEN_DEFAULT = 'ALM01';
export const ALMACEN_TIPOS = ['Almacén', 'Depósito', 'Oficina'];
export const ARMARIO_TIPOS = ['Armario', 'Estantería', 'Gabinete'];

export const CONTENEDOR_ESPECIAL = 'SC';

const CONTENEDOR_REGLAS_DEFAULT = {
  C: { min: 1, max: 99 },
  B: { min: 0, max: 99 },
  H: { min: 1, max: 99 },
};

/** Sufijo en código completo: A01-E03-C05, A01-E03-B12, A01-E03-SC */
export const CONTENEDOR_SUFIJO_RE = '(?:C\\d{2}|B\\d{2}|H\\d{2}|SC)';

const ALMACEN_RE = /^ALM\d{2}$/i;

let almacenesMap = structuredClone(ALMACENES_DEFAULT);
let catalogRules = {
  estanteMin: 1,
  estanteMax: 9,
  contenedorReglas: { ...CONTENEDOR_REGLAS_DEFAULT },
};

function normalizeArmarioEntry(val) {
  if (typeof val === 'string') return { nombre: val, tipo: 'armario' };
  return {
    nombre: val?.nombre || '',
    tipo: val?.tipo || 'armario',
  };
}

function nextArmarioNumFromMap(armarios = {}) {
  const nums = Object.keys(armarios)
    .map((k) => parseInt(k.replace(/^A/i, ''), 10))
    .filter((n) => !Number.isNaN(n));
  return nums.length ? Math.max(...nums) + 1 : 0;
}

/** Migra armarios globales legacy bajo ALM01 y normaliza estructura anidada. */
export function migrateCatalogoStructure(catalogo) {
  const c = { ...catalogo };
  if (!c.almacenes) c.almacenes = structuredClone(ALMACENES_DEFAULT);

  if (c.armarios && Object.keys(c.armarios).length) {
    const alm01 = c.almacenes.ALM01 || {
      tipo: 'Oficina',
      nombre: 'Oficina principal',
      armarios: {},
    };
    alm01.armarios = alm01.armarios || {};
    for (const [codigo, val] of Object.entries(c.armarios)) {
      if (!alm01.armarios[codigo]) {
        alm01.armarios[codigo] = normalizeArmarioEntry(val);
      }
    }
    if (alm01.nextArmarioNum === undefined) {
      alm01.nextArmarioNum = nextArmarioNumFromMap(alm01.armarios);
    }
    c.almacenes.ALM01 = alm01;
    delete c.armarios;
  }

  for (const code of Object.keys(c.almacenes)) {
    const info = c.almacenes[code];
    if (!info.armarios) info.armarios = {};
    for (const [ac, val] of Object.entries(info.armarios)) {
      info.armarios[ac] = normalizeArmarioEntry(val);
    }
    if (info.nextArmarioNum === undefined) {
      info.nextArmarioNum = nextArmarioNumFromMap(info.armarios);
    }
  }

  return c;
}

export function getContenedorHelpText() {
  return 'C01–C99, B00–B99, H01–H99 o SC (sin contenedor)';
}

export function getContenedorReglas() {
  return catalogRules.contenedorReglas || CONTENEDOR_REGLAS_DEFAULT;
}

export function applyCatalogo(catalogo) {
  const migrated = migrateCatalogoStructure(catalogo || {});
  if (migrated.almacenes) almacenesMap = migrated.almacenes;
  if (migrated) {
    catalogRules = {
      estanteMin: migrated.estanteMin ?? 1,
      estanteMax: migrated.estanteMax ?? 9,
      contenedorReglas: migrated.contenedorReglas || {
        C: {
          min: migrated.contenedorMin ?? CONTENEDOR_REGLAS_DEFAULT.C.min,
          max: migrated.contenedorMax ?? CONTENEDOR_REGLAS_DEFAULT.C.max,
        },
        B: { ...CONTENEDOR_REGLAS_DEFAULT.B, ...migrated.contenedorReglas?.B },
        H: { ...CONTENEDOR_REGLAS_DEFAULT.H, ...migrated.contenedorReglas?.H },
      },
    };
  }
}

export function getArmariosMapForAlmacen(almacen) {
  const code = String(almacen || ALMACEN_DEFAULT).toUpperCase();
  const info = almacenesMap[code];
  if (!info?.armarios) return {};
  const map = {};
  for (const [ac, val] of Object.entries(info.armarios)) {
    map[ac] = normalizeArmarioEntry(val).nombre;
  }
  return map;
}

/** Compatibilidad: armarios de ALM01 (CSV legacy sin columna almacén). */
export function getArmariosMapSync(almacen = ALMACEN_DEFAULT) {
  return getArmariosMapForAlmacen(almacen);
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
  return almacenesMap[code] || { tipo: '', nombre: code, armarios: {} };
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

export function getArmarioInfo(armario, almacen) {
  const ac = String(armario || '').toUpperCase();
  if (!ac) return null;
  const alm = almacen ? normalizeAlmacen(almacen) : null;
  if (alm) {
    const entry = almacenesMap[alm]?.armarios?.[ac];
    return entry ? { ...normalizeArmarioEntry(entry), codigo: ac, almacen: alm } : null;
  }
  for (const [almCode, info] of Object.entries(almacenesMap)) {
    const entry = info?.armarios?.[ac];
    if (entry) {
      return { ...normalizeArmarioEntry(entry), codigo: ac, almacen: almCode };
    }
  }
  return null;
}

export function getArmarioNombre(armario, almacen) {
  const info = getArmarioInfo(armario, almacen);
  return info?.nombre || armario || '';
}

export function listArmarios(almacen) {
  if (almacen) {
    const alm = normalizeAlmacen(almacen);
    const info = almacenesMap[alm];
    return Object.entries(info?.armarios || {}).map(([codigo, val]) => {
      const entry = normalizeArmarioEntry(val);
      return { codigo, nombre: entry.nombre, tipo: entry.tipo, almacen: alm };
    });
  }
  return Object.entries(almacenesMap).flatMap(([almCode, info]) =>
    Object.entries(info?.armarios || {}).map(([codigo, val]) => {
      const entry = normalizeArmarioEntry(val);
      return { codigo, nombre: entry.nombre, tipo: entry.tipo, almacen: almCode };
    })
  );
}

export function listArmariosPorAlmacen() {
  const result = {};
  for (const a of listAlmacenes()) {
    result[a.codigo] = listArmarios(a.codigo);
  }
  return result;
}

export function normalizeArmario(armario, almacen = ALMACEN_DEFAULT) {
  const code = String(armario || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  const alm = normalizeAlmacen(almacen);
  const map = getArmariosMapForAlmacen(alm);
  if (!map[code]) {
    const valid = Object.keys(map);
    throw Object.assign(
      new Error(
        valid.length
          ? `Armario inválido en ${alm}. Usá: ${valid.join(', ')}`
          : `No hay armarios en ${alm}. Agregá uno en Administración.`
      ),
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

function armarioExistsInAlmacen(almacen, armarioCode) {
  return Boolean(getArmariosMapForAlmacen(almacen)[armarioCode]);
}

function buildCodigoSuffix(armario, estante, contenedor, almacen = ALMACEN_DEFAULT) {
  const a = normalizeArmario(armario, almacen);
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

  const suffix = buildCodigoSuffix(armario, estante, contenedor, almacen);
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
  if (armarioOnly && armarioExistsInAlmacen(armarioOnly[1], armarioOnly[2])) {
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
  if (armarioOnly && armarioExistsInAlmacen(ALMACEN_DEFAULT, armarioOnly[1])) {
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

/** Almacén esperado al resolver una ubicación parseada. */
export function expectedAlmacen(parsed) {
  return parsed?.almacen || ALMACEN_DEFAULT;
}

/** Verifica que un contenedor de BD corresponda al almacén de la ubicación pedida. */
export function contenedorMatchesParsed(cont, parsed) {
  if (!cont || !parsed) return false;
  const rowAlm = cont.almacen || ALMACEN_DEFAULT;
  return rowAlm === expectedAlmacen(parsed);
}

/**
 * Variantes de código para búsqueda en BD.
 * Legacy sin prefijo ALM solo para ALM01; otros almacenes usan código con prefijo ALMxx-.
 */
export function codigoLookupVariants(parsed) {
  if (!parsed) return [];
  const variants = new Set();
  if (parsed.codigo) variants.add(parsed.codigo);

  const alm = parsed.almacen || ALMACEN_DEFAULT;
  const { armario, estante, contenedor } = parsed;

  if (armario && estante) {
    const legacy = buildCodigo(armario, estante, contenedor);
    if (alm === ALMACEN_DEFAULT) {
      variants.add(legacy);
    } else {
      variants.add(`${alm}-${legacy}`);
    }
  } else if (armario) {
    if (alm === ALMACEN_DEFAULT) {
      variants.add(armario);
    }
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
  const armarioNombre = getArmarioNombre(armario, almacen);
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
