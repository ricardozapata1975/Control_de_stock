import { getSupabase } from '../db/supabase.js';
import { config } from '../config.js';
import * as demo from './demoService.js';

export const ITEM_FOTOS_BUCKET = 'item-fotos';
const MAX_BYTES = 1.5 * 1024 * 1024;

function isDemoMode() {
  return config.demoMode;
}

export function publicItemImageUrl(pathOrUrl) {
  const s = String(pathOrUrl || '').trim();
  if (!s) return '';
  if (/^(https?:|data:)/i.test(s)) return s;
  const base = String(config.supabase.url || '').replace(/\/$/, '');
  if (!base) return '';
  return `${base}/storage/v1/object/public/${ITEM_FOTOS_BUCKET}/${s.replace(/^\//, '')}`;
}

function parseImagePayload(body) {
  let raw = body?.imageBase64 ?? body?.imagenBase64 ?? body?.data ?? '';
  let contentType = body?.contentType || body?.mimeType || 'image/jpeg';

  if (typeof raw !== 'string' || !raw.trim()) {
    throw Object.assign(new Error('Imagen requerida (imageBase64)'), { status: 400 });
  }

  const dataUrl = raw.match(/^data:([^;]+);base64,(.+)$/i);
  if (dataUrl) {
    contentType = dataUrl[1] || contentType;
    raw = dataUrl[2];
  }

  raw = raw.replace(/\s/g, '');
  let buffer;
  try {
    buffer = Buffer.from(raw, 'base64');
  } catch {
    throw Object.assign(new Error('Base64 de imagen inválido'), { status: 400 });
  }

  if (!buffer.length) {
    throw Object.assign(new Error('Imagen vacía'), { status: 400 });
  }
  if (buffer.length > MAX_BYTES) {
    throw Object.assign(
      new Error('La imagen es demasiado grande. Usá una foto más chica (máx. ~1.5 MB).'),
      { status: 400 }
    );
  }

  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const ct = String(contentType || 'image/jpeg').toLowerCase();
  if (!allowed.includes(ct) && !ct.startsWith('image/')) {
    throw Object.assign(new Error('Formato de imagen no soportado'), { status: 400 });
  }

  const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg';
  return { buffer, contentType: ct === 'image/jpg' ? 'image/jpeg' : ct, ext };
}

async function deleteStoragePath(supabase, path) {
  if (!path || /^(https?:|data:)/i.test(path)) return;
  await supabase.storage.from(ITEM_FOTOS_BUCKET).remove([path]).catch(() => {});
}

export async function uploadItemImage(itemId, body) {
  if (!itemId) throw Object.assign(new Error('itemId requerido'), { status: 400 });

  const { buffer, contentType, ext } = parseImagePayload(body);

  if (isDemoMode()) {
    return demo.demoUploadItemImage(itemId, {
      dataUrl: `data:${contentType};base64,${buffer.toString('base64')}`,
    });
  }

  const supabase = getSupabase();
  const { data: item, error: e1 } = await supabase
    .from('items')
    .select('id, imagen_path')
    .eq('id', itemId)
    .maybeSingle();
  if (e1) throw Object.assign(new Error(e1.message), { status: 500 });
  if (!item) throw Object.assign(new Error('Ítem no encontrado'), { status: 404 });

  const path = `${itemId}/${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage.from(ITEM_FOTOS_BUCKET).upload(path, buffer, {
    contentType,
    upsert: true,
    cacheControl: '3600',
  });
  if (upErr) {
    throw Object.assign(
      new Error(
        upErr.message.includes('Bucket') || upErr.message.includes('not found')
          ? 'Bucket item-fotos no configurado. Ejecutá supabase/patch-item-fotos.sql'
          : upErr.message
      ),
      { status: 500 }
    );
  }

  const imagenUrl = publicItemImageUrl(path);
  const { error: updErr } = await supabase
    .from('items')
    .update({ imagen_path: path, imagen_url: imagenUrl })
    .eq('id', itemId);
  if (updErr) {
    await deleteStoragePath(supabase, path);
    throw Object.assign(new Error(updErr.message), { status: 500 });
  }

  if (item.imagen_path && item.imagen_path !== path) {
    await deleteStoragePath(supabase, item.imagen_path);
  }

  return { ok: true, itemId, imagenUrl, imagenPath: path };
}

export async function deleteItemImage(itemId) {
  if (!itemId) throw Object.assign(new Error('itemId requerido'), { status: 400 });

  if (isDemoMode()) {
    return demo.demoDeleteItemImage(itemId);
  }

  const supabase = getSupabase();
  const { data: item, error: e1 } = await supabase
    .from('items')
    .select('id, imagen_path')
    .eq('id', itemId)
    .maybeSingle();
  if (e1) throw Object.assign(new Error(e1.message), { status: 500 });
  if (!item) throw Object.assign(new Error('Ítem no encontrado'), { status: 404 });

  if (item.imagen_path) {
    await deleteStoragePath(supabase, item.imagen_path);
  }

  const { error } = await supabase
    .from('items')
    .update({ imagen_path: null, imagen_url: null })
    .eq('id', itemId);
  if (error) throw Object.assign(new Error(error.message), { status: 500 });

  return { ok: true, itemId };
}
