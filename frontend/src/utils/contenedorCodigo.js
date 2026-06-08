/** Reglas de contenedor (alineadas con backend/ubicacionUtils.js) */
export const CONTENEDOR_ESPECIAL = 'SC';

const REGLAS = {
  C: { min: 1, max: 99 },
  B: { min: 0, max: 99 },
  H: { min: 1, max: 99 },
};

export const CONTENEDOR_HELP = 'C01–C99, B00–B99, H01–H99 o SC';

export function normalizeContenedorPreview(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const upper = s.toUpperCase().replace(/\s+/g, '');
  if (upper === CONTENEDOR_ESPECIAL || /^sin\s*contenedor$/i.test(s)) return CONTENEDOR_ESPECIAL;

  const m = upper.match(/^([CBH])(\d{1,2})$/);
  if (m) {
    const pref = m[1];
    const n = parseInt(m[2], 10);
    const r = REGLAS[pref];
    if (r && n >= r.min && n <= r.max) {
      return `${pref}${String(n).padStart(2, '0')}`;
    }
    return null;
  }

  const legacy = upper.match(/^C?(\d{1,2})$/);
  if (legacy) {
    const n = parseInt(legacy[1], 10);
    if (n >= REGLAS.C.min && n <= REGLAS.C.max) {
      return `C${String(n).padStart(2, '0')}`;
    }
  }
  return null;
}
