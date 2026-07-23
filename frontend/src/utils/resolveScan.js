/**
 * Resuelve un texto escaneado (QR interno, ubicación o código fabricante)
 * contra el inventario vía API.
 */
import { api } from '../api/client';
import { QR_TYPES, parseQrScan } from '../utils/qrPayload';

function pickBestStockRows(items) {
  if (!items?.length) return [];
  const withStock = items.filter((i) => Number(i.cantidad) > 0);
  return withStock.length ? withStock : items;
}

export async function resolveScanToInventario(scanOrText) {
  const parsed =
    typeof scanOrText === 'string'
      ? parseQrScan(scanOrText) || { type: 'raw', raw: String(scanOrText).trim() }
      : scanOrText;

  if (!parsed) {
    return { ok: false, error: 'Código vacío', items: [], raw: '' };
  }

  const raw =
    parsed.raw ||
    parsed.codigo ||
    parsed.itemId ||
    (typeof scanOrText === 'string' ? scanOrText.trim() : '');

  try {
    if (parsed.type === QR_TYPES.ITEM && parsed.itemId) {
      const data = await api.inventario({ itemId: parsed.itemId });
      const items = pickBestStockRows(data.items || []);
      if (!items.length) {
        return { ok: false, error: 'Ítem sin stock en inventario', items: [], raw, parsed };
      }
      return { ok: true, items, raw, parsed, matchType: 'item' };
    }

    if (parsed.type && parsed.type !== 'raw' && parsed.codigo) {
      try {
        const cont = await api.contenedor(parsed.codigo);
        const items = pickBestStockRows(cont.items || []);
        if (items.length) {
          return { ok: true, items, raw, parsed, matchType: 'ubicacion' };
        }
      } catch {
        /* seguir con código fabricante */
      }
    }

    const code = String(raw || '').trim();
    if (!code) {
      return { ok: false, error: 'Código vacío', items: [], raw: '' };
    }

    const byFab = await api.inventario({ codigoFabricante: code });
    const fabItems = pickBestStockRows(byFab.items || []);
    if (fabItems.length) {
      return { ok: true, items: fabItems, raw: code, parsed, matchType: 'fabricante' };
    }

    // Fallback: búsqueda libre por el texto
    const byQ = await api.inventario({ q: code });
    const qItems = (byQ.items || []).filter(
      (i) =>
        String(i.codigoFabricante || '').trim().toLowerCase() === code.toLowerCase() ||
        String(i.itemId || '') === code
    );
    if (qItems.length) {
      return { ok: true, items: pickBestStockRows(qItems), raw: code, parsed, matchType: 'fabricante' };
    }

    return {
      ok: false,
      error: `No se encontró un ítem con el código «${code}»`,
      items: [],
      raw: code,
      parsed,
    };
  } catch (err) {
    return {
      ok: false,
      error: err.message || 'Error al buscar el código',
      items: [],
      raw,
      parsed,
    };
  }
}
