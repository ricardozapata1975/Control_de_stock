import { useState } from 'react';
import { formatUbicacionLabel } from '../utils/contenedor';

export default function LowStockAlert({ items }) {
  const zeroStock = (items || []).filter((i) => Number(i.cantidad) === 0);
  const [open, setOpen] = useState(false);

  if (!zeroStock.length) return null;

  return (
    <div className="alert-warning mb-4 overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <h2 className="section-title mb-0">Sin stock (0 u.)</h2>
          {!open && (
            <p className="mt-1 truncate text-sm text-amber-100/90">
              {zeroStock.length} ítem{zeroStock.length !== 1 ? 's' : ''} sin unidades — tocá para ver
            </p>
          )}
        </div>
        <span
          className="shrink-0 rounded-full bg-amber-800 px-3 py-1 text-sm font-bold text-amber-100"
          aria-hidden
        >
          {zeroStock.length}
        </span>
        <span className="shrink-0 text-amber-200" aria-hidden>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto border-t border-amber-700/50 pt-3">
          {zeroStock.map((i) => (
            <li key={i.id} className="flex justify-between gap-2 text-amber-50">
              <span className="min-w-0 truncate">
                {i.nombre} — {formatUbicacionLabel(i)}
              </span>
              <span className="shrink-0 font-bold text-red-300">0 u.</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
