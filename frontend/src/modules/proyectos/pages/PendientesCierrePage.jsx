import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthProvider';
import { fieldLabel } from '../../../utils/fieldLabels';

export default function PendientesCierrePage() {
  const { sede } = useAuth();
  const [remitos, setRemitos] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api
      .proyectosRemitosPendientesCierre(sede ? { sede } : {})
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="page-title">Remitos pendientes de cierre</h2>
          <p className="text-muted">
            Transferencias con recepción parcial o abierta: faltan ítems por validar o hubo
            discrepancias registradas.
          </p>
        </div>
        <Link to="/proyectos/transferencias" className="btn btn-primary">
          Continuar recepción
        </Link>
      </div>

      {error && <p className="text-red-600 dark:text-red-300">{error}</p>}
      {loading && <p className="text-muted">Cargando…</p>}
      {!loading && !remitos.length && (
        <p className="text-muted">No hay remitos pendientes de cierre.</p>
      )}

      {remitos.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-edge">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-xs uppercase text-content-muted">
              <tr>
                <th className="px-3 py-2">{fieldLabel('numero')}</th>
                <th className="px-3 py-2">{fieldLabel('ubicacion')}</th>
                <th className="px-3 py-2 text-right">{fieldLabel('cantidadRecibida')}</th>
                <th className="px-3 py-2 text-right">{fieldLabel('cantidadPendiente')}</th>
                <th className="px-3 py-2">{fieldLabel('estado')}</th>
                <th className="px-3 py-2">Informe</th>
              </tr>
            </thead>
            <tbody>
              {remitos.map((r) => (
                <tr key={r.id} className="border-t border-edge">
                  <td className="px-3 py-2">
                    <Link
                      className="font-medium text-sky-700 underline dark:text-sky-300"
                      to={`/proyectos/transferencias?remito=${encodeURIComponent(r.id)}`}
                    >
                      #{r.numero}
                    </Link>
                    <div className="font-mono text-[10px] text-content-muted">{r.id}</div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {r.almacenOrigen} → {r.almacenDestino}
                  </td>
                  <td className="px-3 py-2 text-right">{r.cantidadRecibidaTotal}</td>
                  <td className="px-3 py-2 text-right font-semibold">{r.cantidadPendienteTotal}</td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs dark:bg-amber-900/40">
                      {r.estado}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-content-muted">
                    {r.recepcionInforme?.cierre || (r.recepcionAbiertaAt ? 'abierta' : '—')}
                    {r.recepcionInforme?.faltantes?.length
                      ? ` · ${r.recepcionInforme.faltantes.length} faltante(s)`
                      : ''}
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
