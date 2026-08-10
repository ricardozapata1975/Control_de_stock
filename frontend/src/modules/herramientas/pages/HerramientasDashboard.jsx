import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthProvider';
import { hasPermission } from '../../../utils/permissions';
import { HERRAMIENTAS_NAV } from '../constants';

export default function HerramientasDashboard() {
  const { user, sede } = useAuth();
  const [panol, setPanol] = useState(null);
  const [stats, setStats] = useState({ stock: 0, pendientes: 0 });
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [p, s, pend] = await Promise.all([
          api.herramientasPanol(sede ? { sede } : {}),
          api.herramientasStock(sede ? { sede } : {}),
          api.herramientasPendientes(sede ? { sede } : {}),
        ]);
        if (cancelled) return;
        setPanol(p.panol || s.panol);
        setStats({
          stock: (s.items || []).filter((i) => i.cantidad > 0).length,
          pendientes: pend.total || (pend.movimientos || []).length,
        });
        setError('');
      } catch (e) {
        if (!cancelled) setError(e.message || 'No se pudo cargar el Pañol');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sede]);

  const cards = HERRAMIENTAS_NAV.filter(
    (a) => a.to !== '/herramientas' && hasPermission(user, a.permission)
  );

  return (
    <div className="space-y-6">
      {error && <p className="rounded-md bg-red-900/40 px-3 py-2 text-sm text-red-100">{error}</p>}

      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">Depósito de la sede</h2>
        {panol ? (
          <p className="mt-1 text-sm text-muted">
            <span className="font-mono text-fg">{panol.almacen}</span>
            {' · '}
            {panol.armario}/{panol.estante}/{panol.contenedor}
            {sede ? ` · ${sede}` : ''}
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted">Cargando…</p>
        )}
        <div className="mt-4 flex flex-wrap gap-4">
          <div className="rounded-md bg-bg px-4 py-3">
            <div className="text-2xl font-bold">{stats.stock}</div>
            <div className="text-xs text-muted">Ítems con stock</div>
          </div>
          <div className="rounded-md bg-bg px-4 py-3">
            <div className="text-2xl font-bold">{stats.pendientes}</div>
            <div className="text-xs text-muted">Pendientes de devolución</div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="rounded-lg border border-border bg-surface p-4 transition hover:border-accent"
          >
            <div className="font-semibold">{c.label}</div>
            <p className="mt-1 text-sm text-muted">{c.desc}</p>
          </Link>
        ))}
      </div>

      <p className="text-sm text-muted">
        Flujo: recibí herramientas compartidas en el Pañol → prestá a un operario (egreso / caja
        completa con remito interno) → devolvé con ingreso. El historial queda en el mismo
        sistema de movimientos.
      </p>
    </div>
  );
}
