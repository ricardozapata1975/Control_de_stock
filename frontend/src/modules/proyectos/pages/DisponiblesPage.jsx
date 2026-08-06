import { useEffect, useState } from 'react';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthProvider';

export default function DisponiblesPage() {
  const { sede } = useAuth();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = (term = q) => {
    setLoading(true);
    api
      .proyectosDisponiblesNetos({
        ...(sede ? { sede } : {}),
        ...(term ? { q: term } : {}),
      })
      .then((d) => {
        setItems(d.items || []);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sede]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="page-title">Materiales disponibles (netos)</h2>
        <p className="text-muted">
          Stock físico de la sede menos reservas activas de Proyectos. Relacionado con el inventario
          general{sede ? ` · sede ${sede}` : ''}.
        </p>
      </div>

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          load(q);
        }}
      >
        <input
          className="input min-w-[200px] flex-1"
          placeholder="Buscar nombre / código…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="submit" className="btn btn-secondary">
          Buscar
        </button>
      </form>

      {error && <p className="text-red-600 dark:text-red-300">{error}</p>}
      {loading && <p className="text-muted">Cargando…</p>}

      {!loading && !items.length && (
        <p className="text-muted">Sin stock neto para mostrar en esta sede.</p>
      )}

      {items.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-edge">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-xs uppercase text-content-muted">
              <tr>
                <th className="px-3 py-2">Artículo</th>
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2 text-right">Físico</th>
                <th className="px-3 py-2 text-right">Reservado</th>
                <th className="px-3 py-2 text-right">Neto</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.itemId} className="border-t border-edge">
                  <td className="px-3 py-2">
                    <div className="font-medium">{it.nombre || it.itemId}</div>
                    <div className="text-xs text-content-muted">
                      {[it.marca, it.modelo, it.tipo].filter(Boolean).join(' · ')}
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{it.codigoFabricante || '—'}</td>
                  <td className="px-3 py-2 text-right">{it.cantidadFisica}</td>
                  <td className="px-3 py-2 text-right">{it.cantidadReservada}</td>
                  <td
                    className={`px-3 py-2 text-right font-semibold ${
                      it.cantidadDisponibleNeta < 0
                        ? 'text-red-600 dark:text-red-300'
                        : it.cantidadDisponibleNeta === 0
                          ? 'text-content-muted'
                          : 'text-emerald-700 dark:text-emerald-300'
                    }`}
                  >
                    {it.cantidadDisponibleNeta}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
