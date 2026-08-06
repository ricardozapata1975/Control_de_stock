import { useEffect, useState } from 'react';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthProvider';

export default function ReportesPage() {
  const { sede } = useAuth();
  const [proyectos, setProyectos] = useState([]);
  const [proyectoId, setProyectoId] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.proyectos(sede ? { sede } : {}).then((d) => setProyectos(d.proyectos || []));
  }, [sede]);

  const load = () => {
    setLoading(true);
    setError('');
    const params = {
      ...(sede ? { sede } : {}),
      ...(proyectoId ? { proyectoId } : {}),
      ...(desde ? { desde } : {}),
      ...(hasta ? { hasta } : {}),
    };
    api
      .proyectosReportes(params)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sede]);

  const r = data?.resumen || {};

  return (
    <div className="space-y-4">
      <h2 className="section-title">Reportes</h2>
      <p className="text-sm text-muted">
        Indicadores del módulo Proyectos (consumos/reservas/faltantes/devoluciones/movimientos).
      </p>

      <div className="card grid gap-3 sm:grid-cols-4">
        <div>
          <label className="text-label">Proyecto</label>
          <select
            className="input-field"
            value={proyectoId}
            onChange={(e) => setProyectoId(e.target.value)}
          >
            <option value="">Todos</option>
            {proyectos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-label">Desde</label>
          <input type="date" className="input-field" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div>
          <label className="text-label">Hasta</label>
          <input type="date" className="input-field" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        <div className="flex items-end">
          <button type="button" className="btn-primary w-full" onClick={load} disabled={loading}>
            {loading ? 'Cargando…' : 'Actualizar'}
          </button>
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Proyectos activos', r.proyectosActivos],
              ['Reservas activas', r.reservasActivas],
              ['Faltantes', r.faltantesPendientes],
              ['Devoluciones', r.devoluciones],
              ['Herramientas prestadas', r.herramientasPrestadas],
              ['Movimientos (filtro)', r.movimientos],
            ].map(([label, val]) => (
              <div key={label} className="card">
                <p className="text-xs uppercase text-muted">{label}</p>
                <p className="text-2xl font-bold text-accent">{val ?? 0}</p>
              </div>
            ))}
          </div>

          <div className="card">
            <h3 className="section-title mb-2">Cantidades por tipo de movimiento</h3>
            <ul className="space-y-1 text-sm">
              {Object.entries(data.porTipo || {}).map(([tipo, cant]) => (
                <li key={tipo} className="flex justify-between border-b border-border py-1">
                  <span>{tipo}</span>
                  <strong>{cant}</strong>
                </li>
              ))}
              {!Object.keys(data.porTipo || {}).length && (
                <p className="text-muted">Sin movimientos en el período.</p>
              )}
            </ul>
          </div>

          <div className="card">
            <h3 className="section-title mb-2">Movimientos recientes</h3>
            <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
              {(data.recientes || []).map((m) => (
                <li key={m.id} className="border-b border-border py-1">
                  <strong>{m.tipo}</strong> · {m.cantidad ?? '—'} · {m.estadoMaterial || '—'} ·{' '}
                  {m.usuario || '—'}
                  <span className="block text-xs text-muted">
                    {m.createdAt && new Date(m.createdAt).toLocaleString('es-AR')}
                    {m.notas ? ` · ${m.notas}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
