import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../../api/client';
import { ESTADOS_TABLERO, PRIORIDADES, prioridadClass } from '../constants';
import { fieldLabel } from '../../../utils/fieldLabels';

export default function ProyectoDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tableroForm, setTableroForm] = useState({
    nombre: '',
    codigo: '',
    prioridad: 'media',
    fechaObjetivo: '',
  });
  const [showTablero, setShowTablero] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .proyecto(id)
      .then((d) => {
        setData(d);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const crearTablero = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.crearTablero(id, {
        ...tableroForm,
        fechaObjetivo: tableroForm.fechaObjetivo || null,
      });
      setShowTablero(false);
      setTableroForm({ nombre: '', codigo: '', prioridad: 'media', fechaObjetivo: '' });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-muted">Cargando proyecto…</p>;
  if (error && !data) return <div className="alert-error">{error}</div>;
  if (!data) return null;

  const { proyecto, tableros, materiales, reservas, faltantes } = data;

  return (
    <div className="space-y-4">
      <Link to="/proyectos/lista" className="text-sm text-accent underline">
        ← Volver a proyectos
      </Link>

      {error && <div className="alert-error">{error}</div>}

      <div className="card border-accent/40">
        <h2 className="text-xl font-bold text-content">
          {proyecto.codigo ? `${proyecto.codigo} · ` : ''}
          {proyecto.nombre}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {proyecto.estado} ·{' '}
          <span className={prioridadClass(proyecto.prioridad)}>
            Prioridad {proyecto.prioridad}
          </span>
          {proyecto.fechaObjetivo ? ` · Objetivo ${proyecto.fechaObjetivo}` : ''}
          {proyecto.responsable ? ` · ${proyecto.responsable}` : ''}
        </p>
        {proyecto.descripcion && <p className="mt-2 text-sm">{proyecto.descripcion}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <Link className="btn-secondary text-sm" to={`/proyectos/pedidos?proyectoId=${proyecto.id}`}>
            Pedido masivo
          </Link>
          <Link
            className="btn-secondary text-sm"
            to={`/proyectos/materiales?proyectoId=${proyecto.id}`}
          >
            BOM
          </Link>
          <Link className="btn-secondary text-sm" to={`/proyectos/reservas?proyectoId=${proyecto.id}`}>
            Reservas
          </Link>
          <Link className="btn-secondary text-sm" to={`/proyectos/faltantes?proyectoId=${proyecto.id}`}>
            Faltantes
          </Link>
          <Link
            className="btn-secondary text-sm"
            to={`/proyectos/produccion?proyectoId=${proyecto.id}`}
          >
            Armado
          </Link>
        </div>
      </div>

      <section className="card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="section-title">Tableros ({tableros.length})</h3>
          <button type="button" className="btn-primary text-sm" onClick={() => setShowTablero(true)}>
            Agregar tablero
          </button>
        </div>
        <ul className="space-y-2">
          {tableros.map((t) => (
            <li key={t.id} className="flex justify-between gap-2 border-b border-border py-2 text-sm">
              <span>
                <strong>{t.nombre}</strong>
                {t.codigo ? ` (${t.codigo})` : ''} · {t.estado}
              </span>
              <span className="flex items-center gap-2">
                <span className={prioridadClass(t.prioridad)}>{t.prioridad}</span>
                <Link
                  className="text-accent underline"
                  to={`/proyectos/produccion?proyectoId=${proyecto.id}&tableroId=${t.id}`}
                >
                  Armar
                </Link>
              </span>
            </li>
          ))}
          {!tableros.length && <p className="text-muted">Sin tableros.</p>}
        </ul>
      </section>

      <section className="card">
        <h3 className="section-title mb-2">Materiales requeridos ({materiales.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-1">{fieldLabel('codigo')}</th>
                <th>{fieldLabel('descripcion')}</th>
                <th className="text-right">{fieldLabel('cantidadRequerida')}</th>
                <th className="text-right">{fieldLabel('cantidadReservada')}</th>
                <th className="text-right">{fieldLabel('cantidadFaltante')}</th>
                <th>{fieldLabel('estado')}</th>
              </tr>
            </thead>
            <tbody>
              {materiales.map((m) => (
                <tr key={m.id} className="border-b border-border/60">
                  <td className="py-1 font-mono">{m.codigoArticulo || '—'}</td>
                  <td>{m.descripcion || '—'}</td>
                  <td className="text-right">{m.cantidadRequerida}</td>
                  <td className="text-right text-accent">{m.cantidadReservada}</td>
                  <td className="text-right text-amber-600">{m.cantidadFaltante}</td>
                  <td>{m.estado}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!materiales.length && (
            <p className="mt-2 text-muted">Sin materiales. Usá Pedido masivo para cargar.</p>
          )}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h3 className="section-title mb-2">
            Reservas activas (
            {reservas.filter((r) => r.estado === 'activa').length})
          </h3>
          <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
            {reservas
              .filter((r) => r.estado === 'activa')
              .map((r) => (
                <li key={r.id} className="flex justify-between border-b border-border py-1">
                  <span className="font-mono text-xs">{r.itemId?.slice?.(0, 8)}…</span>
                  <span className="font-semibold text-accent">{r.cantidad}</span>
                </li>
              ))}
            {!reservas.filter((r) => r.estado === 'activa').length && (
              <p className="text-muted">Sin reservas.</p>
            )}
          </ul>
        </section>
        <section className="card">
          <h3 className="section-title mb-2">Faltantes ({faltantes.length})</h3>
          <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
            {faltantes.map((f) => (
              <li key={f.id} className="flex justify-between border-b border-border py-1">
                <span>
                  {f.codigoArticulo || '—'} · {f.estado}
                </span>
                <span className="font-semibold text-amber-600">{f.cantidad}</span>
              </li>
            ))}
            {!faltantes.length && <p className="text-muted">Sin faltantes.</p>}
          </ul>
        </section>
      </div>

      {showTablero && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <form className="card w-full max-w-md space-y-3" onSubmit={crearTablero}>
            <h3 className="section-title">Nuevo tablero</h3>
            <div>
              <label className="text-label">{fieldLabel('nombre', { required: true })}</label>
              <input
                className="input-field"
                required
                value={tableroForm.nombre}
                onChange={(e) => setTableroForm({ ...tableroForm, nombre: e.target.value })}
              />
            </div>
            <div>
              <label className="text-label">{fieldLabel('codigo')}</label>
              <input
                className="input-field"
                value={tableroForm.codigo}
                onChange={(e) => setTableroForm({ ...tableroForm, codigo: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-label">{fieldLabel('prioridad')}</label>
                <select
                  className="input-field"
                  value={tableroForm.prioridad}
                  onChange={(e) => setTableroForm({ ...tableroForm, prioridad: e.target.value })}
                >
                  {PRIORIDADES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-label">{fieldLabel('fechaObjetivo')}</label>
                <input
                  type="date"
                  className="input-field"
                  value={tableroForm.fechaObjetivo}
                  onChange={(e) =>
                    setTableroForm({ ...tableroForm, fechaObjetivo: e.target.value })
                  }
                />
              </div>
            </div>
            <p className="text-xs text-muted">
              Estados posibles: {ESTADOS_TABLERO.map((e) => e.label).join(', ')}
            </p>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1" disabled={saving}>
                {saving ? 'Guardando…' : 'Crear'}
              </button>
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => setShowTablero(false)}
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
