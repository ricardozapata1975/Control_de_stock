import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthProvider';
import CodigoCatalogoLink from '../../../components/CodigoCatalogoLink';
import UbicacionSelector from '../../../components/UbicacionSelector';
import { fieldLabel } from '../../../utils/fieldLabels';
import { ALMACEN_DEFAULT, SEDE_DEFAULT } from '../../../utils/ubicacion';

function stockRows(data) {
  return data?.stock || data?.items || data?.inventario || [];
}

function opcionesRows(data) {
  return data?.opciones || data?.faltantes || data?.sugerencias || [];
}

export default function RecepcionAduanaPage() {
  const { sede, user } = useAuth();
  const [list, setList] = useState([]);
  const [catalogo, setCatalogo] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [modo, setModo] = useState('ubicar'); // ubicar | asignar
  const [opciones, setOpciones] = useState([]);
  const [opcionId, setOpcionId] = useState('');
  const [cantidadAsignar, setCantidadAsignar] = useState('');
  const [saving, setSaving] = useState(false);
  const [ubic, setUbic] = useState({
    sede: sede || SEDE_DEFAULT,
    almacen: ALMACEN_DEFAULT,
    armario: '',
    estante: '',
    contenedor: '',
  });

  const load = useCallback(() => {
    setLoading(true);
    api
      .aduanaStock(sede ? { sede } : {})
      .then((d) => {
        setList(stockRows(d));
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [sede]);

  useEffect(() => {
    load();
    api.catalogoUbicacion().then(setCatalogo).catch(() => setCatalogo(null));
  }, [load]);

  useEffect(() => {
    setUbic((u) => ({ ...u, sede: sede || SEDE_DEFAULT }));
  }, [sede]);

  const openItem = async (row) => {
    setSelected(row);
    setModo('ubicar');
    setMsg('');
    setError('');
    setOpcionId('');
    setCantidadAsignar(String(row.cantidad ?? row.cantidadDisponible ?? ''));
    setUbic((u) => ({
      ...u,
      sede: row.sede || sede || SEDE_DEFAULT,
    }));
    const itemId = row.itemId || row.item_id;
    if (!itemId) {
      setOpciones([]);
      return;
    }
    try {
      const data = await api.aduanaOpcionesAsignacion({
        itemId,
        sede: row.sede || sede || '',
      });
      setOpciones(opcionesRows(data));
    } catch {
      setOpciones([]);
    }
  };

  const closePanel = () => {
    setSelected(null);
    setOpciones([]);
  };

  const ubicar = async () => {
    if (!selected) return;
    const stockId = selected.stockId || selected.id;
    if (!stockId) {
      setError('Stock sin identificador.');
      return;
    }
    if (!ubic.almacen || !ubic.armario || !ubic.estante) {
      setError('Completá almacén, armario y estante.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.aduanaUbicar({
        stockId,
        sede: ubic.sede,
        almacen: ubic.almacen,
        armario: ubic.armario,
        estante: ubic.estante,
        contenedor: ubic.contenedor || null,
        usuario: user?.name || user?.email,
      });
      setMsg('Stock ubicado en almacén principal.');
      closePanel();
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const asignar = async ({ autoFifo = false } = {}) => {
    if (!selected) return;
    const stockId = selected.stockId || selected.id;
    if (!stockId) {
      setError('Stock sin identificador.');
      return;
    }
    const first = opciones[0];
    const chosen =
      autoFifo || !opcionId
        ? first
        : opciones.find((o) => String(o.id || o.faltanteId) === String(opcionId));
    if (!autoFifo && !chosen && !opcionId) {
      setError('Elegí un faltante/proyecto o usá Auto FIFO.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.aduanaAsignar({
        stockId,
        cantidad: cantidadAsignar ? Number(cantidadAsignar) : undefined,
        faltanteId: chosen?.faltanteId || chosen?.id || undefined,
        proyectoId: chosen?.proyectoId || undefined,
        autoFifo: Boolean(autoFifo),
        usuario: user?.name || user?.email,
      });
      setMsg(autoFifo ? 'Asignado por FIFO automático.' : 'Asignado al proyecto seleccionado.');
      closePanel();
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="section-title">Desde aduana</h2>
          <p className="text-sm text-muted">
            Paso 3 · Stock en recepción tránsito: ubicar en depósito o asignar a proyecto (FIFO).
          </p>
        </div>
        <Link to="/proyectos/recepciones" className="btn-secondary text-sm">
          Volver al hub
        </Link>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {msg && <p className="text-sm text-emerald-700 dark:text-emerald-300">{msg}</p>}
      {loading && <p className="text-muted">Cargando…</p>}

      <ul className="space-y-2">
        {list.map((row) => {
          const key = row.stockId || row.id || `${row.itemId}-${row.contenedorId}`;
          const codigo = row.codigoArticulo || row.codigoFabricante || row.codigo;
          return (
            <li key={key}>
              <button
                type="button"
                className="card w-full border-accent/30 text-left hover:border-accent"
                onClick={() => openItem(row)}
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="font-semibold text-content">
                      <CodigoCatalogoLink codigo={codigo} className="text-xs" />{' '}
                      {row.nombre || row.descripcion || 'Ítem'}
                    </p>
                    <p className="text-sm text-muted">
                      {row.cantidad ?? row.cantidadDisponible ?? 0} u.
                      {row.documento ? ` · remito ${row.documento}` : ''}
                      {row.ubicacionLabel || row.contenedorCodigo
                        ? ` · ${row.ubicacionLabel || row.contenedorCodigo}`
                        : ''}
                    </p>
                  </div>
                  <span className="text-sm text-accent">Ubicar / asignar</span>
                </div>
              </button>
            </li>
          );
        })}
        {!loading && !list.length && <p className="text-muted">No hay stock en aduana.</p>}
      </ul>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="card max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="section-title">
                  <CodigoCatalogoLink
                    codigo={
                      selected.codigoArticulo || selected.codigoFabricante || selected.codigo
                    }
                    className="text-sm"
                  />{' '}
                  {selected.nombre || selected.descripcion || ''}
                </h3>
                <p className="text-sm text-muted">
                  {selected.cantidad ?? selected.cantidadDisponible ?? 0} u. en aduana
                </p>
              </div>
              <button type="button" className="btn-secondary text-sm" onClick={closePanel}>
                Cerrar
              </button>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                className={modo === 'ubicar' ? 'btn-primary flex-1' : 'btn-secondary flex-1'}
                onClick={() => setModo('ubicar')}
              >
                Ubicar
              </button>
              <button
                type="button"
                className={modo === 'asignar' ? 'btn-primary flex-1' : 'btn-secondary flex-1'}
                onClick={() => setModo('asignar')}
              >
                Asignar a proyecto
              </button>
            </div>

            {modo === 'ubicar' && (
              <div className="space-y-3">
                <UbicacionSelector
                  catalogo={catalogo}
                  sede={ubic.sede}
                  almacen={ubic.almacen}
                  armario={ubic.armario}
                  estante={ubic.estante}
                  contenedor={ubic.contenedor}
                  onSedeChange={(v) => setUbic((u) => ({ ...u, sede: v }))}
                  onAlmacenChange={(v) => setUbic((u) => ({ ...u, almacen: v }))}
                  onArmarioChange={(v) => setUbic((u) => ({ ...u, armario: v }))}
                  onEstanteChange={(v) => setUbic((u) => ({ ...u, estante: v }))}
                  onContenedorChange={(v) => setUbic((u) => ({ ...u, contenedor: v }))}
                  compact
                />
                <button
                  type="button"
                  className="btn-primary w-full"
                  disabled={saving}
                  onClick={ubicar}
                >
                  {saving ? 'Guardando…' : 'Ubicar en almacén'}
                </button>
              </div>
            )}

            {modo === 'asignar' && (
              <div className="space-y-3">
                <div>
                  <label className="text-label">{fieldLabel('cantidad')}</label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    className="input-field"
                    value={cantidadAsignar}
                    onChange={(e) => setCantidadAsignar(e.target.value)}
                  />
                </div>
                {!opciones.length && (
                  <p className="text-sm text-muted">
                    No hay faltantes FIFO para este ítem. Podés ubicar en almacén o esperar
                    necesidades de proyecto.
                  </p>
                )}
                {opciones.length > 0 && (
                  <ul className="max-h-48 space-y-2 overflow-y-auto">
                    {opciones.map((o, idx) => {
                      const oid = String(o.id || o.faltanteId || idx);
                      return (
                        <li key={oid}>
                          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-2 text-sm hover:border-accent">
                            <input
                              type="radio"
                              name="opcion-fifo"
                              checked={String(opcionId) === oid}
                              onChange={() => setOpcionId(oid)}
                            />
                            <span>
                              <span className="font-semibold">
                                {o.proyectoNombre || o.proyectoId || 'Proyecto'}
                              </span>
                              {idx === 0 ? (
                                <span className="ml-2 text-xs text-accent">FIFO #1</span>
                              ) : null}
                              <span className="mt-0.5 block text-muted">
                                {o.cantidadSugerida || o.cantidad || o.cantidadFaltante || '—'} u.
                                {o.prioridad ? ` · ${o.prioridad}` : ''}
                                {o.fechaLimite ? ` · límite ${o.fechaLimite}` : ''}
                              </span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-primary flex-1"
                    disabled={saving || (!opcionId && !opciones.length)}
                    onClick={() => asignar({ autoFifo: false })}
                  >
                    {saving ? 'Asignando…' : 'Asignar seleccionado'}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary flex-1"
                    disabled={saving || !opciones.length}
                    onClick={() => asignar({ autoFifo: true })}
                  >
                    Auto FIFO
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
