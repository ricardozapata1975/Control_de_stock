import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthProvider';
import { fieldLabel } from '../../../utils/fieldLabels';
import CodigoCatalogoLink from '../../../components/CodigoCatalogoLink';

function itemTitle(r) {
  return r.nombre || r.codigoArticulo || r.codigoFabricante || 'Ítem sin nombre';
}

function itemSubtitle(r) {
  return [r.marca, r.modelo, r.tipo].filter(Boolean).join(' · ');
}

export default function ReservasPage() {
  const { sede } = useAuth();
  const [params] = useSearchParams();
  const proyectoId = params.get('proyectoId') || '';
  const [reservas, setReservas] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reasignarId, setReasignarId] = useState(null);
  const [haciaProyectoId, setHaciaProyectoId] = useState('');

  const load = () => {
    setLoading(true);
    api
      .proyectosReservas({
        ...(sede ? { sede } : {}),
        ...(proyectoId ? { proyectoId } : {}),
        estado: 'activa',
      })
      .then((d) => {
        setReservas(d.reservas || []);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    api.proyectos(sede ? { sede } : {}).then((d) => setProyectos(d.proyectos || []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sede, proyectoId]);

  const liberar = async (id) => {
    try {
      await api.liberarReservaProyecto(id);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const reasignar = async () => {
    if (!reasignarId || !haciaProyectoId) return;
    try {
      await api.reasignarReservaProyecto(reasignarId, { haciaProyectoId });
      setReasignarId(null);
      setHaciaProyectoId('');
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const nombreProyecto = (id) => proyectos.find((p) => p.id === id)?.nombre || id?.slice?.(0, 8);

  return (
    <div className="space-y-4">
      <h2 className="section-title">Reservas (limbo)</h2>
      <p className="text-sm text-muted">
        Material comprometido a proyectos: no figura como disponible neto, pero aún no está
        consumido.
      </p>
      {error && <div className="alert-error">{error}</div>}
      {loading && <p className="text-muted">Cargando…</p>}

      <ul className="space-y-2">
        {reservas.map((r) => (
          <li key={r.id} className="card flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
                {nombreProyecto(r.proyectoId)}
                {r.tableroNombre ? ` · ${r.tableroNombre}` : ''}
              </p>
              <p className="font-semibold text-content">{itemTitle(r)}</p>
              {itemSubtitle(r) ? <p className="text-xs text-muted">{itemSubtitle(r)}</p> : null}
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                {(r.codigoFabricante || r.codigoArticulo) && (
                  <span>
                    {fieldLabel('codigo')}:{' '}
                    <CodigoCatalogoLink
                      codigo={r.codigoFabricante || r.codigoArticulo}
                      className="text-content"
                    />
                  </span>
                )}
                {r.contenedorCodigo && (
                  <span>
                    {fieldLabel('ubicacion')}: <span className="font-mono text-content">{r.contenedorCodigo}</span>
                  </span>
                )}
                <span>
                  {fieldLabel('cantidad')}: <strong className="text-accent">{r.cantidad}</strong>
                </span>
              </div>
              {r.detalle ? (
                <p className="line-clamp-2 text-xs text-muted">{r.detalle}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 gap-2">
              <button type="button" className="btn-secondary text-sm" onClick={() => liberar(r.id)}>
                Liberar
              </button>
              <button
                type="button"
                className="btn-primary text-sm"
                onClick={() => setReasignarId(r.id)}
              >
                Reasignar
              </button>
            </div>
          </li>
        ))}
        {!loading && !reservas.length && <p className="text-muted">Sin reservas activas.</p>}
      </ul>

      {reasignarId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="card w-full max-w-md space-y-3">
            <h3 className="section-title">Reasignar reserva</h3>
            <select
              className="input-field"
              value={haciaProyectoId}
              onChange={(e) => setHaciaProyectoId(e.target.value)}
            >
              <option value="">Proyecto destino…</option>
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} ({p.prioridad})
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button type="button" className="btn-primary flex-1" onClick={reasignar}>
                Confirmar
              </button>
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => setReasignarId(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
