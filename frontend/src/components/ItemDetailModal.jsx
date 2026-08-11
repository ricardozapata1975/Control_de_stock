import { useEffect } from 'react';
import { formatUbicacionLabel } from '../utils/contenedor';

function formatFecha(iso) {
  if (!iso) return null;
  const d = String(iso).slice(0, 10);
  const [y, m, day] = d.split('-');
  return day && m && y ? `${day}/${m}/${y}` : iso;
}

function herramientaLabel(item) {
  const parts = [item.nombre];
  if (item.marca) {
    parts.push(`${item.marca}${item.modelo ? ` ${item.modelo}` : ''}`);
  }
  return parts.filter(Boolean).join(' · ') || null;
}

function display(val) {
  if (val === 0) return '0';
  if (val == null || val === '') return null;
  return val;
}

function formatPrecio(item) {
  if (item.precioLista == null || item.precioLista === '') return null;
  const n = Number(item.precioLista);
  if (!Number.isFinite(n)) return null;
  const moneda = item.moneda ? ` ${item.moneda}` : '';
  return `${n}${moneda}`;
}

function clasificacionLabel(item) {
  const parts = [item.tema, item.familia, item.subfamilia].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

function DetailRow({ label, value, multiline = false }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[7.5rem_1fr] sm:gap-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-subtle">{label}</dt>
      <dd
        className={`text-content ${multiline ? 'break-words whitespace-pre-wrap' : 'break-words'}`}
      >
        {value ?? '—'}
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
  onAssignBarcode,
  onAssignPhoto,
  viewOnly = false,
  stockBreakdown = null,
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

  const canEgreso = !viewOnly && typeof onEgreso === 'function' && item.cantidad > 0;
  const showActions = !viewOnly;

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

        {item.imagenUrl ? (
          <div className="mb-5 overflow-hidden rounded-lg border border-border bg-slate-950">
            <img
              src={item.imagenUrl}
              alt={item.nombre}
              className="mx-auto max-h-56 w-full object-contain"
            />
          </div>
        ) : null}

        <dl className="space-y-4 text-sm">
          <DetailRow label="Herramienta" value={herramientaLabel(item)} />
          <DetailRow label="Ubicación" value={formatUbicacionLabel(item)} multiline />
          {stockBreakdown ? (
            <>
              <DetailRow label="Físico" value={display(stockBreakdown.fisico)} />
              <DetailRow label="Reservado" value={display(stockBreakdown.reservado)} />
              <DetailRow
                label="Neto"
                value={
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      Number(stockBreakdown.neto) < 0
                        ? 'bg-red-900 text-red-100'
                        : Number(stockBreakdown.neto) === 0
                          ? 'bg-slate-700 text-slate-100'
                          : 'bg-emerald-800 text-emerald-100'
                    }`}
                  >
                    {stockBreakdown.neto}
                  </span>
                }
              />
            </>
          ) : (
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
          )}
          {Array.isArray(item.ubicaciones) && item.ubicaciones.length > 0 ? (
            <DetailRow
              label="Ubicaciones"
              multiline
              value={item.ubicaciones
                .map(
                  (u) =>
                    `${u.contenedorCodigo || [u.almacen, u.armario, u.estante, u.contenedor].filter(Boolean).join('-') || '—'} (${u.cantidad})`
                )
                .join('\n')}
            />
          ) : null}
          <DetailRow label="Tipo" value={display(item.tipo)} />
          <DetailRow label="Detalle" value={display(item.detalle)} multiline />
          <DetailRow
            label="Cód. fabricante"
            value={
              item.codigoFabricante ? (
                <span className="font-mono">{item.codigoFabricante}</span>
              ) : (
                'Sin asignar'
              )
            }
          />
          <DetailRow label="Calibración" value={display(item.calibracion)} multiline />
          <DetailRow label="Comentario" value={display(item.comentario)} multiline />
          <DetailRow
            label="Fecha relev."
            value={formatFecha(item.fechaRelevamiento || item.fecha_relevamiento)}
          />

          <div className="border-t border-border pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Catálogo</p>
          </div>
          <DetailRow label="Clasificación" value={clasificacionLabel(item)} multiline />
          <DetailRow label="Tema" value={display(item.tema)} />
          <DetailRow label="Familia" value={display(item.familia)} />
          <DetailRow label="Subfamilia" value={display(item.subfamilia)} />
          <DetailRow label="Unidad" value={display(item.unidad)} />
          <DetailRow label="Packing / MOQ" value={display(item.packing)} />
          <DetailRow label="Precio lista" value={formatPrecio(item)} />
          <DetailRow
            label="Peso"
            value={item.pesoKg != null && item.pesoKg !== '' ? `${item.pesoKg} kg` : null}
          />
          <DetailRow label="Fuente catálogo" value={display(item.catalogoFuente)} />
          <DetailRow label="Vigencia" value={display(item.catalogoVigencia)} />
        </dl>

        {showActions && (
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {canEgreso && (
              <button
                type="button"
                className="btn-primary min-h-[44px] flex-1 sm:flex-none"
                onClick={() => onEgreso(item)}
              >
                Egreso
              </button>
            )}
            <button
              type="button"
              className="btn-secondary min-h-[44px] flex-1 sm:flex-none"
              onClick={() => onAssignPhoto?.(item)}
            >
              {item.imagenUrl ? 'Cambiar foto' : 'Agregar foto'}
            </button>
            <button
              type="button"
              className="btn-secondary min-h-[44px] flex-1 sm:flex-none"
              onClick={() => onAssignBarcode?.(item)}
            >
              {item.codigoFabricante ? 'Cambiar código de barras' : 'Agregar código de barras'}
            </button>
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
        )}
      </div>
    </div>
  );
}
