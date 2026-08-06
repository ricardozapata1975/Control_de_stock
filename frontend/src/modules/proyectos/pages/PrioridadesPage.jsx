import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthProvider';
import { prioridadClass } from '../constants';

export default function PrioridadesPage() {
  const { sede } = useAuth();
  const [proyectos, setProyectos] = useState([]);
  const [faltantes, setFaltantes] = useState([]);
  const [reservas, setReservas] = useState([]);

  useEffect(() => {
    const f = sede ? { sede } : {};
    Promise.all([
      api.proyectos({ ...f, estado: 'activo' }),
      api.proyectosFaltantes(f),
      api.proyectosReservas({ ...f, estado: 'activa' }),
    ]).then(([p, fal, res]) => {
      setProyectos(p.proyectos || []);
      setFaltantes(fal.faltantes || []);
      setReservas(res.reservas || []);
    });
  }, [sede]);

  const orden = useMemo(() => {
    const rank = { critica: 0, alta: 1, media: 2, baja: 3 };
    return [...proyectos].sort(
      (a, b) => (rank[a.prioridad] ?? 9) - (rank[b.prioridad] ?? 9)
    );
  }, [proyectos]);

  const comprometidos = reservas.reduce((s, r) => s + Number(r.cantidad || 0), 0);

  return (
    <div className="space-y-4">
      <h2 className="section-title">Prioridades / criticidad</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card">
          <p className="text-xs text-muted">Proyectos activos</p>
          <p className="text-2xl font-bold text-accent">{proyectos.length}</p>
        </div>
        <div className="card">
          <p className="text-xs text-muted">Materiales comprometidos</p>
          <p className="text-2xl font-bold">{comprometidos}</p>
        </div>
        <div className="card">
          <p className="text-xs text-muted">Faltantes (reasignables vía reservas)</p>
          <p className="text-2xl font-bold text-amber-600">{faltantes.length}</p>
        </div>
      </div>

      <ul className="space-y-2">
        {orden.map((p) => (
          <li key={p.id} className="card flex justify-between gap-2">
            <div>
              <Link to={`/proyectos/${p.id}`} className="font-semibold underline">
                {p.nombre}
              </Link>
              <p className="text-sm text-muted">
                Objetivo {p.fechaObjetivo || '—'} · {p.faltantesCount || 0} faltantes
              </p>
            </div>
            <span className={`font-bold uppercase ${prioridadClass(p.prioridad)}`}>
              {p.prioridad}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
