import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthProvider';
import { prioridadClass } from '../constants';
import { fieldLabel } from '../../../utils/fieldLabels';
import CodigoCatalogoLink from '../../../components/CodigoCatalogoLink';
import { exportFaltantesExcel } from '../utils/exportFaltantes';

const TODOS = '';

export default function FaltantesPage() {
  const { sede } = useAuth();
  const [params] = useSearchParams();
  const [proyectoId, setProyectoId] = useState(params.get('proyectoId') || '');
  const [tableroId, setTableroId] = useState(params.get('tableroId') || '');
  const [faltantes, setFaltantes] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [tableros, setTableros] = useState([]);
  const [proveedor, setProveedor] = useState(TODOS);
  const [error, setError] = useState('');
  const [exportMsg, setExportMsg] = useState('');
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
      const list = d.tableros || [];
      setTableros(list);
      setTableroId((cur) => (list.some((t) => t.id === cur) ? cur : ''));
    });
  }, [proyectoId]);

  useEffect(() => {
    setLoading(true);
    api
      .proyectosFaltantes({
        ...(sede ? { sede } : {}),
        ...(proyectoId ? { proyectoId } : {}),
        ...(tableroId ? { tableroId } : {}),
      })
      .then((f) => {
        setFaltantes(f.faltantes || []);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [sede, proyectoId, tableroId]);

  const nombreProyecto = (id, fallbackNombre) =>
    fallbackNombre || proyectos.find((p) => p.id === id)?.nombre || id?.slice?.(0, 8);

  const proyectoNombreFiltro = proyectoId ? nombreProyecto(proyectoId) : 'Todos';
  const tableroNombreFiltro = tableroId
    ? tableros.find((t) => t.id === tableroId)?.nombre || 'Tablero'
    : 'Todos';

  const proveedores = useMemo(() => {
    const set = new Set();
    for (const f of faltantes) {
      const name = String(f.proveedor || 'Sin proveedor').trim() || 'Sin proveedor';
      set.add(name);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'es'));
  }, [faltantes]);

  const filtrados = useMemo(() => {
    if (!proveedor) return faltantes;
    return faltantes.filter((f) => String(f.proveedor || 'Sin proveedor') === proveedor);
  }, [faltantes, proveedor]);

  const handleExcel = () => {
    setExportMsg('');
    try {
      exportFaltantesExcel(filtrados, {
        sede,
        proveedor: proveedor || 'Todos',
        proyectoNombre: proyectoNombreFiltro,
        tableroNombre: tableroNombreFiltro,
      });
      setExportMsg('Excel descargado.');
    } catch (e) {
      setError(e.message || 'No se pudo exportar.');
    }
  };

  const hayFiltro = Boolean(proveedor || proyectoId || tableroId);

  return (
    <div className="space-y-4">
      <h2 className="section-title">Faltantes</h2>
      <p className="text-sm text-muted">
        Materiales que no se pudieron reservar. Filtrá por proyecto, tablero o proveedor y exportá a
        Excel para la gestión de compra. Al ingresar stock se sugerirá asignación automática.
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
          {filtrados.length} línea{filtrados.length === 1 ? '' : 's'}
          {proyectoId ? ` · ${proyectoNombreFiltro}` : ''}
          {tableroId ? ` · ${tableroNombreFiltro}` : ''}
          {proveedor ? ` · ${proveedor}` : ''}
          {' · '}
          {filtrados.reduce((a, f) => a + Number(f.cantidadPendiente ?? f.cantidad ?? 0), 0)}{' '}
          pendiente
        </p>
      )}

      <ul className="space-y-2">
        {filtrados.map((f) => {
          const titulo = f.descripcion || f.nombre || f.codigoArticulo || 'Sin descripción';
          const meta = [f.marca, f.modelo, f.tipo].filter(Boolean).join(' · ');
          return (
            <li key={f.id} className="card">
              <div className="flex flex-wrap justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-accent">
                    <CodigoCatalogoLink codigo={f.codigoArticulo || f.codigoFabricante} />
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-content">{titulo}</p>
                  {f.detalle && f.detalle !== titulo ? (
                    <p className="mt-0.5 text-sm text-muted">{f.detalle}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted">
                    {fieldLabel('proveedor')}:{' '}
                    <span className="text-content">{f.proveedor || 'Sin proveedor'}</span>
                    {meta ? ` · ${meta}` : ''}
                    {f.unidad ? ` · ${f.unidad}` : ''}
                  </p>
                  <p className="text-sm text-muted">
                    <Link className="underline" to={`/proyectos/${f.proyectoId}`}>
                      {nombreProyecto(f.proyectoId, f.proyectoNombre)}
                    </Link>
                    {f.tableroNombre ? ` · ${f.tableroNombre}` : ''}
                    {' · '}
                    <span className={prioridadClass(f.prioridad)}>{f.prioridad}</span>
                    {f.fechaLimite ? ` · límite ${f.fechaLimite}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-amber-600">
                    {f.cantidadPendiente ?? f.cantidad}
                  </p>
                  <p className="text-xs text-muted">{f.estado}</p>
                  {Number(f.cantidadCubierta || 0) > 0 ? (
                    <p className="text-xs text-muted">
                      {f.cantidadCubierta}/{f.cantidad} cubierta
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
        {!loading && !filtrados.length && (
          <p className="text-muted">
            {faltantes.length || hayFiltro
              ? 'Ningún faltante con esos filtros.'
              : 'Sin faltantes pendientes.'}
          </p>
        )}
      </ul>
    </div>
  );
}
