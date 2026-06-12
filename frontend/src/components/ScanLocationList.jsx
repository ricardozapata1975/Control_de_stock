import { formatUbicacionLabel } from '../utils/contenedor';
import { QR_TYPES } from '../utils/qrPayload';

export default function ScanLocationList({ parsed, items, selectable = false, onSelectItem }) {
  if (!items?.length) {
    return <p className="text-sm text-muted">No hay herramientas en esta ubicación.</p>;
  }

  const showUbicacion =
    parsed?.type === QR_TYPES.ARMARIO || parsed?.type === QR_TYPES.ESTANTE;

  return (
    <div className="rounded-lg border border-border bg-surface-muted">
      <p className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-content-muted">
        Contenido ({items.length})
        {selectable && (
          <span className="ml-2 font-normal normal-case text-sky-300/90">
            · Tocá una herramienta
          </span>
        )}
      </p>
      <ul className="max-h-56 divide-y divide-border overflow-y-auto">
        {items.map((item) => {
          const inner = (
            <>
              <div className="min-w-0">
                <p className="font-medium text-content">{item.nombre}</p>
                {item.tipo && <p className="text-xs text-subtle">{item.tipo}</p>}
                {showUbicacion && (
                  <p className="font-mono text-xs text-accent">{item.contenedorCodigo}</p>
                )}
                {!showUbicacion && parsed?.type !== QR_TYPES.CONTENEDOR && (
                  <p className="text-xs text-subtle">{formatUbicacionLabel(item)}</p>
                )}
              </div>
              <span
                className={`shrink-0 rounded px-2 py-0.5 text-xs font-bold ${
                  item.cantidad <= 0
                    ? 'bg-red-900 text-red-100'
                    : item.cantidad <= 2
                      ? 'bg-amber-800 text-amber-100'
                      : 'bg-emerald-800 text-emerald-100'
                }`}
              >
                {item.cantidad}
              </span>
            </>
          );

          if (selectable) {
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-2 px-3 py-2 text-left text-sm transition hover:bg-surface-hover active:bg-surface-hover"
                  onClick={() => onSelectItem?.(item)}
                >
                  {inner}
                </button>
              </li>
            );
          }

          return (
            <li key={item.id} className="flex items-start justify-between gap-2 px-3 py-2 text-sm">
              {inner}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
