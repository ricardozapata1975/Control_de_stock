import { useEffect, useState } from 'react';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthProvider';
import { fieldLabel } from '../../../utils/fieldLabels';

const EVENTOS = [
  { id: 'devuelta', label: 'Devuelta' },
  { id: 'perdida', label: 'Perdida' },
  { id: 'rota', label: 'Rota' },
  { id: 'reemplazada', label: 'Reemplazada' },
];

export default function HerramientasPage() {
  const { sede, user } = useAuth();
  const [list, setList] = useState([]);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nombre: '',
    codigo: '',
    operario: '',
    caja: '',
    notas: '',
  });

  const load = () => {
    setLoading(true);
    api
      .proyectosHerramientas(sede ? { sede } : {})
      .then((d) => {
        setList(d.herramientas || []);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sede]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.asignarHerramientaProyecto({ ...form, sede, createdBy: user?.name });
      setShowForm(false);
      setForm({ nombre: '', codigo: '', operario: '', caja: '', notas: '' });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const open = async (id) => {
    const data = await api.proyectoHerramienta(id);
    setDetail(data);
  };

  const evento = async (tipo) => {
    if (!detail?.asignacion?.id) return;
    try {
      await api.eventoHerramientaProyecto(detail.asignacion.id, { tipo });
      await open(detail.asignacion.id);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="section-title">Herramientas</h2>
          <p className="text-sm text-muted">
            Asignación a operarios/cajas con historial (prestada, devuelta, perdida, rota,
            reemplazada).
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
          Prestar herramienta
        </button>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {loading && <p className="text-muted">Cargando…</p>}

      <ul className="space-y-2">
        {list.map((h) => (
          <li key={h.id}>
            <button type="button" className="card w-full text-left hover:border-accent" onClick={() => open(h.id)}>
              <div className="flex justify-between gap-2 text-sm">
                <div>
                  <p className="font-semibold">{h.nombre || h.codigo}</p>
                  <p className="text-muted">
                    {h.operario}
                    {h.caja ? ` · caja ${h.caja}` : ''}
                  </p>
                </div>
                <p className="font-semibold text-accent">{h.estado}</p>
              </div>
            </button>
          </li>
        ))}
        {!loading && !list.length && <p className="text-muted">Sin asignaciones.</p>}
      </ul>

      {detail && (
        <div className="card space-y-3 border-accent/40">
          <div className="flex justify-between gap-2">
            <div>
              <h3 className="section-title">{detail.asignacion.nombre}</h3>
              <p className="text-sm text-muted">
                {detail.asignacion.operario} · {detail.asignacion.estado}
              </p>
            </div>
            <button type="button" className="btn-secondary text-sm" onClick={() => setDetail(null)}>
              Cerrar
            </button>
          </div>
          {detail.asignacion.estado === 'prestada' && (
            <div className="flex flex-wrap gap-2">
              {EVENTOS.map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  className="btn-secondary text-sm"
                  onClick={() => evento(ev.id)}
                >
                  {ev.label}
                </button>
              ))}
            </div>
          )}
          <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
            {(detail.eventos || []).map((e) => (
              <li key={e.id} className="border-b border-border py-1">
                <strong>{e.tipo}</strong> · {e.usuario || '—'} ·{' '}
                {e.createdAt && new Date(e.createdAt).toLocaleString('es-AR')}
                {e.notas ? ` · ${e.notas}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <form className="card w-full max-w-md space-y-3" onSubmit={submit}>
            <h3 className="section-title">Prestar herramienta</h3>
            <div>
              <label className="text-label">{fieldLabel('nombre', { required: true })}</label>
              <input
                className="input-field"
                required
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </div>
            <div>
              <label className="text-label">{fieldLabel('codigo')}</label>
              <input
                className="input-field"
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.target.value })}
              />
            </div>
            <div>
              <label className="text-label">{fieldLabel('operario', { required: true })}</label>
              <input
                className="input-field"
                required
                value={form.operario}
                onChange={(e) => setForm({ ...form, operario: e.target.value })}
              />
            </div>
            <div>
              <label className="text-label">{fieldLabel('caja')}</label>
              <input
                className="input-field"
                value={form.caja}
                onChange={(e) => setForm({ ...form, caja: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1" disabled={saving}>
                {saving ? 'Guardando…' : 'Asignar'}
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
