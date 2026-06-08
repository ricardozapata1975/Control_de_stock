import { useEffect, useRef, useState } from 'react';
import { formatUbicacionLabel } from '../utils/contenedor';

const FIXED_WIDTH = 332;
const COL_WIDTH = 96;

const FIXED_COLS = [
  { key: 'herramienta', label: 'Herramienta', width: 140, left: 0 },
  { key: 'ubicacion', label: 'Ubicación', width: 120, left: 140 },
  { key: 'stock', label: 'Stock', width: 72, left: 260 },
];

const SCROLL_COLUMNS = [
  { key: 'tipo', label: 'Tipo', minWidth: 0 },
  { key: 'calibracion', label: 'Calibración', minWidth: 96 },
  { key: 'comentario', label: 'Comentario', minWidth: 192 },
  { key: 'fecha', label: 'Fecha relev.', minWidth: 288 },
  { key: 'acciones', label: 'Acciones', minWidth: 384, adminOnly: true },
];

function formatFecha(iso) {
  if (!iso) return '—';
  const d = String(iso).slice(0, 10);
  const [y, m, day] = d.split('-');
  return day && m && y ? `${day}/${m}/${y}` : iso;
}

function cellFixed(col) {
  return {
    left: `${col.left}px`,
    minWidth: col.width,
    maxWidth: col.width,
  };
}

function renderScrollCell(col, item, { isAdmin, onEdit, onDelete }) {
  switch (col.key) {
    case 'tipo':
      return (
        <td key={col.key} className="inventory-col-scroll px-4 py-3 table-cell-muted">
          {item.tipo || '—'}
        </td>
      );
    case 'calibracion':
      return (
        <td key={col.key} className="inventory-col-scroll px-4 py-3 table-cell-muted">
          {item.calibracion || '—'}
        </td>
      );
    case 'comentario':
      return (
        <td
          key={col.key}
          className="inventory-col-scroll max-w-[200px] px-4 py-3 text-sm text-subtle"
        >
          {item.comentario || '—'}
        </td>
      );
    case 'fecha':
      return (
        <td key={col.key} className="inventory-col-scroll px-4 py-3 table-cell-muted text-sm">
          {formatFecha(item.fecha_relevamiento)}
        </td>
      );
    case 'acciones':
      if (!isAdmin) return null;
      return (
        <td key={col.key} className="inventory-col-scroll px-4 py-3 min-w-[140px]">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border border-slate-500 px-3 py-1.5 text-sm font-semibold text-slate-100 hover:bg-slate-800"
              onClick={() => onEdit?.(item)}
            >
              Editar
            </button>
            <button
              type="button"
              className="rounded-lg border border-red-700 px-3 py-1.5 text-sm font-semibold text-red-200 hover:bg-red-950"
              onClick={() => onDelete?.(item)}
            >
              Eliminar
            </button>
          </div>
        </td>
      );
    default:
      return null;
  }
}

export default function InventoryTable({ items, isAdmin, onEdit, onDelete }) {
  const wrapRef = useRef(null);
  const [visibleScroll, setVisibleScroll] = useState(SCROLL_COLUMNS.length);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const extra = Math.max(0, w - FIXED_WIDTH);
      let count = Math.floor(extra / COL_WIDTH);
      const max = SCROLL_COLUMNS.filter((c) => !c.adminOnly || isAdmin).length;
      setVisibleScroll(Math.min(max, Math.max(0, count)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isAdmin]);

  if (!items.length) {
    return <p className="card text-center text-muted">Sin resultados</p>;
  }

  const scrollCols = SCROLL_COLUMNS.filter((c) => !c.adminOnly || isAdmin).slice(0, visibleScroll);
  const stockCol = FIXED_COLS[2];

  return (
    <div ref={wrapRef} className="inventory-table-wrap card p-0">
      <div className="inventory-table-scroll">
        <table className="inventory-table w-full text-left">
          <thead className="table-head">
            <tr>
              {FIXED_COLS.map((col) => (
                <th key={col.key} className="inventory-col-fixed px-4 py-3" style={cellFixed(col)}>
                  {col.label}
                </th>
              ))}
              {scrollCols.map((col) => (
                <th key={col.key} className="inventory-col-scroll px-4 py-3">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="table-row">
                <td className="inventory-col-fixed px-4 py-3" style={cellFixed(FIXED_COLS[0])}>
                  <p className="font-medium text-white">{item.nombre}</p>
                  {item.marca && (
                    <p className="text-xs text-subtle">
                      {item.marca} {item.modelo || ''}
                    </p>
                  )}
                </td>
                <td
                  className="inventory-col-fixed px-4 py-3 table-cell-muted"
                  style={cellFixed(FIXED_COLS[1])}
                >
                  {formatUbicacionLabel(item)}
                </td>
                <td className="inventory-col-fixed px-4 py-3" style={cellFixed(stockCol)}>
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
                {scrollCols.map((col) => renderScrollCell(col, item, { isAdmin, onEdit, onDelete }))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-slate-700 px-3 py-2 text-xs text-subtle">
        Columnas fijas: Herramienta, Ubicación y Stock. Deslizá para ver Tipo, Calibración y más.
      </p>
    </div>
  );
}
