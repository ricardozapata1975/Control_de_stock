import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ username: '', displayName: '', role: 'operario' });
  const [saving, setSaving] = useState(false);

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

  const createUser = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const data = await api.adminCreateUser(form);
      setMessage(data.message || 'Usuario creado.');
      setForm({ username: '', displayName: '', role: 'operario' });
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

  const updateRole = async (user, role) => {
    setError('');
    try {
      await api.adminUpdateUser(user.id, { role });
      await load();
    } catch (err) {
      setError(err.message);
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
        <button type="submit" className="btn-primary max-w-xs" disabled={saving}>
          {saving ? 'Creando...' : 'Crear usuario'}
        </button>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="table-head">
            <tr>
              <th className="px-4 py-3">Usuario</th>
              <th className="px-4 py-3">Nombre</th>
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
                <td colSpan={7} className="px-4 py-6 text-center text-muted">
                  Cargando...
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="table-row">
                  <td className="px-4 py-3 font-mono text-amber-300">{u.username}</td>
                  <td className="px-4 py-3">{u.name || u.displayName}</td>
                  <td className="px-4 py-3">
                    <select
                      className="input-field py-1 text-sm"
                      value={u.role}
                      onChange={(e) => updateRole(u, e.target.value)}
                    >
                      <option value="operario">Operario</option>
                      <option value="admin">Administrador</option>
                    </select>
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
