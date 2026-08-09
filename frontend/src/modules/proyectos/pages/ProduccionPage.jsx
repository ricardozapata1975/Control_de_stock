import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthProvider';
import { formatUbicacionLabel } from '../../../utils/ubicacion';

/**
 * Stock físico en el almacén de Producción (materiales retirados para tableros).
 * Al entregar el tablero al cliente, esas líneas deben bajarse de este almacén.
 */
export default function ProduccionPage() {
  const { sede } = useAuth();
  const [catalogo, setCatalogo] = useState(null);
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const produccionAlm = useMemo(() => {
    const list = catalogo?.almacenes || [];
    return list.find((a) => a.esProduccion) || null;
  }, [catalogo]);

  const load = (term = q) => {
    if (!produccionAlm?.codigo) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .inventario({
        ...(sede ? { sede } : {}),
        almacen: produccionAlm.codigo,
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
    let cancelled = false;
    api
      .catalogoUbicacion(sede ? { sede } : {})
      .then((cat) => {
        if (!cancelled) setCatalogo(cat);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [sede]);

  useEffect(() => {
    if (!catalogo) return;
    load('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sede, produccionAlm?.codigo]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="page-title">Materiales en producción</h2>
        <p className="text-muted">
          Materiales ya retirados del depósito general para armar tableros
          {produccionAlm
            ? ` · ${produccionAlm.codigo} — ${produccionAlm.nombre}`
            : ' · el almacén de producción se crea al reiniciar el backend'}
          {sede ? ` · sede ${sede}` : ''}.
        </p>
        <p className="text-sm text-muted">
          Al completar/entregar un tablero al cliente, esas unidades deben eliminarse de este almacén
          (queda trazabilidad en el historial del proyecto).
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
        <button type="submit" className="btn btn-secondary" disabled={!produccionAlm}>
          Buscar
        </button>
      </form>

      {error && <p className="text-red-600 dark:text-red-300">{error}</p>}
      {loading && <p className="text-muted">Cargando…</p>}

      {!loading && !produccionAlm && (
        <p className="text-muted">
          Todavía no hay almacén de producción en el catálogo. Reiniciá el backend para que el
          bootstrap lo cree en Locaciones.
        </p>
      )}

      {!loading && produccionAlm && !items.length && (
        <p className="text-muted">Sin materiales en producción en esta sede.</p>
      )}

      {items.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-edge">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-xs uppercase text-content-muted">
              <tr>
                <th className="px-3 py-2">Artículo</th>
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Ubicación</th>
                <th className="px-3 py-2 text-right">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.stockId || it.id} className="border-t border-edge">
                  <td className="px-3 py-2">
                    <div className="font-medium">{it.nombre || it.itemId}</div>
                    <div className="text-xs text-content-muted">
                      {[it.marca, it.modelo, it.tipo].filter(Boolean).join(' · ')}
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{it.codigoFabricante || '—'}</td>
                  <td className="px-3 py-2 text-xs">{formatUbicacionLabel(it)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{it.cantidad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
