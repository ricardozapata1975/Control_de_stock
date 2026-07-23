/**
 * Comprime una imagen del archivo/cámara a JPEG de baja resolución (para miniatura).
 * @returns {Promise<{ dataUrl: string, base64: string, contentType: string, width: number, height: number }>}
 */
export async function compressImageFile(file, { maxEdge = 480, quality = 0.72 } = {}) {
  if (!file) throw new Error('No hay archivo de imagen');

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close?.();
    throw new Error('No se pudo procesar la imagen');
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  const base64 = dataUrl.split(',')[1] || '';
  if (!base64) throw new Error('No se pudo comprimir la imagen');

  return {
    dataUrl,
    base64,
    contentType: 'image/jpeg',
    width,
    height,
  };
}

export function revokePreviewUrl(url) {
  if (url && String(url).startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}
