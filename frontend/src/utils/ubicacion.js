export const ARMARIOS = {
  A00: 'Armario Papelería',
  A01: 'Armario Herramientas',
  A02: 'Armario Electrónica',
};

export const ESTANTES = Array.from({ length: 9 }, (_, i) => {
  const codigo = `E${String(i + 1).padStart(2, '0')}`;
  return { codigo, nombre: `Estante ${i + 1}` };
});

export function getArmarioNombre(armario) {
  return ARMARIOS[String(armario || '').toUpperCase()] || armario || '';
}

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

import { normalizeContenedorPreview } from './contenedorCodigo';

/** Vista previa: A01-E03, A01-E03-C05, A01-E03-B12, A01-E03-SC */
export function buildCodigoPreview(armario, estante, contenedor) {
  if (!armario || !estante) return '';
  const a = String(armario).toUpperCase();
  const eRaw = String(estante).toUpperCase();
  const eNum = eRaw.match(/E?(\d{1,2})/);
  if (!eNum) return '';
  const e = `E${String(eNum[1]).padStart(2, '0')}`;
  const c = normalizeContenedorPreview(contenedor);
  if (!c) return `${a}-${e}`;
  return `${a}-${e}-${c}`;
}
