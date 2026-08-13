import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthProvider';
import { parsePedidoCsv, prioridadClass } from '../constants';
import { todayIsoDate } from '../../../utils/remitoStorage';
import { fieldLabel } from '../../../utils/fieldLabels';

export default function RecepcionesPage() {
  const { sede, user } = useAuth();
  const [list, setList] = useState([]);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    tipo: 'manual',
    proveedor: '',
    documento: '',
    fecha: todayIsoDate(),
    notas: '',
    raw: 'codigo,cantidad\n',
  });

  const load = () => {
    setLoading(true);
    api
      .proyectosRecepciones(sede ? { sede } : {})
      .then((d) => {
        setList(d.recepciones || []);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sede]);

  const preview = useMemo(() => parsePedidoCsv(form.raw).slice(0, 15), [form.raw]);

  const openDetail = async (id) => {
    try {
      const data = await api.proyectoRecepcion(id);
      setDetail(data);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const lineas = parsePedidoCsv(form.raw);
    if (!lineas.length) {
      setError('Agregá líneas codigo,cantidad');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = await api.crearRecepcionProyecto({
        tipo: form.tipo,
        proveedor: form.proveedor,
        documento: form.documento,
        fecha: form.fecha,
        notas: form.notas,
        sede,
        operador: user?.name,
        lineas,
      });
      setShowForm(false);
      setForm({
        tipo: 'manual',
        proveedor: '',
        documento: '',
        fecha: todayIsoDate(),
        notas: '',
        raw: 'codigo,cantidad\n',
      });
      load();
      setDetail(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const aceptar = async (id) => {
    try {
      await api.aceptarSugerenciaProyecto(id);
      if (detail?.recepcion?.id) await openDetail(detail.recepcion.id);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const rechazar = async (id) => {
    try {
      await api.rechazarSugerenciaProyecto(id);
      if (detail?.recepcion?.id) await openDetail(detail.recepcion.id);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="section-title">Recepciones</h2>
          <p className="text-sm text-muted">
            Registrá ingreso por remito, OC o carga manual. Si hay faltantes, el sistema sugiere
            asignación a proyectos (prioridad + fecha límite). Aceptar crea reserva en limbo sin
            tocar el stock físico.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
          Nueva recepción
        </button>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {loading && <p className="text-muted">Cargando…</p>}

      <ul className="space-y-2">
        {list.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              className="card w-full border-accent/30 text-left hover:border-accent"
              onClick={() => openDetail(r.id)}
            >
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-semibold text-content">
                    {r.documento || 'Sin documento'} · {r.tipo}
                  </p>
                  <p className="text-sm text-muted">
                    {r.proveedor || '—'} · {r.fecha} · {r.operador || '—'}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-semibold text-accent">{r.estado}</p>
                  <p className="text-muted">
                    {r.lineasCount || 0} líneas · {r.sugerenciasPendientes || 0} sugerencias
                  </p>
                </div>
              </div>
            </button>
          </li>
        ))}
        {!loading && !list.length && <p className="text-muted">Sin recepciones todavía.</p>}
      </ul>

      {detail && (
        <div className="card space-y-4 border-accent/50">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="section-title">
                {detail.recepcion.documento || detail.recepcion.id.slice(0, 8)}
              </h3>
              <p className="text-sm text-muted">
                {detail.recepcion.tipo} · {detail.recepcion.estado} · {detail.recepcion.proveedor || '—'}
              </p>
            </div>
            <button type="button" className="btn-secondary text-sm" onClick={() => setDetail(null)}>
              Cerrar
            </button>
          </div>

          <div>
            <h4 className="mb-2 font-semibold">Líneas</h4>
            <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
              {(detail.lineas || []).map((l) => (
                <li key={l.id} className="flex justify-between border-b border-border py-1">
                  <span>
                    <span className="font-mono">{l.codigoArticulo}</span>{' '}
                    {l.error ? <span className="text-red-500">({l.error})</span> : l.descripcion}
                  </span>
                  <span>
                    {l.cantidadAsignada}/{l.cantidad}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-2 font-semibold">Sugerencias de asignación</h4>
            {!(detail.sugerencias || []).length && (
              <p className="text-sm text-muted">No hay faltantes relacionados para sugerir.</p>
            )}
            <ul className="space-y-2">
              {(detail.sugerencias || []).map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"
                >
                  <div className="text-sm">
                    <p className="font-semibold">
                      {s.proyectoNombre || s.proyectoId?.slice?.(0, 8)} ·{' '}
                      <span className={prioridadClass(s.proyectoPrioridad)}>{s.proyectoPrioridad}</span>
                    </p>
                    <p className="text-muted">
                      {s.codigoArticulo || 'ítem'} · {s.cantidadSugerida} u.
                      {s.fechaLimite ? ` · límite ${s.fechaLimite}` : ''} · {s.estado}
                    </p>
                  </div>
                  {s.estado === 'pendiente' && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-primary text-sm"
                        onClick={() => aceptar(s.id)}
                      >
                        Aceptar
                      </button>
                      <button
                        type="button"
                        className="btn-secondary text-sm"
                        onClick={() => rechazar(s.id)}
                      >
                        Rechazar
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <form className="card max-h-[90vh] w-full max-w-lg space-y-3 overflow-y-auto" onSubmit={submit}>
            <h3 className="section-title">Nueva recepción</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-label">{fieldLabel('tipo')}</label>
                <select
                  className="input-field"
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                >
                  <option value="manual">Carga manual</option>
                  <option value="remito">Remito</option>
                  <option value="orden_compra">Orden de compra</option>
                </select>
              </div>
              <div>
                <label className="text-label">{fieldLabel('fecha')}</label>
                <input
                  type="date"
                  className="input-field"
                  value={form.fecha}
                  onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-label">{fieldLabel('proveedor')}</label>
              <input
                className="input-field"
                value={form.proveedor}
                onChange={(e) => setForm({ ...form, proveedor: e.target.value })}
              />
            </div>
            <div>
              <label className="text-label">{fieldLabel('documento')}</label>
              <input
                className="input-field"
                value={form.documento}
                onChange={(e) => setForm({ ...form, documento: e.target.value })}
              />
            </div>
            <div>
              <label className="text-label">Líneas (codigo,cantidad)</label>
              <textarea
                className="input-field font-mono text-sm"
                rows={6}
                value={form.raw}
                onChange={(e) => setForm({ ...form, raw: e.target.value })}
              />
              {preview.length > 0 && (
                <p className="mt-1 text-xs text-muted">{preview.length} líneas en vista previa</p>
              )}
            </div>
            <div>
              <label className="text-label">{fieldLabel('notas')}</label>
              <input
                className="input-field"
                value={form.notas}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1" disabled={saving}>
                {saving ? 'Guardando…' : 'Registrar y sugerir'}
              </button>
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => setShowForm(false)}
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
