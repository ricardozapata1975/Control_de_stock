import { formatUbicacionLabel } from '../utils/contenedor';

export default function ScanItemActionModal({ item, onClose, onEgreso, onIngreso }) {
  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="card w-full max-w-sm border-amber-700/60"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="scan-item-action-title"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-400">Herramienta seleccionada</p>
        <h3 id="scan-item-action-title" className="section-title mt-1">
          {item.nombre}
        </h3>
        {item.marca && (
          <p className="text-sm text-subtle">
            {item.marca} {item.modelo || ''}
          </p>
        )}
        <p className="mt-2 text-sm text-muted">{formatUbicacionLabel(item)}</p>
        <p className="font-mono text-xs text-amber-300">{item.contenedorCodigo}</p>
        <p className="mt-1 text-sm">
          Stock disponible: <strong className="text-amber-200">{item.cantidad}</strong>
        </p>

        <div className="mt-5 grid gap-3">
          <button type="button" className="btn-primary w-full" onClick={onEgreso}>
            EGRESO
          </button>
          <button
            type="button"
            className="btn-secondary w-full border-amber-600 text-amber-100"
            onClick={onIngreso}
          >
            INGRESO
          </button>
          <button type="button" className="text-sm text-slate-300 underline hover:text-white" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
