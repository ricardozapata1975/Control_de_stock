import { useEffect, useMemo, useState } from 'react';
import FocusedPage from '../components/FocusedPage';
import { api } from '../api/client';

const EMPRESA_EMPTY = {
  nombre: '',
  razonSocial: '',
  cuit: '',
  ingBrutos: '',
  domicilio: '',
  localidad: '',
  telefono: '',
  fax: '',
  email: '',
  web: '',
  fechaInicioActividades: '',
  codigoDocumento: '91',
  sedeCodigo: '',
  notas: '',
  activo: true,
};

const CLIENTE_EMPTY = {
  nombre: '',
  razonSocial: '',
  iva: '',
  domicilio: '',
  localidad: '',
  vRef: '',
  cuit: '',
  telefono: '',
  email: '',
  contacto: '',
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

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

function Field({ label, children, className = '' }) {
  return (
    <div className={className}>
      <label className="text-label">{label}</label>
      {children}
    </div>
  );
}

export default function Agenda() {
  const [tab, setTab] = useState('oficinas');
  const [empresas, setEmpresas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [editingEmpresa, setEditingEmpresa] = useState(null);
  const [empresaForm, setEmpresaForm] = useState(EMPRESA_EMPTY);
  const [editingCliente, setEditingCliente] = useState(null);
  const [clienteForm, setClienteForm] = useState(CLIENTE_EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [empData, cliData, cat] = await Promise.all([
        api.empresasEmisoras({ all: true }),
        api.clientes(q, { agenda: true }),
        api.catalogoUbicacion(),
      ]);
      setEmpresas(empData.empresas || []);
      setClientes(cliData.clientes || []);
      setSedes(cat.sedes || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const empresasFiltradas = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term || tab !== 'oficinas') return empresas;
    return empresas.filter((e) =>
      [e.nombre, e.razonSocial, e.cuit, e.localidad, e.sedeCodigo, e.email]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [empresas, q, tab]);

  const clientesFiltrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term || tab !== 'clientes') return clientes;
    return clientes.filter((c) =>
      [c.nombre, c.razonSocial, c.cuit, c.localidad, c.email, c.contacto, c.telefono]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [clientes, q, tab]);

  const sedeLabel = (codigo) => {
    if (!codigo) return '—';
    const s = sedes.find((x) => x.codigo === codigo);
    return s ? `${s.codigo} — ${s.nombre}` : codigo;
  };

  const openNewEmpresa = () => {
    setEditingEmpresa('new');
    setEmpresaForm({ ...EMPRESA_EMPTY });
    setSuccess('');
    setError('');
  };

  const openEditEmpresa = (e) => {
    setEditingEmpresa(e.id);
    setEmpresaForm({
      nombre: e.nombre || '',
      razonSocial: e.razonSocial || '',
      cuit: e.cuit || '',
      ingBrutos: e.ingBrutos || '',
      domicilio: e.domicilio || '',
      localidad: e.localidad || '',
      telefono: e.telefono || '',
      fax: e.fax || '',
      email: e.email || '',
      web: e.web || '',
      fechaInicioActividades: String(e.fechaInicioActividades || '').slice(0, 10),
      codigoDocumento: e.codigoDocumento || '91',
      sedeCodigo: e.sedeCodigo || '',
      notas: e.notas || '',
      activo: e.activo !== false,
      logoUrl: e.logoUrl || '',
      firmaUrl: e.firmaUrl || '',
    });
    setSuccess('');
    setError('');
  };

  const saveEmpresa = async (ev) => {
    ev.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const body = { ...empresaForm };
      delete body.logoUrl;
      delete body.firmaUrl;
      if (editingEmpresa === 'new') {
        const { empresa } = await api.createEmpresaEmisora(body);
        setSuccess(`Oficina "${empresa.nombre}" creada`);
        setEditingEmpresa(empresa.id);
        setEmpresaForm((f) => ({ ...f, logoUrl: empresa.logoUrl, firmaUrl: empresa.firmaUrl }));
      } else {
        const { empresa } = await api.updateEmpresaEmisora(editingEmpresa, body);
        setSuccess(`Oficina "${empresa.nombre}" actualizada`);
        setEmpresaForm((f) => ({
          ...f,
          logoUrl: empresa.logoUrl || f.logoUrl,
          firmaUrl: empresa.firmaUrl || f.firmaUrl,
        }));
      }
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const uploadAsset = async (kind, file) => {
    if (!editingEmpresa || editingEmpresa === 'new') {
      setError('Guardá la oficina primero y después subí el logo o la firma');
      return;
    }
    if (!file) return;
    setUploading(kind);
    setError('');
    try {
      const dataUrl = await fileToBase64(file);
      const result = await api.uploadEmpresaAsset(editingEmpresa, kind, {
        imageBase64: dataUrl,
        contentType: file.type || 'image/jpeg',
      });
      const url = result.url || result.logoUrl || result.firmaUrl;
      setEmpresaForm((f) => ({
        ...f,
        ...(kind === 'logo' ? { logoUrl: url } : { firmaUrl: url }),
      }));
      setSuccess(kind === 'logo' ? 'Logo actualizado' : 'Firma / sello actualizado');
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading('');
    }
  };

  const removeAsset = async (kind) => {
    if (!editingEmpresa || editingEmpresa === 'new') return;
    if (!window.confirm(`¿Quitar ${kind === 'logo' ? 'el logo' : 'la firma'}?`)) return;
    setUploading(kind);
    try {
      await api.deleteEmpresaAsset(editingEmpresa, kind);
      setEmpresaForm((f) => ({
        ...f,
        ...(kind === 'logo' ? { logoUrl: '' } : { firmaUrl: '' }),
      }));
      setSuccess(kind === 'logo' ? 'Logo eliminado' : 'Firma eliminada');
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading('');
    }
  };

  const openNewCliente = () => {
    setEditingCliente('new');
    setClienteForm({ ...CLIENTE_EMPTY });
    setSuccess('');
    setError('');
  };

  const openEditCliente = (c) => {
    setEditingCliente(c.id);
    setClienteForm({
      nombre: c.nombre || '',
      razonSocial: c.razonSocial || '',
      iva: c.iva || '',
      domicilio: c.domicilio || '',
      localidad: c.localidad || '',
      vRef: c.vRef || '',
      cuit: c.cuit || '',
      telefono: c.telefono || '',
      email: c.email || '',
      contacto: c.contacto || '',
      notas: c.notas || '',
      activo: c.activo !== false,
    });
    setSuccess('');
    setError('');
  };

  const saveCliente = async (ev) => {
    ev.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      if (editingCliente === 'new') {
        const { cliente } = await api.createCliente(clienteForm);
        setSuccess(`Cliente "${cliente.nombre}" creado`);
      } else {
        const { cliente } = await api.updateCliente(editingCliente, clienteForm);
        setSuccess(`Cliente "${cliente.nombre}" actualizado`);
      }
      setEditingCliente(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const deactivateCliente = async (c) => {
    if (!window.confirm(`¿Desactivar cliente "${c.nombre}"?`)) return;
    try {
      await api.deleteCliente(c.id);
      setSuccess(`Cliente "${c.nombre}" desactivado`);
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const onSearch = async (e) => {
    e.preventDefault();
    if (tab === 'clientes') {
      setLoading(true);
      try {
        const data = await api.clientes(q, { agenda: true });
        setClientes(data.clientes || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <FocusedPage maxWidth="max-w-6xl">
      <div className="mb-4">
        <h2 className="page-title">Agenda</h2>
        <p className="mt-1 text-sm text-muted">
          Oficinas (membrete de remitos: datos fiscales, logo y firma) y clientes para completar
          remitos, mails y transferencias.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          className={tab === 'oficinas' ? 'btn-primary py-2' : 'btn-secondary py-2'}
          onClick={() => {
            setTab('oficinas');
            setEditingCliente(null);
          }}
        >
          Oficinas / sucursales
        </button>
        <button
          type="button"
          className={tab === 'clientes' ? 'btn-primary py-2' : 'btn-secondary py-2'}
          onClick={() => {
            setTab('clientes');
            setEditingEmpresa(null);
          }}
        >
          Clientes
        </button>
      </div>

      <form onSubmit={onSearch} className="mb-4 flex flex-wrap gap-2">
        <input
          className="input-field min-w-[200px] flex-1"
          placeholder={tab === 'oficinas' ? 'Buscar oficina…' : 'Buscar cliente…'}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="submit" className="btn-secondary" disabled={loading}>
          Buscar
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={tab === 'oficinas' ? openNewEmpresa : openNewCliente}
        >
          {tab === 'oficinas' ? 'Nueva oficina' : 'Nuevo cliente'}
        </button>
      </form>

      {error && <div className="alert-error mb-4">{error}</div>}
      {success && <div className="alert-success mb-4">{success}</div>}

      {tab === 'oficinas' && (
        <>
          <div className="card mb-4 overflow-x-auto p-0">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="table-head">
                <tr>
                  <th className="px-3 py-2">Logo</th>
                  <th className="px-3 py-2">Oficina</th>
                  <th className="px-3 py-2">CUIT</th>
                  <th className="px-3 py-2">Sede stock</th>
                  <th className="px-3 py-2">Contacto</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {empresasFiltradas.map((e) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded border border-border bg-surface-muted">
                        {e.logoUrl ? (
                          <img src={e.logoUrl} alt="" className="max-h-full max-w-full object-contain" />
                        ) : (
                          <span className="text-[9px] text-subtle">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-semibold text-content">{e.nombre}</p>
                      <p className="text-xs text-muted">{e.razonSocial}</p>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{e.cuit || '—'}</td>
                    <td className="px-3 py-2 text-xs">{sedeLabel(e.sedeCodigo)}</td>
                    <td className="px-3 py-2 text-xs">
                      <p>{e.telefono || '—'}</p>
                      <p className="text-muted">{e.email || ''}</p>
                    </td>
                    <td className="px-3 py-2">
                      <span className={e.activo !== false ? 'text-emerald-600' : 'text-muted'}>
                        {e.activo !== false ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button type="button" className="btn-secondary py-1 text-sm" onClick={() => openEditEmpresa(e)}>
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
                {!empresasFiltradas.length && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-muted">
                      {loading ? 'Cargando…' : 'Sin oficinas'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {editingEmpresa && (
            <form onSubmit={saveEmpresa} className="card space-y-4">
              <h3 className="section-title">
                {editingEmpresa === 'new' ? 'Nueva oficina' : 'Editar oficina / membrete'}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nombre corto *">
                  <input
                    className="input-field"
                    required
                    value={empresaForm.nombre}
                    onChange={(e) => setEmpresaForm((f) => ({ ...f, nombre: e.target.value }))}
                  />
                </Field>
                <Field label="Razón social *">
                  <input
                    className="input-field"
                    required
                    value={empresaForm.razonSocial}
                    onChange={(e) => setEmpresaForm((f) => ({ ...f, razonSocial: e.target.value }))}
                  />
                </Field>
                <Field label="CUIT">
                  <input
                    className="input-field font-mono"
                    value={empresaForm.cuit}
                    onChange={(e) => setEmpresaForm((f) => ({ ...f, cuit: e.target.value }))}
                  />
                </Field>
                <Field label="Ing. Brutos">
                  <input
                    className="input-field"
                    value={empresaForm.ingBrutos}
                    onChange={(e) => setEmpresaForm((f) => ({ ...f, ingBrutos: e.target.value }))}
                  />
                </Field>
                <Field label="Domicilio" className="sm:col-span-2">
                  <input
                    className="input-field"
                    value={empresaForm.domicilio}
                    onChange={(e) => setEmpresaForm((f) => ({ ...f, domicilio: e.target.value }))}
                  />
                </Field>
                <Field label="Localidad">
                  <input
                    className="input-field"
                    value={empresaForm.localidad}
                    onChange={(e) => setEmpresaForm((f) => ({ ...f, localidad: e.target.value }))}
                  />
                </Field>
                <Field label="Sede de stock">
                  <select
                    className="input-field"
                    value={empresaForm.sedeCodigo}
                    onChange={(e) => setEmpresaForm((f) => ({ ...f, sedeCodigo: e.target.value }))}
                  >
                    <option value="">Sin vincular</option>
                    {sedes.map((s) => (
                      <option key={s.codigo} value={s.codigo}>
                        {s.codigo} — {s.nombre}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Teléfono">
                  <input
                    className="input-field"
                    value={empresaForm.telefono}
                    onChange={(e) => setEmpresaForm((f) => ({ ...f, telefono: e.target.value }))}
                  />
                </Field>
                <Field label="Fax">
                  <input
                    className="input-field"
                    value={empresaForm.fax}
                    onChange={(e) => setEmpresaForm((f) => ({ ...f, fax: e.target.value }))}
                  />
                </Field>
                <Field label="Email">
                  <input
                    className="input-field"
                    type="email"
                    value={empresaForm.email}
                    onChange={(e) => setEmpresaForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </Field>
                <Field label="Web">
                  <input
                    className="input-field"
                    value={empresaForm.web}
                    onChange={(e) => setEmpresaForm((f) => ({ ...f, web: e.target.value }))}
                  />
                </Field>
                <Field label="Inicio actividades">
                  <input
                    className="input-field"
                    type="date"
                    value={empresaForm.fechaInicioActividades}
                    onChange={(e) =>
                      setEmpresaForm((f) => ({ ...f, fechaInicioActividades: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Código documento">
                  <input
                    className="input-field"
                    value={empresaForm.codigoDocumento}
                    onChange={(e) =>
                      setEmpresaForm((f) => ({ ...f, codigoDocumento: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Notas" className="sm:col-span-2">
                  <textarea
                    className="input-field min-h-[60px]"
                    value={empresaForm.notas}
                    onChange={(e) => setEmpresaForm((f) => ({ ...f, notas: e.target.value }))}
                  />
                </Field>
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={empresaForm.activo !== false}
                    onChange={(e) => setEmpresaForm((f) => ({ ...f, activo: e.target.checked }))}
                  />
                  Activa (aparece al emitir remitos)
                </label>
              </div>

              <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
                <div>
                  <p className="text-label mb-2">Logo (membrete)</p>
                  <div className="mb-2 flex h-20 w-20 items-center justify-center overflow-hidden rounded border border-border bg-surface-muted">
                    {empresaForm.logoUrl ? (
                      <img src={empresaForm.logoUrl} alt="" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <span className="text-xs text-subtle">Sin logo</span>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={!!uploading || editingEmpresa === 'new'}
                    onChange={(e) => uploadAsset('logo', e.target.files?.[0])}
                  />
                  {empresaForm.logoUrl && (
                    <button
                      type="button"
                      className="mt-2 text-sm text-danger underline"
                      onClick={() => removeAsset('logo')}
                      disabled={!!uploading}
                    >
                      Quitar logo
                    </button>
                  )}
                </div>
                <div>
                  <p className="text-label mb-2">Firma / sello empresa</p>
                  <div className="mb-2 flex h-20 w-28 items-center justify-center overflow-hidden rounded border border-border bg-surface-muted">
                    {empresaForm.firmaUrl ? (
                      <img src={empresaForm.firmaUrl} alt="" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <span className="text-xs text-subtle">Sin firma</span>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={!!uploading || editingEmpresa === 'new'}
                    onChange={(e) => uploadAsset('firma', e.target.files?.[0])}
                  />
                  {empresaForm.firmaUrl && (
                    <button
                      type="button"
                      className="mt-2 text-sm text-danger underline"
                      onClick={() => removeAsset('firma')}
                      disabled={!!uploading}
                    >
                      Quitar firma
                    </button>
                  )}
                </div>
              </div>
              {editingEmpresa === 'new' && (
                <p className="text-xs text-subtle">
                  Guardá la oficina primero para poder subir logo y firma.
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar oficina'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setEditingEmpresa(null)}
                  disabled={saving}
                >
                  Cerrar
                </button>
              </div>
            </form>
          )}
        </>
      )}

      {tab === 'clientes' && (
        <>
          <div className="card mb-4 overflow-x-auto p-0">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="table-head">
                <tr>
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">CUIT</th>
                  <th className="px-3 py-2">Localidad</th>
                  <th className="px-3 py-2">Contacto</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {clientesFiltrados.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <p className="font-semibold text-content">{c.nombre}</p>
                      <p className="text-xs text-muted">{c.razonSocial || c.iva || ''}</p>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{c.cuit || '—'}</td>
                    <td className="px-3 py-2 text-xs">{c.localidad || '—'}</td>
                    <td className="px-3 py-2 text-xs">
                      <p>{c.contacto || c.telefono || '—'}</p>
                      <p className="text-muted">{c.email || ''}</p>
                    </td>
                    <td className="px-3 py-2">
                      <span className={c.activo !== false ? 'text-emerald-600' : 'text-muted'}>
                        {c.activo !== false ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="btn-secondary py-1 text-sm"
                          onClick={() => openEditCliente(c)}
                        >
                          Editar
                        </button>
                        {c.activo !== false && (
                          <button
                            type="button"
                            className="btn-secondary py-1 text-sm"
                            onClick={() => deactivateCliente(c)}
                          >
                            Baja
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!clientesFiltrados.length && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-muted">
                      {loading ? 'Cargando…' : 'Sin clientes'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {editingCliente && (
            <form onSubmit={saveCliente} className="card space-y-4">
              <h3 className="section-title">
                {editingCliente === 'new' ? 'Nuevo cliente' : 'Editar cliente'}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nombre / Señor(es) *">
                  <input
                    className="input-field"
                    required
                    value={clienteForm.nombre}
                    onChange={(e) => setClienteForm((f) => ({ ...f, nombre: e.target.value }))}
                  />
                </Field>
                <Field label="Razón social">
                  <input
                    className="input-field"
                    value={clienteForm.razonSocial}
                    onChange={(e) => setClienteForm((f) => ({ ...f, razonSocial: e.target.value }))}
                  />
                </Field>
                <Field label="Condición IVA">
                  <select
                    className="input-field"
                    value={clienteForm.iva}
                    onChange={(e) => setClienteForm((f) => ({ ...f, iva: e.target.value }))}
                  >
                    {IVA_OPTIONS.map((opt) => (
                      <option key={opt || 'empty'} value={opt}>
                        {opt || '—'}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="CUIT">
                  <input
                    className="input-field font-mono"
                    value={clienteForm.cuit}
                    onChange={(e) => setClienteForm((f) => ({ ...f, cuit: e.target.value }))}
                  />
                </Field>
                <Field label="Domicilio" className="sm:col-span-2">
                  <input
                    className="input-field"
                    value={clienteForm.domicilio}
                    onChange={(e) => setClienteForm((f) => ({ ...f, domicilio: e.target.value }))}
                  />
                </Field>
                <Field label="Localidad">
                  <input
                    className="input-field"
                    value={clienteForm.localidad}
                    onChange={(e) => setClienteForm((f) => ({ ...f, localidad: e.target.value }))}
                  />
                </Field>
                <Field label="V. Ref.">
                  <input
                    className="input-field"
                    value={clienteForm.vRef}
                    onChange={(e) => setClienteForm((f) => ({ ...f, vRef: e.target.value }))}
                  />
                </Field>
                <Field label="Contacto">
                  <input
                    className="input-field"
                    value={clienteForm.contacto}
                    onChange={(e) => setClienteForm((f) => ({ ...f, contacto: e.target.value }))}
                  />
                </Field>
                <Field label="Teléfono">
                  <input
                    className="input-field"
                    value={clienteForm.telefono}
                    onChange={(e) => setClienteForm((f) => ({ ...f, telefono: e.target.value }))}
                  />
                </Field>
                <Field label="Email">
                  <input
                    className="input-field"
                    type="email"
                    value={clienteForm.email}
                    onChange={(e) => setClienteForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </Field>
                <Field label="Notas" className="sm:col-span-2">
                  <textarea
                    className="input-field min-h-[60px]"
                    value={clienteForm.notas}
                    onChange={(e) => setClienteForm((f) => ({ ...f, notas: e.target.value }))}
                  />
                </Field>
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={clienteForm.activo !== false}
                    onChange={(e) => setClienteForm((f) => ({ ...f, activo: e.target.checked }))}
                  />
                  Activo
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar cliente'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setEditingCliente(null)}
                  disabled={saving}
                >
                  Cerrar
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </FocusedPage>
  );
}
