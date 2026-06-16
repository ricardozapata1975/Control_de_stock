import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client';

const ROLE_LABELS = {
  admin: 'Administrador',
  operario: 'Operario',
};

function normalizeRole(role) {
  return role === 'admin' ? 'admin' : 'operario';
}

function canReceiveInvite(user) {
  return Boolean(user.email && user.isActive && !user.hasPassword);
}

function RoleBadge({ role }) {
  const normalized = normalizeRole(role);
  return (
    <span className={normalized === 'admin' ? 'badge-role-admin' : 'badge-role-operario'}>
      {ROLE_LABELS[normalized]}
    </span>
  );
}

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ username: '', displayName: '', role: 'operario', email: '' });
  const [saving, setSaving] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvPreview, setCsvPreview] = useState(null);
  const [csvMode, setCsvMode] = useState('skip');
  const [csvLoading, setCsvLoading] = useState(false);
  const [sendingWelcomeId, setSendingWelcomeId] = useState(null);
  const [bulkSending, setBulkSending] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const selectAllRef = useRef(null);

  const inviteableUsers = useMemo(() => users.filter(canReceiveInvite), [users]);
  const selectedCount = selectedIds.size;
  const allInviteableSelected =
    inviteableUsers.length > 0 && inviteableUsers.every((u) => selectedIds.has(u.id));
  const someInviteableSelected = inviteableUsers.some((u) => selectedIds.has(u.id));

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.adminUsers();
      setUsers(data.users || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someInviteableSelected && !allInviteableSelected;
    }
  }, [someInviteableSelected, allInviteableSelected]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const valid = new Set(users.map((u) => u.id));
      const next = new Set([...prev].filter((id) => valid.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [users]);

  const createUser = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const data = await api.adminCreateUser(form);
      setMessage(data.message || 'Usuario creado.');
      setForm({ username: '', displayName: '', role: 'operario', email: '' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (user) => {
    setError('');
    setMessage('');
    try {
      await api.adminUpdateUser(user.id, { isActive: !user.isActive });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const sendWelcome = async (user) => {
    setError('');
    setMessage('');
    setSendingWelcomeId(user.id);
    try {
      const data = await api.adminSendWelcome(user.id);
      setMessage(data.message || `Invitación enviada a ${user.email}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSendingWelcomeId(null);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allInviteableSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(inviteableUsers.map((u) => u.id)));
  };

  const sendWelcomeBulk = async (targets, { clearSelection = false } = {}) => {
    if (!targets.length) {
      setError('No hay usuarios seleccionados para invitar.');
      return;
    }
    setError('');
    setMessage('');
    setBulkSending(true);
    let ok = 0;
    const failed = [];
    for (const user of targets) {
      try {
        await api.adminSendWelcome(user.id);
        ok += 1;
      } catch (err) {
        failed.push(`${user.username}: ${err.message}`);
      }
    }
    if (failed.length) {
      setError(`Enviados ${ok}/${targets.length}. Errores: ${failed.join('; ')}`);
    } else {
      setMessage(`Invitaciones enviadas a ${ok} usuario(s).`);
      if (clearSelection) setSelectedIds(new Set());
    }
    setBulkSending(false);
  };

  const inviteSelected = async () => {
    const targets = users.filter((u) => selectedIds.has(u.id) && canReceiveInvite(u));
    if (!targets.length) {
      setError('Seleccioná al menos un usuario activo sin contraseña con correo.');
      return;
    }
    if (
      !window.confirm(
        `¿Enviar invitación a ${targets.length} usuario(s) seleccionado(s)?\nSe enviará un correo con los pasos de primer ingreso.`
      )
    ) {
      return;
    }
    await sendWelcomeBulk(targets, { clearSelection: true });
  };

  const inviteAllPending = async () => {
    if (!inviteableUsers.length) {
      setError('No hay usuarios activos sin contraseña con correo registrado.');
      return;
    }
    if (
      !window.confirm(
        `¿Enviar invitación a ${inviteableUsers.length} usuario(s) sin contraseña?\nSe enviará un correo con los pasos de primer ingreso.`
      )
    ) {
      return;
    }
    await sendWelcomeBulk(inviteableUsers);
  };

  const resetPassword = async (user) => {
    if (
      !window.confirm(
        `¿Restablecer contraseña de "${user.username}"?\nDeberá crear una nueva en su próximo ingreso.`
      )
    ) {
      return;
    }
    setError('');
    setMessage('');
    try {
      const data = await api.adminResetPassword(user.id);
      setMessage(data.message || 'Contraseña restablecida.');
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const updateRole = async (user, role, selectEl) => {
    const nextRole = normalizeRole(role);
    const currentRole = normalizeRole(user.role);
    if (nextRole === currentRole) return;

    if (nextRole === 'admin') {
      const label = user.name || user.displayName || user.username;
      if (
        !window.confirm(
          `¿Dar permisos de administrador a "${label}" (${user.username})?\nPodrá gestionar usuarios, stock e importaciones.`
        )
      ) {
        if (selectEl) selectEl.value = currentRole;
        return;
      }
    }

    setError('');
    setMessage('');
    try {
      await api.adminUpdateUser(user.id, { role: nextRole });
      setMessage(`Rol de "${user.username}" actualizado a ${ROLE_LABELS[nextRole]}.`);
      await load();
    } catch (err) {
      setError(err.message);
      if (selectEl) selectEl.value = currentRole;
    }
  };

  const onCsvFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    setCsvPreview(null);
    e.target.value = '';
  };

  const previewCsv = async () => {
    if (!csvText.trim()) {
      setError('Seleccioná o pegá un CSV primero');
      return;
    }
    setCsvLoading(true);
    setError('');
    setMessage('');
    try {
      const data = await api.adminUsersImportPreview(csvText);
      setCsvPreview(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCsvLoading(false);
    }
  };

  const importCsv = async () => {
    if (!csvText.trim()) return;
    if (!window.confirm('¿Importar usuarios desde el CSV?')) return;
    setCsvLoading(true);
    setError('');
    setMessage('');
    try {
      const data = await api.adminUsersImport(csvText, csvMode);
      setMessage(
        `Importación: ${data.creados} creados, ${data.actualizados} actualizados, ${data.omitidos} omitidos, ${data.errores?.length || 0} errores.`
      );
      setCsvPreview(null);
      setCsvText('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCsvLoading(false);
    }
  };

  return (
    <div>
      <h2 className="page-title mb-2">Usuarios</h2>
      <p className="mb-6 text-muted">
        Creá cuentas de operarios y administradores. Sin contraseña inicial: el usuario la define en
        su primer ingreso. Podés restablecerla para forzar un nuevo alta de contraseña.
      </p>

      {error && <div className="alert-error mb-4">{error}</div>}
      {message && <div className="alert-success mb-4">{message}</div>}

      <form onSubmit={createUser} className="card mb-6 max-w-xl space-y-4">
        <h3 className="section-title">Nuevo usuario</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-label">Usuario (login)</label>
            <input
              className="input-field"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="ej: jperez"
              required
              minLength={3}
            />
          </div>
          <div>
            <label className="text-label">Nombre para mostrar</label>
            <input
              className="input-field"
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              placeholder="ej: Juan Pérez"
              required
            />
          </div>
        </div>
        <div>
          <label className="text-label">Rol</label>
          <select
            className="input-field max-w-xs"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <option value="operario">Operario</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
        <div>
          <label className="text-label">Correo (opcional, para recuperar contraseña)</label>
          <input
            type="email"
            className="input-field"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="usuario@empresa.com"
          />
        </div>
        <button type="submit" className="btn-primary max-w-xs" disabled={saving}>
          {saving ? 'Creando...' : 'Crear usuario'}
        </button>
      </form>

      <form className="card mb-6 space-y-4">
        <h3 className="section-title">Importar desde Microsoft 365 Admin</h3>
        <p className="text-sm text-muted">
          Exportá usuarios desde admin.cloud.microsoft (CSV UTF-8). Se crean como operarios sin
          contraseña inicial; el correo se usa para recuperación.
        </p>
        <div>
          <label className="text-label">Archivo CSV</label>
          <input type="file" accept=".csv,text/csv" className="input-field" onChange={onCsvFile} />
        </div>
        <div>
          <label className="text-label">O pegar contenido CSV</label>
          <textarea
            className="input-field min-h-[120px] font-mono text-xs"
            value={csvText}
            onChange={(e) => {
              setCsvText(e.target.value);
              setCsvPreview(null);
            }}
            placeholder="Display name, User principal name, ..."
          />
        </div>
        <div>
          <label className="text-label">Si el usuario ya existe</label>
          <select
            className="input-field max-w-xs"
            value={csvMode}
            onChange={(e) => setCsvMode(e.target.value)}
          >
            <option value="skip">Omitir</option>
            <option value="update">Actualizar nombre y correo</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn-secondary" onClick={previewCsv} disabled={csvLoading}>
            {csvLoading ? 'Procesando...' : 'Vista previa'}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={importCsv}
            disabled={csvLoading || !csvText.trim()}
          >
            Importar usuarios
          </button>
        </div>
        {csvPreview && (
          <div className="rounded-lg border border-border bg-surface-muted/60 p-4 text-sm">
            <p>
              Total: {csvPreview.total} · Crear: {csvPreview.crear} · Actualizar:{' '}
              {csvPreview.actualizar} · Omitir: {csvPreview.omitir} · Errores: {csvPreview.errores}
            </p>
          </div>
        )}
      </form>

      <div className="card overflow-x-auto p-0">
        {inviteableUsers.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <span className="text-sm font-medium text-content-muted">
              {selectedCount} seleccionado{selectedCount === 1 ? '' : 's'}
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="min-h-[44px] rounded-lg border border-accent/50 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent transition hover:bg-accent/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                onClick={inviteSelected}
                disabled={bulkSending || loading || selectedCount === 0}
              >
                {bulkSending ? 'Enviando invitaciones...' : 'Enviar invitación a seleccionados'}
              </button>
              <button
                type="button"
                className="min-h-[44px] rounded-lg border border-border px-3 py-2 text-sm font-semibold text-content-muted transition hover:bg-surface-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                onClick={inviteAllPending}
                disabled={bulkSending || loading}
              >
                Invitar a todos sin contraseña
              </button>
            </div>
          </div>
        )}
        <table className="w-full text-left text-sm">
          <thead className="table-head">
            <tr>
              <th className="w-12 px-2 py-3">
                {inviteableUsers.length > 0 && (
                  <label className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allInviteableSelected}
                      onChange={toggleSelectAll}
                      disabled={bulkSending || loading}
                      className="h-5 w-5 accent-accent disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Seleccionar todos los usuarios invitables"
                    />
                  </label>
                )}
              </th>
              <th className="px-4 py-3">Usuario</th>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Correo</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Contraseña</th>
              <th className="px-4 py-3">Último ingreso</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-muted">
                  Cargando...
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="table-row">
                  <td className="px-2 py-3">
                    {canReceiveInvite(u) ? (
                      <label className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(u.id)}
                          onChange={() => toggleSelect(u.id)}
                          disabled={bulkSending}
                          className="h-5 w-5 accent-accent disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label={`Seleccionar ${u.username} para invitación`}
                        />
                      </label>
                    ) : (
                      <span
                        className="flex min-h-[44px] min-w-[44px] items-center justify-center"
                        aria-hidden="true"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-accent">{u.username}</td>
                  <td className="px-4 py-3">{u.name || u.displayName}</td>
                  <td className="px-4 py-3 text-subtle">{u.email || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <RoleBadge role={u.role} />
                      <select
                        className="select-field"
                        value={normalizeRole(u.role)}
                        onChange={(e) => updateRole(u, e.target.value, e.target)}
                        aria-label={`Cambiar rol de ${u.username}`}
                      >
                        <option value="operario">Operario</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-bold ${
                        u.isActive ? 'bg-emerald-800 text-emerald-100' : 'bg-red-900 text-red-100'
                      }`}
                    >
                      {u.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-subtle">
                    {!u.hasPassword
                      ? 'Pendiente (primer ingreso)'
                      : u.mustChangePassword
                        ? 'Debe cambiar'
                        : 'Definida'}
                  </td>
                  <td className="px-4 py-3 text-subtle">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('es-AR') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {u.email && (
                        <button
                          type="button"
                          className="min-h-[36px] rounded-lg border border-sky-700 px-2 py-1 text-xs font-semibold text-sky-200 hover:bg-sky-950 disabled:opacity-50"
                          onClick={() => sendWelcome(u)}
                          disabled={sendingWelcomeId === u.id || bulkSending}
                        >
                          {sendingWelcomeId === u.id ? 'Enviando...' : 'Enviar invitación'}
                        </button>
                      )}
                      <button
                        type="button"
                        className="rounded-lg border border-slate-500 px-2 py-1 text-xs font-semibold hover:bg-slate-800"
                        onClick={() => toggleActive(u)}
                      >
                        {u.isActive ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-amber-700 px-2 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-950"
                        onClick={() => resetPassword(u)}
                      >
                        Resetear clave
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-subtle">
        También podés ver la tabla en{' '}
        <a href="/admin/base-datos" className="text-sky-300 underline">
          Base datos → Usuarios
        </a>{' '}
        (solo lectura).
      </p>
    </div>
  );
}
