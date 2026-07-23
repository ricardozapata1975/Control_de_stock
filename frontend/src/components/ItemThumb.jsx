import { useEffect, useState } from 'react';

/**
 * Miniatura de ítem: foto o iniciales.
 * Si hay foto, al tocarla abre vista previa ampliada (solo cerrar).
 */
export default function ItemThumb({ item, size = 'md', className = '' }) {
  const [open, setOpen] = useState(false);
  const sizeClass = size === 'lg' ? 'h-14 w-14 text-xs' : 'h-11 w-11 text-[10px]';
  const initials = String(item?.nombre || '?')
    .trim()
    .slice(0, 2)
    .toUpperCase();
  const hasImage = Boolean(item?.imagenUrl);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const openPreview = (e) => {
    if (!hasImage) return;
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  };

  return (
    <>
      {hasImage ? (
        <button
          type="button"
          onClick={openPreview}
          className={`shrink-0 rounded-md p-0 ring-1 ring-border transition hover:ring-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${className}`}
          aria-label={`Ver foto de ${item?.nombre || 'ítem'}`}
          title="Ver foto"
        >
          <img
            src={item.imagenUrl}
            alt=""
            className={`${sizeClass} rounded-md object-cover bg-slate-900`}
            loading="lazy"
          />
        </button>
      ) : (
        <div
          className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-md bg-surface-muted font-bold uppercase text-subtle ring-1 ring-border ${className}`}
          aria-hidden
        >
          {initials}
        </div>
      )}

      {open && hasImage && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            className="flex w-full max-w-lg flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Vista previa de la foto"
          >
            <div className="overflow-hidden rounded-xl border border-border bg-slate-950 shadow-2xl">
              <img
                src={item.imagenUrl}
                alt={item?.nombre || 'Foto del producto'}
                className="mx-auto max-h-[75vh] w-full object-contain"
              />
            </div>
            {item?.nombre && (
              <p className="text-center text-sm font-medium text-white/90">{item.nombre}</p>
            )}
            <button
              type="button"
              className="btn-secondary mx-auto min-h-[48px] w-full max-w-xs"
              onClick={() => setOpen(false)}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
