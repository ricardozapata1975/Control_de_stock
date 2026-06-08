import { getArmarioNombre } from './ubicacion';
export {
  buildQrPayload,
  extractContenedorIdFromScan,
  parseQrScan,
  QR_TYPES,
  qrTypeLabel,
} from './qrPayload.js';

export function formatUbicacionLabel(item) {
  if (!item) return '—';
  if (item.ubicacionLabel) return item.ubicacionLabel;
  const parts = [
    item.armarioNombre || getArmarioNombre(item.armario) || item.ubicacion,
    item.estante,
    item.contenedor,
  ].filter(Boolean);
  return parts.join(' / ') || '—';
}
