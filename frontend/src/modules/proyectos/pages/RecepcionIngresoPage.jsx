import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthProvider';
import CodigoCatalogoLink from '../../../components/CodigoCatalogoLink';
import FilterableSelect from '../../../components/FilterableSelect';
import QrScanner from '../../../components/QrScanner';
import { fieldLabel } from '../../../utils/fieldLabels';
import { parseQrScan, QR_TYPES } from '../../../utils/qrPayload';

const ESTADOS_INGRESO = ['pendiente_ingreso', 'ingreso_en_curso', 'pendiente_cierre'];

const ESTADO_LABEL = {
  pendiente_ingreso: 'Pendiente de ingreso',
  ingreso_en_curso: 'Ingreso en curso',
  pendiente_cierre: 'Pendiente de cierre',
  en_aduana: 'En aduana',
  pendiente_asignacion: 'Pendiente asignación',
  parcial: 'Parcial',
  cerrada: 'Cerrada',
};

function estadoLabel(estado) {
  return ESTADO_LABEL[estado] || estado || '—';
}

export default function RecepcionIngresoPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { sede, user } = useAuth();
  const [list, setList] = useState([]);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [scanOpen, setScanOpen] = useState(false);
  const [manualScan, setManualScan] = useState('');
  const [notasCierre, setNotasCierre] = useState('');
  const [cierrePendiente, setCierrePendiente] = useState(false);
  const [sending, setSending] = useState(false);
  const [extraOpen, setExtraOpen] = useState(false);
  const [extraForm, setExtraForm] = useState({ itemId: '', codigo: '', cantidad: 1, unidad: 'u.', descripcion: '' });
  const [itemOptions, setItemOptions] = useState([]);
  const [ajustando, setAjustando] = useState(null);

  const loadList = useCallback(() => {
    setLoading(true);
    api
      .proyectosRecepciones(sede ? { sede } : {})
      .then((d) => {
        const rows = (d.recepciones || []).filter((r) => ESTADOS_INGRESO.includes(r.estado));
        setList(rows);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [sede]);

  const loadDetail = useCallback(async (recepcionId) => {
    if (!recepcionId) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.proyectoRecepcion(recepcionId);
      setDetail(data);
    } catch (e) {
      setError(e.message);
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (id) loadDetail(id);
    else {
      setDetail(null);
      loadList();
    }
  }, [id, loadDetail, loadList]);

  useEffect(() => {
    if (!extraOpen) return;
    api
      .adminItems()
      .then((d) => {
        setItemOptions(
          (d.items || [])
            .filter((i) => i.activo !== false)
            .map((i) => {
              const codigo = i.codigoFabricante || '';
              return {
                value: i.id,
                label: codigo ? `${codigo} — ${i.nombre}` : i.nombre,
                searchText: `${codigo} ${i.nombre} ${i.marca || ''} ${i.modelo || ''}`,
                codigo,
                nombre: i.nombre,
              };
            })
        );
      })
      .catch(() => setItemOptions([]));
  }, [extraOpen]);

  const lineas = useMemo(() => detail?.lineas || [], [detail]);

  const confirmarScan = async (rawOrParsed) => {
    if (!id) return;
    setError('');
    setMsg('');
    const raw =
      typeof rawOrParsed === 'string'
        ? rawOrParsed
        : rawOrParsed?.raw || rawOrParsed?.itemId || rawOrParsed?.codigo || '';
    const parsed = typeof rawOrParsed === 'object' ? rawOrParsed : parseQrScan(raw);
    const body = {
      scan: raw,
      cantidad: 1,
      operador: user?.name || user?.email,
    };
    if (parsed?.type === QR_TYPES.ITEM && parsed.itemId) {
      body.itemId = parsed.itemId;
    } else if (parsed?.codigo) {
      body.codigo = parsed.codigo;
    } else if (raw) {
      body.codigo = String(raw).trim();
    }
    try {
      const result = await api.confirmarScanRecepcion(id, body);
      setMsg(result.mensaje || 'Escaneo confirmado.');
      await loadDetail(id);
    } catch (e) {
      setError(e.message);
    }
  };

  const onScan = (rawOrParsed) => {
    setScanOpen(false);
    confirmarScan(rawOrParsed);
  };

  const marcarLinea = async (linea, motivo, cantidadConfirmada) => {
    if (!id) return;
    setError('');
    try {
      await api.marcarLineaRecepcion(id, {
        lineaId: linea.id,
        motivo,
        cantidadConfirmada:
          cantidadConfirmada != null ? Number(cantidadConfirmada) : linea.cantidadConfirmada,
        notas: motivo === 'faltante_fisico' ? 'Faltante físico' : 'Ajuste por diferencia',
      });
      setAjustando(null);
      setMsg(motivo === 'faltante_fisico' ? 'Línea marcada como faltante físico.' : 'Diferencia registrada.');
      await loadDetail(id);
    } catch (e) {
      setError(e.message);
    }
  };

  const agregarExtra = async (e) => {
    e.preventDefault();
    if (!id) return;
    setError('');
    try {
      await api.agregarExtraRecepcion(id, {
        itemId: extraForm.itemId || null,
        codigo: extraForm.codigo || undefined,
        cantidad: Number(extraForm.cantidad) || 1,
        unidad: extraForm.unidad || 'u.',
        descripcion: extraForm.descripcion || '',
      });
      setExtraOpen(false);
      setExtraForm({ itemId: '', codigo: '', cantidad: 1, unidad: 'u.', descripcion: '' });
      setMsg('Ítem extra agregado.');
      await loadDetail(id);
    } catch (err) {
      setError(err.message);
    }
  };

  const enviarAduana = async () => {
    if (!id) return;
    setSending(true);
    setError('');
    try {
      const result = await api.enviarRecepcionAduana(id, {
        cierrePendiente,
        notas: notasCierre,
        operador: user?.name || user?.email,
      });
      setMsg(
        result.recepcion?.estado === 'pendiente_cierre' || cierrePendiente
          ? 'Enviado con cierre pendiente.'
          : 'Stock enviado a aduana.'
      );
      await loadDetail(id);
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  if (!id) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="section-title">Ingreso físico</h2>
            <p className="text-sm text-muted">
              Paso 2 · Remitos pendientes de escanear o con ingreso en curso.
            </p>
          </div>
          <Link to="/proyectos/recepciones" className="btn-secondary text-sm">
            Volver al hub
          </Link>
        </div>

        {error && <div className="alert-error">{error}</div>}
        {loading && <p className="text-muted">Cargando…</p>}

        <ul className="space-y-2">
          {list.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className="card w-full border-accent/30 text-left hover:border-accent"
                onClick={() => navigate(`/proyectos/recepciones/ingreso/${r.id}`)}
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="font-semibold text-content">
                      {r.documento || 'Sin documento'} · {r.proveedor || '—'}
                    </p>
                    <p className="text-sm text-muted">
                      {r.fecha || '—'} · {r.operador || '—'} · {r.lineasCount || 0} líneas
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-accent">{estadoLabel(r.estado)}</p>
                </div>
              </button>
            </li>
          ))}
          {!loading && !list.length && (
            <p className="text-muted">No hay remitos pendientes de ingreso.</p>
          )}
        </ul>
      </div>
    );
  }

  const rec = detail?.recepcion;
  const puedeIngresar =
    rec && ['pendiente_ingreso', 'ingreso_en_curso', 'pendiente_cierre'].includes(rec.estado);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="section-title">{rec?.documento || 'Ingreso'}</h2>
          <p className="text-sm text-muted">
            {rec ? `${estadoLabel(rec.estado)} · ${rec.proveedor || '—'}` : 'Cargando detalle…'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/proyectos/recepciones/ingreso" className="btn-secondary text-sm">
            Lista
          </Link>
          <Link to="/proyectos/recepciones" className="btn-secondary text-sm">
            Hub
          </Link>
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {msg && <p className="text-sm text-emerald-700 dark:text-emerald-300">{msg}</p>}
      {loading && !detail && <p className="text-muted">Cargando…</p>}

      {rec && (
        <>
          {puedeIngresar && (
            <div className="card space-y-3">
              <p className="font-medium">Escanear / confirmar ítem</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary" onClick={() => setScanOpen(true)}>
                  Escanear
                </button>
                <input
                  className="input-field min-w-[200px] flex-1 font-mono text-sm"
                  placeholder="Código / QR / ítem"
                  value={manualScan}
                  onChange={(e) => setManualScan(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (!manualScan.trim()) return;
                      confirmarScan(manualScan.trim());
                      setManualScan('');
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    if (!manualScan.trim()) return;
                    confirmarScan(manualScan.trim());
                    setManualScan('');
                  }}
                >
                  Confirmar
                </button>
                <button type="button" className="btn-secondary" onClick={() => setExtraOpen(true)}>
                  Agregar extra
                </button>
              </div>
            </div>
          )}

          <div className="card space-y-2">
            <h3 className="font-semibold">Líneas del remito</h3>
            <ul className="divide-y divide-border">
              {lineas.map((l) => {
                const conf = Number(l.cantidadConfirmada ?? 0);
                const esp = Number(l.cantidad ?? 0);
                return (
                  <li key={l.id} className="flex flex-wrap items-start justify-between gap-2 py-2">
                    <div className="text-sm">
                      <p className="font-medium text-content">
                        <CodigoCatalogoLink
                          codigo={l.codigoArticulo || l.codigo}
                          className="text-xs"
                        />{' '}
                        {l.descripcion || ''}
                        {l.esExtra ? (
                          <span className="ml-2 text-xs text-amber-600 dark:text-amber-300">extra</span>
                        ) : null}
                      </p>
                      <p className="text-muted">
                        {conf} / {esp} {l.unidad || 'u.'}
                        {l.motivo ? ` · ${l.motivo}` : ''}
                      </p>
                    </div>
                    {puedeIngresar && (
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          className="btn-secondary text-xs"
                          onClick={() => marcarLinea(l, 'faltante_fisico', 0)}
                        >
                          Faltante físico
                        </button>
                        <button
                          type="button"
                          className="btn-secondary text-xs"
                          onClick={() =>
                            setAjustando({
                              id: l.id,
                              cantidad: conf || esp,
                              linea: l,
                            })
                          }
                        >
                          Ajustar diferencia
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
              {!lineas.length && <li className="py-2 text-sm text-muted">Sin líneas.</li>}
            </ul>
          </div>

          {puedeIngresar && (
            <div className="card space-y-3">
              <h3 className="font-semibold">Enviar a aduana</h3>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={cierrePendiente}
                  onChange={(e) => setCierrePendiente(e.target.checked)}
                />
                Cierre pendiente (discrepancias / completar después)
              </label>
              <div>
                <label className="text-label">{fieldLabel('notas')} / motivos</label>
                <textarea
                  className="input-field"
                  rows={2}
                  value={notasCierre}
                  onChange={(e) => setNotasCierre(e.target.value)}
                  placeholder="Notas de cierre o motivos…"
                />
              </div>
              <button
                type="button"
                className="btn-primary"
                disabled={sending}
                onClick={enviarAduana}
              >
                {sending ? 'Enviando…' : 'Enviar a aduana'}
              </button>
            </div>
          )}
        </>
      )}

      {scanOpen && (
        <QrScanner
          onScan={onScan}
          onClose={() => setScanOpen(false)}
          title="Escanear ítem de recepción"
        />
      )}

      {ajustando && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <form
            className="card w-full max-w-sm space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              marcarLinea(ajustando.linea, 'diferencia', ajustando.cantidad);
            }}
          >
            <h3 className="font-semibold">Ajustar cantidad confirmada</h3>
            <div>
              <label className="text-label">{fieldLabel('cantidad')}</label>
              <input
                type="number"
                min="0"
                step="any"
                className="input-field"
                value={ajustando.cantidad}
                onChange={(e) => setAjustando({ ...ajustando, cantidad: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1">
                Guardar
              </button>
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => setAjustando(null)}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {extraOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <form className="card max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto" onSubmit={agregarExtra}>
            <h3 className="font-semibold">Agregar ítem extra</h3>
            <div>
              <label className="text-label">Ítem</label>
              <FilterableSelect
                options={itemOptions}
                value={extraForm.itemId}
                onChange={(v) => {
                  const opt = itemOptions.find((o) => o.value === v);
                  setExtraForm((f) => ({
                    ...f,
                    itemId: v,
                    codigo: opt?.codigo || f.codigo,
                    descripcion: opt?.nombre || f.descripcion,
                  }));
                }}
                placeholder="Buscar ítem…"
              />
            </div>
            <div>
              <label className="text-label">Código (si no hay ítem)</label>
              <input
                className="input-field"
                value={extraForm.codigo}
                onChange={(e) => setExtraForm({ ...extraForm, codigo: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-label">{fieldLabel('cantidad')}</label>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  className="input-field"
                  value={extraForm.cantidad}
                  onChange={(e) => setExtraForm({ ...extraForm, cantidad: e.target.value })}
                />
              </div>
              <div>
                <label className="text-label">{fieldLabel('unidad')}</label>
                <input
                  className="input-field"
                  value={extraForm.unidad}
                  onChange={(e) => setExtraForm({ ...extraForm, unidad: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1">
                Agregar
              </button>
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => setExtraOpen(false)}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
