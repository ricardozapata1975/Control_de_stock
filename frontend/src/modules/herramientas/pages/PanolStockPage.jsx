import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthProvider';
import { formatUbicacionLabel } from '../../../utils/ubicacion';

export default function PanolStockPage() {
  const { sede } = useAuth();
  const [items, setItems] = useState([]);
  const [panol, setPanol] = useState(null);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.herramientasStock({ sede, q: q || undefined });
      setItems(data.items || []);
      setPanol(data.panol || null);
      setError('');
    } catch (e) {
      setError(e.message || 'Error al cargar stock');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sede]);

  const visibles = useMemo(() => items.filter((i) => i.cantidad > 0), [items]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Stock del Pañol</h2>
          {panol && (
            <p className="text-sm text-muted">
              Almacén <span className="font-mono">{panol.almacen}</span>
            </p>
          )}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
        >
          <input
            className="input"
            placeholder="Buscar…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button type="submit" className="btn-secondary">
            Buscar
          </button>
        </form>
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}
      {loading ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-surface text-muted">
              <tr>
                <th className="px-3 py-2">Herramienta</th>
                <th className="px-3 py-2">Cant.</th>
                <th className="px-3 py-2">Ubicación</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {visibles.map((i) => (
                <tr key={i.id || i.stockId} className="border-t border-border">
                  <td className="px-3 py-2">
                    <div className="font-medium">{i.nombre}</div>
                    <div className="text-xs text-muted">
                      {[i.marca, i.modelo, i.tipo].filter(Boolean).join(' · ')}
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono">{i.cantidad}</td>
                  <td className="px-3 py-2 text-xs">
                    {formatUbicacionLabel(i) || i.contenedorCodigo || '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      to={`/herramientas/prestar?stockId=${encodeURIComponent(i.id || i.stockId)}`}
                      className="text-accent underline"
                    >
                      Prestar
                    </Link>
                  </td>
                </tr>
              ))}
              {!visibles.length && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted">
                    Sin stock en el Pañol. Usá «Recibir en Pañol» para mover herramientas
                    compartidas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
