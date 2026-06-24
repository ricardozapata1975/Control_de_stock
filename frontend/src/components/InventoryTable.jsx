import { formatUbicacionLabel } from '../utils/contenedor';

export default function InventoryTable({ items, onRowClick }) {
  if (!items.length) {
    return <p className="card text-center text-muted">Sin resultados</p>;
  }

  return (
    <div className="inventory-table-wrap card p-0">
      <div className="overflow-x-auto">
        <table className="inventory-list-table w-full text-left text-sm">
          <thead className="table-head">
            <tr>
              <th className="w-[38%] px-3 py-2">Herramienta</th>
              <th className="w-[42%] px-3 py-2">Ubicación</th>
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
                  <p className="truncate font-medium text-content" title={item.nombre}>
                    {item.nombre}
                  </p>
                  {item.marca && (
                    <p className="truncate text-xs text-subtle" title={`${item.marca} ${item.modelo || ''}`.trim()}>
                      {item.marca} {item.modelo || ''}
                    </p>
                  )}
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
