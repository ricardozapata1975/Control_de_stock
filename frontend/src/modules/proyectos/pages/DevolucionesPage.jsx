import { useEffect, useState } from 'react';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthProvider';
import { fieldLabel } from '../../../utils/fieldLabels';
import CodigoCatalogoLink from '../../../components/CodigoCatalogoLink';

export default function DevolucionesPage() {
  const { sede, user } = useAuth();
  const [list, setList] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    proyectoId: '',
    reservaId: '',
    cantidad: 1,
    motivo: '',
    codigoArticulo: '',
  });

  const load = () => {
    setLoading(true);
    Promise.all([
      api.proyectosDevoluciones(sede ? { sede } : {}),
      api.proyectos(sede ? { sede } : {}),
      api.proyectosReservas({ ...(sede ? { sede } : {}), estado: 'activa' }),
    ])
      .then(([d, p, r]) => {
        setList(d.devoluciones || []);
        setProyectos(p.proyectos || []);
        setReservas(r.reservas || []);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sede]);

  const reservasProyecto = reservas.filter((r) => r.proyectoId === form.proyectoId);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const reserva = reservas.find((r) => r.id === form.reservaId);
      await api.crearDevolucionProyecto({
        proyectoId: form.proyectoId,
        reservaId: form.reservaId || undefined,
        itemId: reserva?.itemId,
        cantidad: Number(form.cantidad),
        motivo: form.motivo,
        codigoArticulo: form.codigoArticulo || undefined,
        usuario: user?.name,
        sede,
      });
      setShowForm(false);
      setForm({ proyectoId: '', reservaId: '', cantidad: 1, motivo: '', codigoArticulo: '' });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="section-title">Devoluciones</h2>
          <p className="text-sm text-muted">
            Devolución real desde proyecto/reserva (libera limbo y deja trazabilidad). No hace
            ajuste ciego de stock.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
          Nueva devolución
        </button>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {loading && <p className="text-muted">Cargando…</p>}

      <ul className="space-y-2">
        {list.map((d) => (
          <li key={d.id} className="card flex flex-wrap justify-between gap-2 text-sm">
            <div>
              <p className="font-semibold text-content">{d.proyectoNombre || d.proyectoId?.slice?.(0, 8)}</p>
              <p className="text-muted">
                {d.codigoArticulo ? (
                  <CodigoCatalogoLink codigo={d.codigoArticulo} className="text-xs" />
                ) : (
                  d.itemId?.slice?.(0, 8) || '—'
                )}{' '}
                · {d.motivo || 'Sin motivo'} · {d.usuario || '—'}
              </p>
              <p className="text-xs text-subtle">{d.createdAt && new Date(d.createdAt).toLocaleString('es-AR')}</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-accent">{d.cantidad}</p>
              <p className="text-xs text-muted">{d.estado}</p>
            </div>
          </li>
        ))}
        {!loading && !list.length && <p className="text-muted">Sin devoluciones.</p>}
      </ul>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <form className="card w-full max-w-md space-y-3" onSubmit={submit}>
            <h3 className="section-title">Registrar devolución</h3>
            <div>
              <label className="text-label">{fieldLabel('proyecto', { required: true })}</label>
              <select
                className="input-field"
                required
                value={form.proyectoId}
                onChange={(e) => setForm({ ...form, proyectoId: e.target.value, reservaId: '' })}
              >
                <option value="">Elegí…</option>
                {proyectos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-label">{fieldLabel('reserva')}</label>
              <select
                className="input-field"
                value={form.reservaId}
                onChange={(e) => {
                  const r = reservas.find((x) => x.id === e.target.value);
                  setForm({
                    ...form,
                    reservaId: e.target.value,
                    cantidad: r ? Number(r.cantidad) : form.cantidad,
                  });
                }}
                disabled={!form.proyectoId}
              >
                <option value="">Sin reserva vinculada</option>
                {reservasProyecto.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.itemId?.slice?.(0, 8)}… · {r.cantidad} u.
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-label">{fieldLabel('cantidad', { required: true })}</label>
              <input
                type="number"
                min={1}
                className="input-field"
                required
                value={form.cantidad}
                onChange={(e) => setForm({ ...form, cantidad: e.target.value })}
              />
            </div>
            <div>
              <label className="text-label">{fieldLabel('motivo')}</label>
              <input
                className="input-field"
                value={form.motivo}
                onChange={(e) => setForm({ ...form, motivo: e.target.value })}
                placeholder="Sobra de obra, error de pedido…"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1" disabled={saving}>
                {saving ? 'Guardando…' : 'Registrar'}
              </button>
              <button type="button" className="btn-secondary flex-1" onClick={() => setShowForm(false)}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
