import { useEffect, useId, useMemo, useRef, useState } from 'react';

/**
 * Lista filtrable por texto (contiene, sin distinguir mayúsculas).
 * options: { value, label, searchText? }
 */
export default function FilterableSelect({
  options = [],
  value,
  onChange,
  placeholder = 'Escribí para filtrar…',
  emptyMessage = 'Sin coincidencias',
  disabled = false,
  id: idProp,
}) {
  const autoId = useId();
  const id = idProp || autoId;
  const listRef = useRef(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (selected && !open) {
      setQuery(selected.label);
    }
    if (!value && !open) setQuery('');
  }, [selected, value, open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const hay = (o.searchText || o.label || '').toLowerCase();
      return hay.includes(q);
    });
  }, [options, query]);

  const pick = (opt) => {
    onChange(opt.value);
    setQuery(opt.label);
    setOpen(false);
  };

  const onInputChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    setOpen(true);
    if (value) {
      const still = options.find(
        (o) => o.value === value && (o.searchText || o.label || '').toLowerCase().includes(v.trim().toLowerCase())
      );
      if (!still) onChange('');
    }
  };

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        className="input-field"
        placeholder={placeholder}
        value={query}
        disabled={disabled}
        autoComplete="off"
        onChange={onInputChange}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setTimeout(() => setOpen(false), 180);
        }}
      />
      {open && !disabled && (
        <ul
          ref={listRef}
          className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-surface-elevated shadow-xl"
          role="listbox"
        >
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-subtle">{emptyMessage}</li>
          ) : (
            filtered.map((opt) => (
              <li key={opt.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={opt.value === value}
                  className={`w-full px-4 py-3 text-left text-sm transition hover:bg-surface-hover ${
                    opt.value === value ? 'bg-accent/20 text-accent' : 'text-content'
                  }`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(opt)}
                >
                  {opt.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
      {value && selected && !open && (
        <p className="mt-1 text-xs text-emerald-300">Seleccionado</p>
      )}
    </div>
  );
}
