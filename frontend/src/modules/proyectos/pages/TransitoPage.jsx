import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthProvider';

export default function TransitoPage() {
  const { sede } = useAuth();
  const [remitos, setRemitos] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api
      .proyectosTransito(sede ? { sede } : {})
      .then((d) => {
        setRemitos(d.remitos || []);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sede]);

  const lineas = remitos.flatMap((r) =>
    (r.items || [])
      .filter((i) => i.cantidadPendiente > 0)
      .map((i) => ({
        ...i,
        remitoId: r.id,
        remitoNumero: r.numero,
        estado: r.estado,
        almacenOrigen: r.almacenOrigen,
        almacenDestino: r.almacenDestino,
        createdAt: r.createdAt,
      }))
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="page-title">Materiales en tránsito</h2>
          <p className="text-muted">
            Stock que salió del origen al crear el remito de transferencia y aún no se recibió en
            destino. Actúa como almacén virtual de tránsito.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/proyectos/transferencias" className="btn btn-primary">
            Recibir transferencia
          </Link>
          <Link to="/proyectos/pendientes-cierre" className="btn btn-secondary">
            Pendientes de cierre
          </Link>
        </div>
      </div>

      {error && <p className="text-red-600 dark:text-red-300">{error}</p>}
      {loading && <p className="text-muted">Cargando…</p>}
      {!loading && !lineas.length && (
        <p className="text-muted">No hay ítems en tránsito{sede ? ` para ${sede}` : ''}.</p>
      )}

      {lineas.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-edge">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-xs uppercase text-content-muted">
              <tr>
                <th className="px-3 py-2">Remito</th>
                <th className="px-3 py-2">Ítem</th>
                <th className="px-3 py-2">Origen → Destino</th>
                <th className="px-3 py-2 text-right">Pendiente</th>
                <th className="px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((l) => (
                <tr key={`${l.remitoId}-${l.id}`} className="border-t border-edge">
                  <td className="px-3 py-2">
                    <Link
                      className="font-medium text-sky-700 underline dark:text-sky-300"
                      to={`/proyectos/transferencias?remito=${encodeURIComponent(l.remitoId)}`}
                    >
                      #{l.remitoNumero}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <div>{l.nombre || l.itemId}</div>
                    <div className="text-xs text-content-muted">
                      Recibido {l.cantidadRecibida}/{l.cantidad}
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {l.almacenOrigen || '—'} → {l.almacenDestino || '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">{l.cantidadPendiente}</td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs dark:bg-amber-900/40">
                      {l.estado}
                    </span>
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
