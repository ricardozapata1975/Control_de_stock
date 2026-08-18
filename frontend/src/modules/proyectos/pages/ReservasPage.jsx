import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthProvider';
import { fieldLabel } from '../../../utils/fieldLabels';
import CodigoCatalogoLink from '../../../components/CodigoCatalogoLink';
import { exportReservasExcel } from '../utils/exportReservas';

const TODOS = '';

function itemTitle(r) {
  return r.nombre || r.codigoArticulo || r.codigoFabricante || 'Ítem sin nombre';
}

function itemSubtitle(r) {
  return [r.marca, r.modelo, r.tipo].filter(Boolean).join(' · ');
}

export default function ReservasPage() {
  const { sede } = useAuth();
  const [params] = useSearchParams();
  const [proyectoId, setProyectoId] = useState(params.get('proyectoId') || '');
  const [tableroId, setTableroId] = useState(params.get('tableroId') || '');
  const [proveedor, setProveedor] = useState(TODOS);
  const [reservas, setReservas] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [tableros, setTableros] = useState([]);
  const [error, setError] = useState('');
  const [exportMsg, setExportMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [reasignarId, setReasignarId] = useState(null);
  const [haciaProyectoId, setHaciaProyectoId] = useState('');

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
      const list = d.tableros || [];
      setTableros(list);
      setTableroId((cur) => (list.some((t) => t.id === cur) ? cur : ''));
    });
  }, [proyectoId]);

  const load = () => {
    setLoading(true);
    api
      .proyectosReservas({
        ...(sede ? { sede } : {}),
        ...(proyectoId ? { proyectoId } : {}),
        ...(tableroId ? { tableroId } : {}),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sede, proyectoId, tableroId]);

  const nombreProyecto = (id) => proyectos.find((p) => p.id === id)?.nombre || id?.slice?.(0, 8);

  const proyectoNombreFiltro = proyectoId ? nombreProyecto(proyectoId) : '';
  const tableroNombreFiltro = tableroId
    ? tableros.find((t) => t.id === tableroId)?.nombre || 'Tablero'
    : '';

  const proveedores = useMemo(() => {
    const set = new Set();
    for (const r of reservas) {
      const name = String(r.proveedor || 'Sin proveedor').trim() || 'Sin proveedor';
      set.add(name);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'es'));
  }, [reservas]);

  const filtrados = useMemo(() => {
    if (!proveedor) return reservas;
    return reservas.filter((r) => String(r.proveedor || 'Sin proveedor') === proveedor);
  }, [reservas, proveedor]);

  const hayFiltro = Boolean(proveedor || proyectoId || tableroId);

  const handleExcel = () => {
    setExportMsg('');
    try {
      exportReservasExcel(
        filtrados.map((r) => ({
          ...r,
          proyectoNombre: nombreProyecto(r.proyectoId),
        })),
        {
          sede,
          proveedor: proveedor || 'Todos',
          proyectoNombre: proyectoNombreFiltro || 'Todos',
          tableroNombre: tableroNombreFiltro || 'Todos',
        }
      );
      setExportMsg('Excel descargado.');
    } catch (e) {
      setError(e.message || 'No se pudo exportar.');
    }
  };

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

  return (
    <div className="space-y-4">
      <h2 className="section-title">Reservas (limbo)</h2>
      <p className="text-sm text-muted">
        Material comprometido a proyectos: no figura como disponible neto, pero aún no está
        consumido. Filtrá por proyecto, tablero o proveedor y exportá a Excel.
      </p>

      <div className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="text-label">{fieldLabel('proyecto')}</label>
          <select
            className="input-field"
            value={proyectoId}
            onChange={(e) => {
              setProyectoId(e.target.value);
              setTableroId('');
              setProveedor(TODOS);
            }}
          >
            <option value={TODOS}>Todos</option>
            {proyectos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-label">{fieldLabel('tablero')}</label>
          <select
            className="input-field"
            value={tableroId}
            onChange={(e) => {
              setTableroId(e.target.value);
              setProveedor(TODOS);
            }}
            disabled={!proyectoId}
          >
            <option value={TODOS}>Todos</option>
            {tableros.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
                {t.codigo ? ` (${t.codigo})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-label">{fieldLabel('proveedor')}</label>
          <select
            className="input-field"
            value={proveedor}
            onChange={(e) => setProveedor(e.target.value)}
          >
            <option value={TODOS}>Todos</option>
            {proveedores.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="button"
            className="btn-secondary w-full"
            onClick={handleExcel}
            disabled={loading || !filtrados.length}
            title="Descarga .xlsx con los filtros activos"
          >
            Excel
          </button>
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {exportMsg && <div className="alert-success">{exportMsg}</div>}
      {loading && <p className="text-muted">Cargando…</p>}

      {!loading && (
        <p className="text-sm text-muted">
          {filtrados.length} reserva{filtrados.length === 1 ? '' : 's'}
          {proyectoId ? ` · ${proyectoNombreFiltro}` : ''}
          {tableroId ? ` · ${tableroNombreFiltro}` : ''}
          {proveedor ? ` · ${proveedor}` : ''}
          {' · '}
          {filtrados.reduce((a, r) => a + Number(r.cantidad || 0), 0)} u.
        </p>
      )}

      <ul className="space-y-2">
        {filtrados.map((r) => (
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
                    {fieldLabel('ubicacion')}:{' '}
                    <span className="font-mono text-content">{r.contenedorCodigo}</span>
                  </span>
                )}
                <span>
                  {fieldLabel('cantidad')}: <strong className="text-accent">{r.cantidad}</strong>
                </span>
                <span>
                  {fieldLabel('proveedor')}:{' '}
                  <span className="text-content">{r.proveedor || 'Sin proveedor'}</span>
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
        {!loading && !filtrados.length && (
          <p className="text-muted">
            {reservas.length || hayFiltro ? 'Ninguna reserva con esos filtros.' : 'Sin reservas activas.'}
          </p>
        )}
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
