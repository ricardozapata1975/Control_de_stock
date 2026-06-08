/** Formato día/mes/año (DD/MM/AAAA) desde ISO o AAAA-MM-DD */
export function formatFechaDmy(iso) {
  if (!iso) return '—';
  const d = String(iso).slice(0, 10);
  const [y, m, day] = d.split('-');
  if (day && m && y) return `${day}/${m}/${y}`;
  return String(iso);
}
