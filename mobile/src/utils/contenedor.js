export function extractContenedorId(text) {
  const s = String(text || '').trim();
  const urlMatch = s.match(/contenedor\/([A-Za-z0-9]+-[A-Za-z0-9]+-[A-Za-z0-9]+)/i);
  if (urlMatch) return urlMatch[1].toUpperCase();
  const direct = s.match(/([A-Z][A-Z0-9]{2,}-[A-Z0-9]+-[A-Z0-9]+)/i);
  if (direct) return direct[1].toUpperCase();
  const plain = s.match(/^([A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+)$/i);
  if (plain) return plain[1].toUpperCase();
  return null;
}
