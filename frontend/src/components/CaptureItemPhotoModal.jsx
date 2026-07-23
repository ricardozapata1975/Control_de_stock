import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { compressImageFile, revokePreviewUrl } from '../utils/imageCompress';

/**
 * Flujo: tomar/elegir foto → preview → Aceptar / Reintentar → subir.
 */
export default function CaptureItemPhotoModal({ item, onClose, onSaved }) {
  const fileRef = useRef(null);
  const [step, setStep] = useState('menu'); // menu | preview | uploading
  const [previewUrl, setPreviewUrl] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    return () => revokePreviewUrl(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !uploading) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, uploading]);

  if (!item) return null;

  const clearPreview = () => {
    revokePreviewUrl(previewUrl);
    setPreviewUrl('');
    setPendingFile(null);
  };

  const onFilePicked = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('El archivo no es una imagen');
      return;
    }
    clearPreview();
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setPendingFile(file);
    setError('');
    setStep('preview');
  };

  const handleAccept = async () => {
    if (!pendingFile) return;
    setUploading(true);
    setError('');
    try {
      const compressed = await compressImageFile(pendingFile, { maxEdge: 480, quality: 0.72 });
      const result = await api.adminUploadItemImage(item.itemId, {
        imageBase64: compressed.base64,
        contentType: compressed.contentType,
      });
      onSaved?.({ ...item, imagenUrl: result.imagenUrl });
      onClose();
    } catch (err) {
      setError(err.message || 'No se pudo subir la foto');
      setStep('preview');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!item.imagenUrl) return;
    if (!window.confirm('¿Quitar la foto de este ítem?')) return;
    setUploading(true);
    setError('');
    try {
      await api.adminDeleteItemImage(item.itemId);
      onSaved?.({ ...item, imagenUrl: '' });
      onClose();
    } catch (err) {
      setError(err.message || 'No se pudo quitar la foto');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
      onClick={uploading ? undefined : onClose}
      role="presentation"
    >
      <div
        className="card max-h-[90vh] w-full max-w-md overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-photo-title"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 id="item-photo-title" className="section-title">
              Foto del producto
            </h3>
            <p className="mt-1 text-sm text-muted">{item.nombre}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="shrink-0 rounded-lg p-1 text-2xl leading-none text-content-muted transition hover:bg-surface-hover"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        {item.imagenUrl && step === 'menu' && (
          <div className="mb-4 overflow-hidden rounded-lg border border-border">
            <img
              src={item.imagenUrl}
              alt={item.nombre}
              className="mx-auto max-h-48 w-full object-contain bg-slate-950"
            />
          </div>
        )}

        {error && <p className="mb-3 text-sm text-amber-800 dark:text-amber-200">{error}</p>}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onFilePicked}
        />

        {step === 'menu' && (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              className="btn-primary min-h-[48px]"
              onClick={() => fileRef.current?.click()}
            >
              {item.imagenUrl ? 'Cambiar foto' : 'Tomar / elegir foto'}
            </button>
            {item.imagenUrl && (
              <button
                type="button"
                className="min-h-[44px] rounded-lg border border-red-700 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-950"
                disabled={uploading}
                onClick={handleRemove}
              >
                Quitar foto
              </button>
            )}
            <button type="button" className="btn-secondary min-h-[44px]" onClick={onClose}>
              Cancelar
            </button>
            <p className="text-xs text-subtle">
              En el celular se abre la cámara. La foto se guarda en baja resolución para reconocer
              el ítem en el listado.
            </p>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-lg border border-emerald-700/40 bg-slate-950">
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Vista previa"
                  className="mx-auto max-h-72 w-full object-contain"
                />
              )}
            </div>
            <p className="text-sm font-semibold text-emerald-200">Vista previa de la foto</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className="btn-primary min-h-[48px] flex-1"
                disabled={uploading}
                onClick={handleAccept}
              >
                {uploading ? 'Subiendo…' : 'Aceptar'}
              </button>
              <button
                type="button"
                className="btn-secondary min-h-[48px] flex-1"
                disabled={uploading}
                onClick={() => {
                  clearPreview();
                  setStep('menu');
                  setTimeout(() => fileRef.current?.click(), 50);
                }}
              >
                Reintentar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
