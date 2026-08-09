import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthProvider';
import { prioridadClass } from '../constants';

export default function TablerosPage() {
  const { sede } = useAuth();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api
      .proyectosTableros({ ...(sede ? { sede } : {}), ...(q ? { q } : {}) })
      .then((d) => {
        setRows(d.tableros || []);
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
      <div>
        <h2 className="section-title">Tableros</h2>
        <p className="text-sm text-muted">
          Todos los tableros de la sede. Desde acá entrás al armado o al detalle del proyecto.
        </p>
      </div>

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <input
          className="input-field max-w-xs"
          placeholder="Buscar tablero / proyecto…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="submit" className="btn btn-secondary">
          Buscar
        </button>
      </form>

      {error && <div className="alert-error">{error}</div>}
      {loading && <p className="text-muted">Cargando…</p>}

      {!loading && !rows.length && <p className="text-muted">Sin tableros en esta sede.</p>}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-edge">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-xs uppercase text-content-muted">
              <tr>
                <th className="px-3 py-2">Tablero</th>
                <th className="px-3 py-2">Proyecto</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Prioridad</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-t border-edge">
                  <td className="px-3 py-2">
                    <div className="font-medium">{t.nombre}</div>
                    {t.codigo && <div className="font-mono text-xs text-muted">{t.codigo}</div>}
                  </td>
                  <td className="px-3 py-2">
                    <Link className="text-accent underline" to={`/proyectos/${t.proyectoId}`}>
                      {t.proyectoNombre || t.proyectoId}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{t.estado}</td>
                  <td className={`px-3 py-2 ${prioridadClass(t.prioridad)}`}>{t.prioridad}</td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      className="btn-secondary text-xs"
                      to={`/proyectos/produccion?proyectoId=${t.proyectoId}&tableroId=${t.id}`}
                    >
                      Armar
                    </Link>
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
