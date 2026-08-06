import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthProvider';
import { prioridadClass } from '../constants';

export default function FaltantesPage() {
  const { sede } = useAuth();
  const [params] = useSearchParams();
  const proyectoId = params.get('proyectoId') || '';
  const [faltantes, setFaltantes] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.proyectosFaltantes({
        ...(sede ? { sede } : {}),
        ...(proyectoId ? { proyectoId } : {}),
      }),
      api.proyectos(sede ? { sede } : {}),
    ])
      .then(([f, p]) => {
        setFaltantes(f.faltantes || []);
        setProyectos(p.proyectos || []);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [sede, proyectoId]);

  const nombreProyecto = (id) => proyectos.find((p) => p.id === id)?.nombre || id?.slice?.(0, 8);

  return (
    <div className="space-y-4">
      <h2 className="section-title">Faltantes</h2>
      <p className="text-sm text-muted">
        Materiales que no se pudieron reservar. Al ingresar stock (fase siguiente) se sugerirá
        asignación automática.
      </p>
      {error && <div className="alert-error">{error}</div>}
      {loading && <p className="text-muted">Cargando…</p>}

      <ul className="space-y-2">
        {faltantes.map((f) => (
          <li key={f.id} className="card">
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <p className="font-mono font-semibold text-accent">{f.codigoArticulo || '—'}</p>
                <p className="text-sm text-muted">
                  <Link className="underline" to={`/proyectos/${f.proyectoId}`}>
                    {nombreProyecto(f.proyectoId)}
                  </Link>
                  {' · '}
                  <span className={prioridadClass(f.prioridad)}>{f.prioridad}</span>
                  {f.fechaLimite ? ` · límite ${f.fechaLimite}` : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-amber-600">{f.cantidad}</p>
                <p className="text-xs text-muted">{f.estado}</p>
              </div>
            </div>
          </li>
        ))}
        {!loading && !faltantes.length && <p className="text-muted">Sin faltantes pendientes.</p>}
      </ul>
    </div>
  );
}
