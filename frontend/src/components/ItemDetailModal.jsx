import { useEffect } from 'react';
import { formatUbicacionLabel } from '../utils/contenedor';

function formatFecha(iso) {
  if (!iso) return '—';
  const d = String(iso).slice(0, 10);
  const [y, m, day] = d.split('-');
  return day && m && y ? `${day}/${m}/${y}` : iso;
}

function herramientaLabel(item) {
  const parts = [item.nombre];
  if (item.marca) {
    parts.push(`${item.marca}${item.modelo ? ` ${item.modelo}` : ''}`);
  }
  return parts.filter(Boolean).join(' · ') || '—';
}

function DetailRow({ label, value, multiline = false }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[7.5rem_1fr] sm:gap-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-subtle">{label}</dt>
      <dd
        className={`text-content ${multiline ? 'break-words whitespace-pre-wrap' : 'break-words'}`}
      >
        {value || '—'}
      </dd>
    </div>
  );
}

export default function ItemDetailModal({
  item,
  isAdmin,
  onClose,
  onEgreso,
  onEdit,
  onDelete,
}) {
  useEffect(() => {
    if (!item) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [item, onClose]);

  if (!item) return null;

  const canEgreso = item.cantidad > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="card max-h-[90vh] w-full max-w-lg overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="item-detail-title"
        aria-modal="true"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <h3 id="item-detail-title" className="section-title leading-snug">
            Detalle del ítem
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1 text-2xl leading-none text-content-muted transition hover:bg-surface-hover hover:text-content"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <dl className="space-y-4 text-sm">
          <DetailRow label="Herramienta" value={herramientaLabel(item)} />
          <DetailRow label="Ubicación" value={formatUbicacionLabel(item)} multiline />
          <DetailRow
            label="Stock"
            value={
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  item.cantidad <= 2
                    ? 'bg-amber-800 text-amber-100'
                    : 'bg-emerald-800 text-emerald-100'
                }`}
              >
                {item.cantidad}
              </span>
            }
          />
          <DetailRow label="Tipo" value={item.tipo} />
          <DetailRow label="Calibración" value={item.calibracion} multiline />
          <DetailRow label="Comentario" value={item.comentario} multiline />
          <DetailRow label="Fecha relev." value={formatFecha(item.fecha_relevamiento)} />
        </dl>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {canEgreso && (
            <button type="button" className="btn-primary min-h-[44px] flex-1 sm:flex-none" onClick={() => onEgreso(item)}>
              Egreso
            </button>
          )}
          {isAdmin && (
            <>
              <button
                type="button"
                className="btn-secondary min-h-[44px] flex-1 sm:flex-none"
                onClick={() => onEdit(item)}
              >
                Editar
              </button>
              <button
                type="button"
                className="min-h-[44px] flex-1 rounded-lg border border-red-700 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-950 sm:flex-none"
                onClick={() => onDelete(item)}
              >
                Eliminar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
