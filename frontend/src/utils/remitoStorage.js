const REMITO_NUMBER_KEY = 'px_remito_next_number';
const REMITO_EMPRESA_KEY = 'px_remito_empresa';
const DEFAULT_EMPRESA = 'SYSTELEC S.A.';

export function getNextRemitoNumber() {
  const raw = localStorage.getItem(REMITO_NUMBER_KEY);
  const n = raw ? parseInt(raw, 10) : 1;
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function bumpRemitoNumber() {
  const next = getNextRemitoNumber() + 1;
  localStorage.setItem(REMITO_NUMBER_KEY, String(next));
  return next;
}

export function setRemitoNumber(value) {
  const n = parseInt(value, 10);
  if (Number.isFinite(n) && n > 0) {
    localStorage.setItem(REMITO_NUMBER_KEY, String(n));
  }
}

export function getEmpresaNombre() {
  return localStorage.getItem(REMITO_EMPRESA_KEY) || DEFAULT_EMPRESA;
}

export function setEmpresaNombre(value) {
  const trimmed = String(value || '').trim();
  if (trimmed) localStorage.setItem(REMITO_EMPRESA_KEY, trimmed);
}

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function formatRemitoFecha(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}
