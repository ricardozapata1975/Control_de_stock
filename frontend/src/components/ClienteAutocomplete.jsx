import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

export default function ClienteAutocomplete({ value, onChange, onSelect, disabled = false }) {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const search = (term) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!term.trim()) {
        setSuggestions([]);
        return;
      }
      setLoading(true);
      try {
        const data = await api.clientes(term.trim());
        setSuggestions(data.clientes || []);
        setOpen(true);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 280);
  };

  const handleInput = (e) => {
    const v = e.target.value;
    setQuery(v);
    onChange({ destinatario: v, clienteId: null });
    search(v);
  };

  const pick = (cliente) => {
    setQuery(cliente.nombre);
    setOpen(false);
    onSelect(cliente);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <input
        className="input-field text-base"
        value={query}
        onChange={handleInput}
        onFocus={() => !disabled && suggestions.length && setOpen(true)}
        placeholder="Buscar cliente..."
        autoComplete="off"
        disabled={disabled}
      />
      {loading && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">...</span>
      )}
      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-surface-elevated shadow-lg">
          {suggestions.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-surface-hover"
                onClick={() => pick(c)}
              >
                <span className="font-medium text-content">{c.nombre}</span>
                {c.cuit && (
                  <span className="ml-2 text-xs text-muted">CUIT {c.cuit}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
