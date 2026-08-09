import { Fragment, useEffect, useMemo, useState } from 'react';
import FocusedPage from '../components/FocusedPage';
import { api } from '../api/client';

export default function AdminRoles() {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [selected, setSelected] = useState('');
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [newRole, setNewRole] = useState({ codigo: '', nombre: '', descripcion: '' });

  const groups = useMemo(() => {
    const map = new Map();
    for (const p of permissions) {
      if (!map.has(p.group)) map.set(p.group, []);
      map.get(p.group).push(p);
    }
    return [...map.entries()];
  }, [permissions]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [cat, list] = await Promise.all([api.rolesCatalogo(), api.roles()]);
      setPermissions(cat.permissions || []);
      const rs = list.roles || [];
      setRoles(rs);
      if (!selected && rs.length) {
        setSelected(rs[0].codigo);
        setDraft({ ...rs[0], permisos: { ...rs[0].permisos } });
      } else if (selected) {
        const cur = rs.find((r) => r.codigo === selected);
        if (cur) setDraft({ ...cur, permisos: { ...cur.permisos } });
      }
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

  const pickRole = (codigo) => {
    const r = roles.find((x) => x.codigo === codigo);
    setSelected(codigo);
    setDraft(r ? { ...r, permisos: { ...r.permisos } } : null);
    setMessage('');
  };

  const togglePerm = (permId) => {
    if (!draft || draft.codigo === 'admin') return;
    setDraft((d) => ({
      ...d,
      permisos: { ...d.permisos, [permId]: !d.permisos?.[permId] },
    }));
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.updateRole(draft.codigo, {
        nombre: draft.nombre,
        descripcion: draft.descripcion,
        permisos: draft.permisos,
      });
      setMessage(`Rol "${draft.nombre}" guardado.`);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const create = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const base = roles.find((r) => r.codigo === 'operario');
      const data = await api.createRole({
        ...newRole,
        permisos: base?.permisos || {},
      });
      setMessage(`Rol "${data.role.nombre}" creado.`);
      setNewRole({ codigo: '', nombre: '', descripcion: '' });
      await load();
      pickRole(data.role.codigo);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!draft || draft.esSistema) return;
    if (!window.confirm(`¿Eliminar el rol "${draft.nombre}"?`)) return;
    setSaving(true);
    setError('');
    try {
      await api.deleteRole(draft.codigo);
      setSelected('');
      setDraft(null);
      setMessage('Rol eliminado.');
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FocusedPage maxWidth="max-w-6xl">
      <h2 className="page-title mb-2">Roles y permisos</h2>
      <p className="mb-6 text-muted">
        Definí qué páginas y funciones ve cada rol. Luego asigná el rol y las sucursales a cada
        usuario en Agenda → Usuarios.
      </p>

      {error && <div className="alert-error mb-4">{error}</div>}
      {message && <div className="alert-success mb-4">{message}</div>}
      {loading && <p className="text-muted">Cargando…</p>}

      <div className="mb-6 grid gap-4 lg:grid-cols-[220px_1fr]">
        <div className="card space-y-1 p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-subtle">Roles</p>
          {roles.map((r) => (
            <button
              key={r.codigo}
              type="button"
              className={`block w-full rounded-md px-2 py-1.5 text-left text-sm ${
                selected === r.codigo
                  ? 'bg-accent/20 font-semibold text-accent'
                  : 'hover:bg-surface-muted'
              }`}
              onClick={() => pickRole(r.codigo)}
            >
              {r.nombre}
              {r.esSistema ? (
                <span className="ml-1 text-[10px] text-subtle">(sistema)</span>
              ) : null}
            </button>
          ))}
        </div>

        {draft && (
          <div className="card space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-label">Nombre</label>
                <input
                  className="input-field"
                  value={draft.nombre}
                  disabled={draft.codigo === 'admin'}
                  onChange={(e) => setDraft({ ...draft, nombre: e.target.value })}
                />
              </div>
              <div>
                <label className="text-label">Código</label>
                <input className="input-field font-mono" value={draft.codigo} disabled />
              </div>
              <div className="sm:col-span-2">
                <label className="text-label">Descripción</label>
                <input
                  className="input-field"
                  value={draft.descripcion || ''}
                  onChange={(e) => setDraft({ ...draft, descripcion: e.target.value })}
                />
              </div>
            </div>

            {draft.codigo === 'admin' && (
              <p className="text-sm text-muted">El administrador siempre tiene todos los accesos.</p>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted">
                    <th className="py-2">Función / página</th>
                    <th className="w-20 px-2 py-2 text-center">Acceso</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map(([group, perms]) => (
                    <Fragment key={group}>
                      <tr>
                        <td
                          colSpan={2}
                          className="bg-surface-2 px-1 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-subtle"
                        >
                          {group}
                        </td>
                      </tr>
                      {perms.map((p) => (
                        <tr key={p.id} className="border-b border-border/50">
                          <td className="py-1.5 pr-2">
                            <div>{p.label}</div>
                            {p.path && (
                              <div className="font-mono text-[10px] text-subtle">{p.path}</div>
                            )}
                          </td>
                          <td className="px-2 text-center">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-accent"
                              checked={Boolean(draft.permisos?.[p.id]) || draft.codigo === 'admin'}
                              disabled={draft.codigo === 'admin' || saving}
                              onChange={() => togglePerm(p.id)}
                            />
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary" disabled={saving} onClick={save}>
                {saving ? 'Guardando…' : 'Guardar rol'}
              </button>
              {!draft.esSistema && (
                <button type="button" className="btn-secondary" disabled={saving} onClick={remove}>
                  Eliminar rol
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <form onSubmit={create} className="card max-w-xl space-y-3">
        <h3 className="section-title">Crear rol nuevo</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-label">Código</label>
            <input
              className="input-field font-mono"
              placeholder="ej: supervisor"
              value={newRole.codigo}
              onChange={(e) => setNewRole({ ...newRole, codigo: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="text-label">Nombre</label>
            <input
              className="input-field"
              placeholder="ej: Supervisor"
              value={newRole.nombre}
              onChange={(e) => setNewRole({ ...newRole, nombre: e.target.value })}
              required
            />
          </div>
        </div>
        <div>
          <label className="text-label">Descripción</label>
          <input
            className="input-field"
            value={newRole.descripcion}
            onChange={(e) => setNewRole({ ...newRole, descripcion: e.target.value })}
          />
        </div>
        <p className="text-xs text-muted">
          Se crea copiando los permisos del rol Operario; después los editás en la matriz.
        </p>
        <button type="submit" className="btn-primary max-w-xs" disabled={saving}>
          Crear rol
        </button>
      </form>
    </FocusedPage>
  );
}
