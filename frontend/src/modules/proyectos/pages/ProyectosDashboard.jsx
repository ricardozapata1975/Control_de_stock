import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthProvider';
import AccesosMenuTable from '../../../components/AccesosMenuTable';
import { KPI_DEFS, PROYECTOS_NAV } from '../constants';

export default function ProyectosDashboard() {
  const { sede } = useAuth();
  const [kpis, setKpis] = useState(null);
  const [alertas, setAlertas] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.proyectosDashboard(sede ? { sede } : {}),
      api.proyectosAlertas(sede ? { sede } : {}).catch(() => ({ alertas: [] })),
    ])
      .then(([dash, al]) => {
        if (cancelled) return;
        setKpis(dash.kpis || {});
        setAlertas(al.alertas || []);
        setError('');
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || 'No se pudo cargar el dashboard');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sede]);

  return (
    <div className="space-y-6">
      {error && <div className="alert-error">{error}</div>}

      <section>
        <h2 className="section-title mb-3">Indicadores</h2>
        {loading && <p className="text-muted">Cargando KPIs…</p>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {KPI_DEFS.map((k) => (
            <div key={k.key} className="card border-accent/30">
              <p className="text-xs uppercase tracking-wide text-muted">{k.label}</p>
              <p className="mt-1 text-2xl font-bold text-accent">
                {kpis ? kpis[k.key] ?? 0 : '—'}
              </p>
            </div>
          ))}
        </div>
      </section>

      {alertas.length > 0 && (
        <section className="card border-amber-500/40">
          <h2 className="section-title mb-2">Alertas activas</h2>
          <ul className="space-y-2 text-sm">
            {alertas.slice(0, 8).map((a) => (
              <li key={a.id} className="border-b border-border pb-1">
                <span
                  className={
                    a.severidad === 'critical'
                      ? 'font-semibold text-red-500'
                      : 'text-amber-600 dark:text-amber-300'
                  }
                >
                  {a.mensaje}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="section-title mb-1">Menú de accesos</h2>
        <p className="mb-3 text-sm text-muted">
          Menú principal y accesos rápidos de Inventario, Agenda y Proyectos.
        </p>
        <AccesosMenuTable />
      </section>

      <section>
        <h2 className="section-title mb-3">Accesos del módulo Proyectos</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {PROYECTOS_NAV.map((item) => (
            <Link
              key={item.to}
              to={item.soon ? '/proyectos' : item.to}
              className={`card transition hover:border-accent ${
                item.soon ? 'opacity-70' : 'border-accent/40'
              }`}
              onClick={(e) => {
                if (item.soon) {
                  e.preventDefault();
                }
              }}
            >
              <p className="text-lg font-semibold text-content">
                <span className="mr-2" aria-hidden>
                  {item.icon}
                </span>
                {item.label}
              </p>
              <p className="mt-1 text-sm text-muted">
                {item.desc}
                {item.soon ? ' · Fase posterior' : ''}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
