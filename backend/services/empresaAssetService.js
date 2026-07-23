import { getSupabase } from '../db/supabase.js';
import { config } from '../config.js';
import * as demo from './demoService.js';

export const EMPRESA_ASSETS_BUCKET = 'empresa-assets';
const MAX_BYTES = 1.5 * 1024 * 1024;

function isDemoMode() {
  return config.demoMode;
}

export function publicEmpresaAssetUrl(pathOrUrl) {
  const s = String(pathOrUrl || '').trim();
  if (!s) return '';
  if (/^(https?:|data:)/i.test(s)) return s;
  const base = String(config.supabase.url || '').replace(/\/$/, '');
  if (!base) return '';
  return `${base}/storage/v1/object/public/${EMPRESA_ASSETS_BUCKET}/${s.replace(/^\//, '')}`;
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
      new Error('La imagen es demasiado grande (máx. ~1.5 MB).'),
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
  await supabase.storage.from(EMPRESA_ASSETS_BUCKET).remove([path]).catch(() => {});
}

/**
 * @param {'logo'|'firma'} kind
 */
export async function uploadEmpresaAsset(empresaId, kind, body) {
  if (!empresaId) throw Object.assign(new Error('empresaId requerido'), { status: 400 });
  if (kind !== 'logo' && kind !== 'firma') {
    throw Object.assign(new Error('Tipo de asset inválido (logo|firma)'), { status: 400 });
  }

  const { buffer, contentType, ext } = parseImagePayload(body);
  const pathCol = kind === 'logo' ? 'logo_path' : 'firma_path';
  const urlCol = kind === 'logo' ? 'logo_url' : 'firma_url';

  if (isDemoMode()) {
    const dataUrl = `data:${contentType};base64,${buffer.toString('base64')}`;
    return demo.demoUploadEmpresaAsset(empresaId, kind, dataUrl);
  }

  const supabase = getSupabase();
  const { data: row, error: e1 } = await supabase
    .from('empresas_emisoras')
    .select(`id, ${pathCol}`)
    .eq('id', empresaId)
    .maybeSingle();
  if (e1) throw Object.assign(new Error(e1.message), { status: 500 });
  if (!row) throw Object.assign(new Error('Empresa no encontrada'), { status: 404 });

  const path = `${empresaId}/${kind}-${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage.from(EMPRESA_ASSETS_BUCKET).upload(path, buffer, {
    contentType,
    upsert: true,
    cacheControl: '3600',
  });
  if (upErr) {
    throw Object.assign(
      new Error(
        /bucket|not found/i.test(upErr.message || '')
          ? 'Bucket empresa-assets no configurado. Ejecutá supabase/patch-agenda.sql'
          : upErr.message
      ),
      { status: 500 }
    );
  }

  const url = publicEmpresaAssetUrl(path);
  const { error: updErr } = await supabase
    .from('empresas_emisoras')
    .update({ [pathCol]: path, [urlCol]: url })
    .eq('id', empresaId);
  if (updErr) {
    await deleteStoragePath(supabase, path);
    throw Object.assign(new Error(updErr.message), { status: 500 });
  }

  const oldPath = row[pathCol];
  if (oldPath && oldPath !== path) await deleteStoragePath(supabase, oldPath);

  return {
    ok: true,
    empresaId,
    kind,
    url,
    path,
    ...(kind === 'logo' ? { logoUrl: url, logoPath: path } : { firmaUrl: url, firmaPath: path }),
  };
}

export async function deleteEmpresaAsset(empresaId, kind) {
  if (!empresaId) throw Object.assign(new Error('empresaId requerido'), { status: 400 });
  if (kind !== 'logo' && kind !== 'firma') {
    throw Object.assign(new Error('Tipo de asset inválido (logo|firma)'), { status: 400 });
  }

  const pathCol = kind === 'logo' ? 'logo_path' : 'firma_path';
  const urlCol = kind === 'logo' ? 'logo_url' : 'firma_url';

  if (isDemoMode()) {
    return demo.demoDeleteEmpresaAsset(empresaId, kind);
  }

  const supabase = getSupabase();
  const { data: row, error } = await supabase
    .from('empresas_emisoras')
    .select(`id, ${pathCol}`)
    .eq('id', empresaId)
    .maybeSingle();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  if (!row) throw Object.assign(new Error('Empresa no encontrada'), { status: 404 });

  await deleteStoragePath(supabase, row[pathCol]);
  const { error: updErr } = await supabase
    .from('empresas_emisoras')
    .update({ [pathCol]: null, [urlCol]: null })
    .eq('id', empresaId);
  if (updErr) throw Object.assign(new Error(updErr.message), { status: 500 });

  return { ok: true, empresaId, kind };
}
