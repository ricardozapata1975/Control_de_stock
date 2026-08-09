import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthProvider';

export default function MaterialesPage() {
  const { sede } = useAuth();
  const [params] = useSearchParams();
  const [proyectos, setProyectos] = useState([]);
  const [proyectoId, setProyectoId] = useState(params.get('proyectoId') || '');
  const [tableroId, setTableroId] = useState(params.get('tableroId') || '');
  const [tableros, setTableros] = useState([]);
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.proyectos(sede ? { sede } : {}).then((d) => setProyectos(d.proyectos || []));
  }, [sede]);

  useEffect(() => {
    if (!proyectoId) {
      setTableros([]);
      setTableroId('');
      return;
    }
    api.proyecto(proyectoId).then((d) => {
      setTableros(d.tableros || []);
      setTableroId('');
    });
  }, [proyectoId]);

  const load = () => {
    setLoading(true);
    api
      .proyectosMateriales({
        ...(sede ? { sede } : {}),
        ...(proyectoId ? { proyectoId } : {}),
        ...(tableroId ? { tableroId } : {}),
        ...(q ? { q } : {}),
      })
      .then((d) => {
        setRows(d.materiales || []);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sede, proyectoId, tableroId]);

  const resumen = useMemo(() => {
    return {
      lineas: rows.length,
      req: rows.reduce((a, r) => a + Number(r.cantidadRequerida || 0), 0),
      res: rows.reduce((a, r) => a + Number(r.cantidadReservada || 0), 0),
      fal: rows.reduce((a, r) => a + Number(r.cantidadFaltante || 0), 0),
      ent: rows.reduce((a, r) => a + Number(r.cantidadEntregada || 0), 0),
    };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="section-title">Materiales requeridos (BOM)</h2>
        <p className="text-sm text-muted">
          Necesidades por proyecto/tablero: pedido, reserva limbo, faltante y entregado a producción.
        </p>
      </div>

      <div className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
          <label className="text-label">Tablero</label>
          <select
            className="input-field"
            value={tableroId}
            onChange={(e) => setTableroId(e.target.value)}
            disabled={!tableros.length}
          >
            <option value="">Todos</option>
            {tableros.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="text-label">Buscar código / descripción</label>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              load();
            }}
          >
            <input
              className="input-field flex-1"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="MLFB…"
            />
            <button type="submit" className="btn btn-secondary">
              Buscar
            </button>
          </form>
        </div>
      </div>

      <p className="text-sm text-muted">
        {resumen.lineas} líneas · req {resumen.req} · reserv {resumen.res} · falt {resumen.fal} ·
        entreg {resumen.ent}
      </p>

      {error && <div className="alert-error">{error}</div>}
      {loading && <p className="text-muted">Cargando…</p>}
      {!loading && !rows.length && <p className="text-muted">Sin materiales con estos filtros.</p>}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-edge">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-xs uppercase text-content-muted">
              <tr>
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Descripción</th>
                <th className="px-3 py-2">Proyecto</th>
                <th className="px-3 py-2">Tablero</th>
                <th className="px-3 py-2 text-right">Req.</th>
                <th className="px-3 py-2 text-right">Reserv.</th>
                <th className="px-3 py-2 text-right">Falta</th>
                <th className="px-3 py-2 text-right">Entreg.</th>
                <th className="px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className="border-t border-edge">
                  <td className="px-3 py-2 font-mono text-xs">{m.codigoArticulo || '—'}</td>
                  <td className="px-3 py-2">{m.descripcion || '—'}</td>
                  <td className="px-3 py-2">
                    <Link className="text-accent underline" to={`/proyectos/${m.proyectoId}`}>
                      {m.proyectoNombre || '…'}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs">{m.tableroNombre || '—'}</td>
                  <td className="px-3 py-2 text-right">{m.cantidadRequerida}</td>
                  <td className="px-3 py-2 text-right text-accent">{m.cantidadReservada}</td>
                  <td className="px-3 py-2 text-right text-amber-600">{m.cantidadFaltante}</td>
                  <td className="px-3 py-2 text-right">{m.cantidadEntregada}</td>
                  <td className="px-3 py-2">{m.estado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
