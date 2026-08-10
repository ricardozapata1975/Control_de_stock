import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthProvider';
import { formatFechaDmy } from '../../../utils/fecha';

const ESTADO = {
  completado: { label: 'Devuelto', className: 'bg-emerald-800 text-emerald-100' },
  pendiente_devolucion: { label: 'Prestado', className: 'bg-amber-800 text-amber-100' },
  consumido: { label: 'Consumido', className: 'bg-slate-700 text-slate-100' },
};

export default function HistorialPanolPage() {
  const { sede } = useAuth();
  const [movimientos, setMovimientos] = useState([]);
  const [usuario, setUsuario] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.herramientasHistorial({
        sede,
        usuario: usuario || undefined,
      });
      setMovimientos(data.movimientos || []);
      setError('');
    } catch (e) {
      setError(e.message || 'Error al cargar historial');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sede]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Historial del Pañol</h2>
          <p className="text-sm text-muted">Préstamos (egresos) desde el depósito Herramientas</p>
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
            placeholder="Filtrar por operario…"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
          />
          <button type="submit" className="btn-secondary">
            Filtrar
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
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Herramienta</th>
                <th className="px-3 py-2">Operario</th>
                <th className="px-3 py-2">Cant.</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {movimientos.map((m) => {
                const cfg = ESTADO[m.estadoHistorial] || ESTADO.pendiente_devolucion;
                return (
                  <tr key={m.id} className="border-t border-border">
                    <td className="px-3 py-2 whitespace-nowrap">{formatFechaDmy(m.fecha)}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{m.nombreHerramienta}</div>
                      <div className="text-xs text-muted">{m.contenedorCodigo}</div>
                    </td>
                    <td className="px-3 py-2">{m.usuario}</td>
                    <td className="px-3 py-2 font-mono">{m.cantidad}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cfg.className}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {m.pendiente && (
                        <Link
                          to={`/herramientas/devolver?movimientoId=${encodeURIComponent(m.id)}`}
                          className="text-accent underline"
                        >
                          Devolver
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!movimientos.length && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted">
                    Sin movimientos del Pañol.
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
