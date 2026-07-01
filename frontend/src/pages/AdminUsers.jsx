import { useEffect, useMemo, useRef, useState } from 'react';
import FocusedPage from '../components/FocusedPage';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import UserFilters from '../components/UserFilters';
import { UserRowCard, UserRowTable } from '../components/admin/UserRow';
import { normalizeRole } from '../utils/role';

const DEFAULT_FILTERS = { q: '', domain: '', status: 'all' };

const ROLE_LABELS = {
  admin: 'Administrador',
  operario: 'Operario',
};

const rowProps = (ctx, u) => ({
  user: u,
  canInvite: canReceiveInvite(u),
  selected: ctx.selectedIds.has(u.id),
  bulkSending: ctx.bulkSending,
  currentUserId: ctx.currentUser?.id,
  sendingWelcomeId: ctx.sendingWelcomeId,
  deletingUserId: ctx.deletingUserId,
  onToggleSelect: ctx.toggleSelect,
  onSendWelcome: ctx.sendWelcome,
  onToggleActive: ctx.toggleActive,
  onResetPassword: ctx.resetPassword,
  onDelete: ctx.deleteUser,
  onUpdateRole: ctx.updateRole,
});

function canReceiveInvite(user) {
  return Boolean(user.email && user.isActive && !user.hasPassword);
}

function matchesUserFilters(user, filters) {
  const q = filters.q.trim().toLowerCase();
  if (q) {
    const haystack = [user.username, user.name, user.displayName, user.email]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }

  if (filters.status === 'active' && !user.isActive) return false;
  if (filters.status === 'inactive' && user.isActive) return false;

  const domain = filters.domain.trim().toLowerCase().replace(/^@/, '');
  if (domain) {
    const email = String(user.email || '').toLowerCase();
    if (!email.includes(`@${domain}`)) return false;
  }

  return true;
}

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
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
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [bulkSending, setBulkSending] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const selectAllRef = useRef(null);

  const emailDomains = useMemo(() => {
    const domains = new Set();
    for (const u of users) {
      const email = String(u.email || '').toLowerCase();
      const at = email.lastIndexOf('@');
      if (at > 0) domains.add(email.slice(at));
    }
    return [...domains].sort();
  }, [users]);

  const filteredUsers = useMemo(
    () => users.filter((u) => matchesUserFilters(u, filters)),
    [users, filters]
  );

  const hasActiveFilters =
    filters.q.trim() !== '' || filters.domain.trim() !== '' || filters.status !== 'all';

  const inviteableUsers = useMemo(() => filteredUsers.filter(canReceiveInvite), [filteredUsers]);
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
    const targets = filteredUsers.filter((u) => selectedIds.has(u.id) && canReceiveInvite(u));
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

  const deleteUser = async (user) => {
    const label = user.name || user.displayName || user.username;
    if (
      !window.confirm(
        `¿Eliminar la cuenta de "${label}" (${user.username})?\nEsta acción no se puede deshacer.`
      )
    ) {
      return;
    }
    setError('');
    setMessage('');
    setDeletingUserId(user.id);
    try {
      const data = await api.adminDeleteUser(user.id);
      setMessage(data.message || `Usuario "${user.username}" eliminado.`);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(user.id);
        return next;
      });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingUserId(null);
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
    <FocusedPage maxWidth="max-w-5xl">
      <h2 className="page-title mb-2">Usuarios</h2>
      <p className="mb-6 text-muted">
        Creá cuentas de operarios y administradores. Sin contraseña inicial: el usuario la define en
        su primer ingreso. Podés restablecerla para forzar un nuevo alta de contraseña.
      </p>

      {error && <div className="alert-error mb-4">{error}</div>}
      {message && <div className="alert-success mb-4">{message}</div>}

      <form onSubmit={createUser} className="card mx-auto mb-6 max-w-xl space-y-4">
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

      <UserFilters
        filters={filters}
        onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
        domains={emailDomains}
      />

      {hasActiveFilters && !loading && (
        <p className="mb-4 text-sm text-content-muted">
          Mostrando {filteredUsers.length} de {users.length} usuario
          {users.length === 1 ? '' : 's'}
        </p>
      )}

      <div className="card overflow-hidden p-0">
        {inviteableUsers.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
            <span className="text-xs font-medium text-content-muted">
              {selectedCount} seleccionado{selectedCount === 1 ? '' : 's'}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-lg border border-accent/50 bg-accent/10 px-2.5 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                onClick={inviteSelected}
                disabled={bulkSending || loading || selectedCount === 0}
                title="Enviar invitación a seleccionados"
              >
                {bulkSending ? 'Enviando…' : 'Invitar seleccionados'}
              </button>
              <button
                type="button"
                className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-content-muted transition hover:bg-surface-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                onClick={inviteAllPending}
                disabled={bulkSending || loading}
                title="Invitar a todos sin contraseña"
              >
                Invitar todos
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2 p-2 md:hidden">
          {loading ? (
            <p className="py-6 text-center text-sm text-muted">Cargando...</p>
          ) : filteredUsers.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              {users.length === 0
                ? 'No hay usuarios registrados.'
                : 'Ningún usuario coincide con los filtros.'}
            </p>
          ) : (
            filteredUsers.map((u) => (
              <UserRowCard
                key={u.id}
                {...rowProps(
                  {
                    selectedIds,
                    bulkSending,
                    currentUser,
                    sendingWelcomeId,
                    deletingUserId,
                    toggleSelect,
                    sendWelcome,
                    toggleActive,
                    resetPassword,
                    deleteUser,
                    updateRole,
                  },
                  u
                )}
              />
            ))
          )}
        </div>

        <table className="hidden w-full table-fixed text-left md:table">
          <thead className="table-head">
            <tr>
              <th className="w-8 px-1.5 py-2">
                {inviteableUsers.length > 0 && (
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allInviteableSelected}
                    onChange={toggleSelectAll}
                    disabled={bulkSending || loading}
                    className="h-4 w-4 accent-accent disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Seleccionar todos los usuarios invitables"
                  />
                )}
              </th>
              <th className="w-[18%] px-2 py-2">Usuario</th>
              <th className="w-[20%] px-2 py-2">Correo</th>
              <th className="w-[11%] px-1.5 py-2">Rol</th>
              <th className="w-[9%] px-1.5 py-2">Estado</th>
              <th className="hidden w-[10%] px-1.5 py-2 sm:table-cell">Clave</th>
              <th className="px-1.5 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-sm text-muted">
                  Cargando...
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-sm text-muted">
                  {users.length === 0
                    ? 'No hay usuarios registrados.'
                    : 'Ningún usuario coincide con los filtros.'}
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => (
                <UserRowTable
                  key={u.id}
                  {...rowProps(
                    {
                      selectedIds,
                      bulkSending,
                      currentUser,
                      sendingWelcomeId,
                      deletingUserId,
                      toggleSelect,
                      sendWelcome,
                      toggleActive,
                      resetPassword,
                      deleteUser,
                      updateRole,
                    },
                    u
                  )}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </FocusedPage>
  );
}
