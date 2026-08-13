import { formatUbicacionLabel } from '../utils/contenedor';
import { fieldLabel } from '../utils/fieldLabels';
import ItemThumb from './ItemThumb';

function StockBadge({ cantidad }) {
  return (
    <span
      className={`badge-stock ${
        cantidad <= 2 ? 'bg-amber-800 text-amber-100' : 'bg-emerald-800 text-emerald-100'
      }`}
    >
      {cantidad}
    </span>
  );
}

function ItemText({ item }) {
  return (
    <div className="min-w-0 flex-1 overflow-hidden">
      <p className="break-words font-medium leading-snug text-content" title={item.nombre}>
        {item.nombre}
      </p>
      {item.marca && (
        <p
          className="mt-0.5 break-words text-xs text-subtle"
          title={`${item.marca} ${item.modelo || ''}`.trim()}
        >
          {item.marca} {item.modelo || ''}
        </p>
      )}
    </div>
  );
}

export default function InventoryTable({ items, onRowClick, loading = false }) {
  if (loading && !items.length) {
    return <p className="card text-center text-muted">Cargando inventario...</p>;
  }

  if (!items.length) {
    return <p className="card text-center text-muted">Sin resultados</p>;
  }

  return (
    <div className="inventory-table-wrap card w-full min-w-0 max-w-full overflow-hidden p-0">
      {/* Móvil: tarjetas (evita que la tabla se salga de la pantalla) */}
      <ul className="divide-y divide-border md:hidden">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="flex w-full min-w-0 max-w-full items-start gap-2.5 px-3 py-3 text-left transition hover:bg-surface-hover/60"
              onClick={() => onRowClick?.(item)}
              aria-label={`Ver detalle de ${item.nombre}`}
            >
              <ItemThumb item={item} />
              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="flex items-start gap-2">
                  <ItemText item={item} />
                  <div className="shrink-0 pt-0.5">
                    <StockBadge cantidad={item.cantidad} />
                  </div>
                </div>
                <p className="mt-1 break-words text-xs text-content-muted" title={formatUbicacionLabel(item)}>
                  {formatUbicacionLabel(item)}
                </p>
              </div>
            </button>
          </li>
        ))}
      </ul>

      {/* Desktop: tabla */}
      <div className="hidden overflow-x-auto md:block">
        <table className="inventory-list-table w-full table-fixed text-left text-sm">
          <thead className="table-head">
            <tr>
              <th className="w-[44%] px-3 py-2">{fieldLabel('nombre')}</th>
              <th className="w-[36%] px-3 py-2">{fieldLabel('ubicacion')}</th>
              <th className="w-[20%] px-3 py-2 text-right">{fieldLabel('cantidad')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="table-row cursor-pointer"
                onClick={() => onRowClick?.(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onRowClick?.(item);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`Ver detalle de ${item.nombre}`}
              >
                <td className="px-3 py-2 align-middle">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <ItemThumb item={item} />
                    <ItemText item={item} />
                  </div>
                </td>
                <td className="px-3 py-2 align-middle table-cell-muted">
                  <span className="line-clamp-2 break-words" title={formatUbicacionLabel(item)}>
                    {formatUbicacionLabel(item)}
                  </span>
                </td>
                <td className="px-3 py-2 align-middle text-right">
                  <StockBadge cantidad={item.cantidad} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="border-t border-border px-3 py-2 text-xs text-subtle">
        Tocá una fila para ver el detalle completo.
      </p>
    </div>
  );
}
