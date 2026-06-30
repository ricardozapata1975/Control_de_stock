/** Utilidades de fecha para remitos */

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function formatRemitoFecha(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}
