import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthProvider';
import { ESTADOS_PROYECTO, PRIORIDADES, prioridadClass } from '../constants';

const EMPTY = {
  codigo: '',
  nombre: '',
  descripcion: '',
  prioridad: 'media',
  estado: 'activo',
  fechaObjetivo: '',
  responsable: '',
};

export default function ProyectosLista() {
  const { sede, user } = useAuth();
  const [list, setList] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .proyectos({ ...(sede ? { sede } : {}), ...(q ? { q } : {}) })
      .then((data) => {
        setList(data.proyectos || []);
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
    setError('');
    try {
      await api.crearProyecto({
        ...form,
        sede,
        createdBy: user?.name,
        fechaObjetivo: form.fechaObjetivo || null,
      });
      setShowForm(false);
      setForm(EMPTY);
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
        <h2 className="section-title">Proyectos</h2>
        <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
          Nuevo proyecto
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          className="input-field max-w-xs"
          placeholder="Buscar…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
        />
        <button type="button" className="btn-secondary" onClick={load}>
          Buscar
        </button>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {loading && <p className="text-muted">Cargando…</p>}

      <ul className="space-y-3">
        {list.map((p) => (
          <li key={p.id}>
            <Link to={`/proyectos/${p.id}`} className="card block border-accent/30 hover:border-accent">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-content">
                    {p.codigo ? `${p.codigo} · ` : ''}
                    {p.nombre}
                  </p>
                  <p className="text-sm text-muted">
                    {p.estado} ·{' '}
                    <span className={prioridadClass(p.prioridad)}>Prioridad {p.prioridad}</span>
                    {p.fechaObjetivo ? ` · Objetivo ${p.fechaObjetivo}` : ''}
                  </p>
                </div>
                <div className="text-right text-sm text-muted">
                  <p>{p.tablerosCount || 0} tableros</p>
                  <p>{p.faltantesCount || 0} faltantes</p>
                  <p>{p.reservasActivas || 0} u. reservadas</p>
                </div>
              </div>
            </Link>
          </li>
        ))}
        {!loading && !list.length && (
          <p className="text-muted">No hay proyectos en esta sede.</p>
        )}
      </ul>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <form className="card w-full max-w-lg space-y-3" onSubmit={submit}>
            <h3 className="section-title">Nuevo proyecto</h3>
            <div>
              <label className="text-label">Código</label>
              <input
                className="input-field"
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.target.value })}
              />
            </div>
            <div>
              <label className="text-label">Nombre *</label>
              <input
                className="input-field"
                required
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </div>
            <div>
              <label className="text-label">Descripción</label>
              <textarea
                className="input-field"
                rows={2}
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-label">Prioridad</label>
                <select
                  className="input-field"
                  value={form.prioridad}
                  onChange={(e) => setForm({ ...form, prioridad: e.target.value })}
                >
                  {PRIORIDADES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-label">Estado</label>
                <select
                  className="input-field"
                  value={form.estado}
                  onChange={(e) => setForm({ ...form, estado: e.target.value })}
                >
                  {ESTADOS_PROYECTO.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-label">Fecha objetivo</label>
                <input
                  type="date"
                  className="input-field"
                  value={form.fechaObjetivo}
                  onChange={(e) => setForm({ ...form, fechaObjetivo: e.target.value })}
                />
              </div>
              <div>
                <label className="text-label">Responsable</label>
                <input
                  className="input-field"
                  value={form.responsable}
                  onChange={(e) => setForm({ ...form, responsable: e.target.value })}
                />
              </div>
            </div>
            <p className="text-xs text-muted">Sede: {sede || '—'} (sesión)</p>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1" disabled={saving}>
                {saving ? 'Guardando…' : 'Crear'}
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
