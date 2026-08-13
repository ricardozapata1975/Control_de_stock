import { useEffect, useMemo, useState } from 'react';
import FocusedPage from '../components/FocusedPage';
import { api } from '../api/client';
import { fieldLabel } from '../utils/fieldLabels';

const PROVEEDOR_EMPTY = {
  nombre: '',
  razonSocial: '',
  iva: '',
  domicilio: '',
  localidad: '',
  vRef: '',
  cuit: '',
  rubro: '',
  contacto: '',
  telefono: '',
  email: '',
  web: '',
  notas: '',
  activo: true,
};

const IVA_OPTIONS = [
  '',
  'Responsable Inscripto',
  'Monotributo',
  'Exento',
  'Consumidor Final',
];

function Field({ field, required, children, className = '' }) {
  return (
    <div className={className}>
      <label className="text-label">{fieldLabel(field, { required })}</label>
      {children}
    </div>
  );
}

function formatWebHref(web) {
  const w = String(web || '').trim();
  if (!w) return '';
  if (/^https?:\/\//i.test(w)) return w;
  return `https://${w}`;
}

export default function Proveedores() {
  const [proveedores, setProveedores] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(PROVEEDOR_EMPTY);
  const [saving, setSaving] = useState(false);

  const load = async (term = q) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.proveedores(term, { agenda: true });
      setProveedores(data.proveedores || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return proveedores;
    return proveedores.filter((p) =>
      [
        p.nombre,
        p.razonSocial,
        p.cuit,
        p.localidad,
        p.rubro,
        p.contacto,
        p.telefono,
        p.email,
        p.web,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [proveedores, q]);

  const openNew = () => {
    setEditingId('new');
    setForm({ ...PROVEEDOR_EMPTY });
    setSuccess('');
    setError('');
  };

  const openEdit = (p) => {
    setEditingId(p.id);
    setForm({
      nombre: p.nombre || '',
      razonSocial: p.razonSocial || '',
      iva: p.iva || '',
      domicilio: p.domicilio || '',
      localidad: p.localidad || '',
      vRef: p.vRef || '',
      cuit: p.cuit || '',
      rubro: p.rubro || '',
      contacto: p.contacto || '',
      telefono: p.telefono || '',
      email: p.email || '',
      web: p.web || '',
      notas: p.notas || '',
      activo: p.activo !== false,
    });
    setSuccess('');
    setError('');
  };

  const save = async (ev) => {
    ev.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      if (editingId === 'new') {
        const { proveedor } = await api.createProveedor(form);
        setSuccess(`Proveedor "${proveedor.nombre}" creado`);
      } else {
        const { proveedor } = await api.updateProveedor(editingId, form);
        setSuccess(`Proveedor "${proveedor.nombre}" actualizado`);
      }
      setEditingId(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (p) => {
    if (!window.confirm(`¿Desactivar proveedor "${p.nombre}"?`)) return;
    try {
      await api.deleteProveedor(p.id);
      setSuccess(`Proveedor "${p.nombre}" desactivado`);
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const onSearch = async (e) => {
    e.preventDefault();
    await load(q);
  };

  return (
    <FocusedPage maxWidth="max-w-6xl">
      <div className="mb-4">
        <h2 className="page-title">Proveedores</h2>
        <p className="mt-1 text-sm text-muted">
          Agenda de proveedores: datos fiscales, rubro, contacto y web.
        </p>
      </div>

      <form onSubmit={onSearch} className="mb-4 flex flex-wrap gap-2">
        <input
          className="input-field min-w-[200px] flex-1"
          placeholder="Buscar por nombre, rubro, CUIT, contacto…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="submit" className="btn-secondary" disabled={loading}>
          Buscar
        </button>
        <button type="button" className="btn-primary" onClick={openNew}>
          Nuevo proveedor
        </button>
      </form>

      {error && <div className="alert-error mb-4">{error}</div>}
      {success && <div className="alert-success mb-4">{success}</div>}

      <div className="card mb-4 overflow-x-auto p-0">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="table-head">
            <tr>
              <th className="px-3 py-2">{fieldLabel('nombre')}</th>
              <th className="px-3 py-2">{fieldLabel('rubro')}</th>
              <th className="px-3 py-2">{fieldLabel('cuit')}</th>
              <th className="px-3 py-2">{fieldLabel('localidad')}</th>
              <th className="px-3 py-2">{fieldLabel('contacto')}</th>
              <th className="px-3 py-2">{fieldLabel('activo')}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtrados.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <p className="font-semibold text-content">{p.nombre}</p>
                  <p className="text-xs text-muted">{p.razonSocial || p.iva || ''}</p>
                  {p.web ? (
                    <a
                      href={formatWebHref(p.web)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-accent underline"
                    >
                      {p.web}
                    </a>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-xs">{p.rubro || '—'}</td>
                <td className="px-3 py-2 font-mono text-xs">{p.cuit || '—'}</td>
                <td className="px-3 py-2 text-xs">{p.localidad || '—'}</td>
                <td className="px-3 py-2 text-xs">
                  <p>{p.contacto || p.telefono || '—'}</p>
                  <p className="text-muted">{p.email || ''}</p>
                  {p.telefono && p.contacto ? (
                    <p className="text-muted">{p.telefono}</p>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <span className={p.activo !== false ? 'text-emerald-600' : 'text-muted'}>
                    {p.activo !== false ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className="btn-secondary py-1 text-sm"
                      onClick={() => openEdit(p)}
                    >
                      Editar
                    </button>
                    {p.activo !== false && (
                      <button
                        type="button"
                        className="btn-secondary py-1 text-sm"
                        onClick={() => deactivate(p)}
                      >
                        Baja
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!filtrados.length && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted">
                  {loading ? 'Cargando…' : 'Sin proveedores'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editingId && (
        <form onSubmit={save} className="card space-y-4">
          <h3 className="section-title">
            {editingId === 'new' ? 'Nuevo proveedor' : 'Editar proveedor'}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field field="nombre" required>
              <input
                className="input-field"
                required
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              />
            </Field>
            <Field field="razonSocial">
              <input
                className="input-field"
                value={form.razonSocial}
                onChange={(e) => setForm((f) => ({ ...f, razonSocial: e.target.value }))}
              />
            </Field>
            <Field field="rubro">
              <input
                className="input-field"
                placeholder="Ej. Electricidad, Ferretería…"
                value={form.rubro}
                onChange={(e) => setForm((f) => ({ ...f, rubro: e.target.value }))}
              />
            </Field>
            <Field field="iva">
              <select
                className="input-field"
                value={form.iva}
                onChange={(e) => setForm((f) => ({ ...f, iva: e.target.value }))}
              >
                {IVA_OPTIONS.map((opt) => (
                  <option key={opt || 'empty'} value={opt}>
                    {opt || '—'}
                  </option>
                ))}
              </select>
            </Field>
            <Field field="cuit">
              <input
                className="input-field font-mono"
                value={form.cuit}
                onChange={(e) => setForm((f) => ({ ...f, cuit: e.target.value }))}
              />
            </Field>
            <Field field="vRef">
              <input
                className="input-field"
                value={form.vRef}
                onChange={(e) => setForm((f) => ({ ...f, vRef: e.target.value }))}
              />
            </Field>
            <Field field="domicilio" className="sm:col-span-2">
              <input
                className="input-field"
                value={form.domicilio}
                onChange={(e) => setForm((f) => ({ ...f, domicilio: e.target.value }))}
              />
            </Field>
            <Field field="localidad">
              <input
                className="input-field"
                value={form.localidad}
                onChange={(e) => setForm((f) => ({ ...f, localidad: e.target.value }))}
              />
            </Field>
            <Field field="web">
              <input
                className="input-field"
                placeholder="www.ejemplo.com"
                value={form.web}
                onChange={(e) => setForm((f) => ({ ...f, web: e.target.value }))}
              />
            </Field>
            <Field field="contacto">
              <input
                className="input-field"
                value={form.contacto}
                onChange={(e) => setForm((f) => ({ ...f, contacto: e.target.value }))}
              />
            </Field>
            <Field field="telefono">
              <input
                className="input-field"
                value={form.telefono}
                onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
              />
            </Field>
            <Field field="email">
              <input
                className="input-field"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </Field>
            <Field field="notas" className="sm:col-span-2">
              <textarea
                className="input-field min-h-[60px]"
                value={form.notas}
                onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={form.activo !== false}
                onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
              />
              {fieldLabel('activo')}
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar proveedor'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setEditingId(null)}
              disabled={saving}
            >
              Cerrar
            </button>
          </div>
        </form>
      )}
    </FocusedPage>
  );
}
