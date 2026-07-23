import { formatUbicacionLabel } from '../utils/contenedor';

function ItemThumb({ item }) {
  if (item.imagenUrl) {
    return (
      <img
        src={item.imagenUrl}
        alt=""
        className="h-11 w-11 shrink-0 rounded-md object-cover bg-slate-900 ring-1 ring-border"
        loading="lazy"
      />
    );
  }
  return (
    <div
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-surface-muted text-[10px] font-bold uppercase text-subtle ring-1 ring-border"
      aria-hidden
    >
      {(item.nombre || '?').slice(0, 2)}
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
    <div className="inventory-table-wrap card p-0">
      <div className="overflow-x-auto">
        <table className="inventory-list-table w-full text-left text-sm">
          <thead className="table-head">
            <tr>
              <th className="w-[44%] px-3 py-2">Herramienta</th>
              <th className="w-[36%] px-3 py-2">Ubicación</th>
              <th className="w-[20%] px-3 py-2 text-right">Stock</th>
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
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ItemThumb item={item} />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-content" title={item.nombre}>
                        {item.nombre}
                      </p>
                      {item.marca && (
                        <p
                          className="truncate text-xs text-subtle"
                          title={`${item.marca} ${item.modelo || ''}`.trim()}
                        >
                          {item.marca} {item.modelo || ''}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 align-middle table-cell-muted">
                  <span className="line-clamp-2 break-words" title={formatUbicacionLabel(item)}>
                    {formatUbicacionLabel(item)}
                  </span>
                </td>
                <td className="px-3 py-2 align-middle text-right">
                  <span
                    className={`badge-stock ${
                      item.cantidad <= 2
                        ? 'bg-amber-800 text-amber-100'
                        : 'bg-emerald-800 text-emerald-100'
                    }`}
                  >
                    {item.cantidad}
                  </span>
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
