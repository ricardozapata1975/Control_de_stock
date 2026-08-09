import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { api } from '../api/client';
import { filterNavGroups } from '../nav/appNav';
import OfflineStatus from './OfflineStatus';
import ThemeToggle from './ThemeToggle';

function AccesoLink({ item, onNavigate }) {
  if (item.soon || !item.to) {
    return (
      <span className="block rounded-md px-2 py-1.5 text-sm text-content-muted opacity-70" title="Próximamente">
        {item.label}
      </span>
    );
  }
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `block rounded-md px-2 py-1.5 text-sm transition ${
          isActive
            ? 'bg-accent/15 font-semibold text-accent'
            : 'text-content-muted hover:bg-surface-hover hover:text-content'
        }`
      }
    >
      {item.label}
    </NavLink>
  );
}

function NavGroups({ groups, onNavigate }) {
  const location = useLocation();
  const path = location.pathname;

  const initialOpen = useMemo(() => {
    const open = {};
    for (const g of groups) {
      open[g.id] = typeof g.match === 'function' ? g.match(path) : false;
    }
    // Si ninguno matchea, abrir Inventario
    if (!Object.values(open).some(Boolean)) open.inventario = true;
    return open;
  }, [groups, path]);

  const [openMap, setOpenMap] = useState(initialOpen);

  useEffect(() => {
    setOpenMap((prev) => {
      const next = { ...prev };
      for (const g of groups) {
        if (typeof g.match === 'function' && g.match(path)) next[g.id] = true;
      }
      return next;
    });
  }, [path, groups]);

  const toggle = (id) => setOpenMap((m) => ({ ...m, [id]: !m[id] }));

  return (
    <ul className="space-y-2">
      {groups.map((g) => {
        const isOpen = Boolean(openMap[g.id]);
        const sectionActive = typeof g.match === 'function' && g.match(path);
        return (
          <li key={g.id} className="rounded-lg border border-border/70 bg-surface-muted/40">
            <div className="flex items-stretch">
              <NavLink
                to={g.to}
                end={g.to === '/'}
                onClick={onNavigate}
                className={() =>
                  `nav-link min-w-0 flex-1 rounded-none rounded-l-lg border-0 ${
                    sectionActive ? 'nav-link-active' : 'nav-link-inactive'
                  }`
                }
              >
                {g.label}
              </NavLink>
              <button
                type="button"
                className="shrink-0 border-l border-border/70 px-3 text-content-muted hover:bg-surface-hover hover:text-content"
                aria-expanded={isOpen}
                aria-label={`${isOpen ? 'Ocultar' : 'Mostrar'} accesos de ${g.label}`}
                onClick={() => toggle(g.id)}
              >
                <svg
                  className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
            {isOpen && (
              <ul className="space-y-0.5 border-t border-border/60 px-2 py-2">
                {g.accesos.map((a) => (
                  <li key={`${g.id}-${a.to || a.label}`}>
                    <AccesoLink item={a} onNavigate={onNavigate} />
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default function Layout() {
  const { user, logout, isAdmin, permissions, sede, sedeNombre, switchSede } = useAuth();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sedes, setSedes] = useState([]);
  const [switching, setSwitching] = useState(false);
  const groups = useMemo(() => filterNavGroups(user), [user]);
  const canSwitchSede =
    isAdmin ||
    permissions?.includes('*') ||
    permissions?.includes('admin.cambiar_sede');

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    api
      .catalogoUbicacion()
      .then((cat) => setSedes(cat.sedes || []))
      .catch(() => setSedes([]));
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  const closeDrawer = () => setDrawerOpen(false);

  const onChangeSede = async (codigo) => {
    if (!codigo || codigo === sede) return;
    setSwitching(true);
    try {
      await switchSede(codigo);
      window.location.reload();
    } catch (err) {
      window.alert(err.message || 'No se pudo cambiar de sucursal');
    } finally {
      setSwitching(false);
    }
  };

  const sedeBlock = (
    <div className="min-w-0">
      <label className="text-[10px] font-semibold uppercase tracking-wide text-subtle">Sucursal</label>
      {canSwitchSede && sedes.length > 1 ? (
        <select
          className="mt-0.5 w-full rounded-md border border-border bg-surface-muted px-2 py-1.5 text-sm font-semibold text-content"
          value={sede || ''}
          disabled={switching}
          onChange={(e) => onChangeSede(e.target.value)}
        >
          {sedes.map((s) => (
            <option key={s.codigo} value={s.codigo}>
              {s.nombre || s.codigo}
            </option>
          ))}
        </select>
      ) : (
        <p className="truncate text-sm font-semibold text-accent" title={sede || undefined}>
          {sedeNombre || sede || '—'}
        </p>
      )}
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      {drawerOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          aria-label="Cerrar menú"
          onClick={closeDrawer}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-72 max-w-[85vw] flex-col border-r border-border bg-surface-elevated transition-transform duration-200 ease-in-out lg:max-w-none lg:translate-x-0 ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="shrink-0 border-b border-border p-4">
          <img
            src="/px-control-logo.png"
            alt="PX Control"
            className="h-10 w-auto max-w-full object-contain"
          />
          <p className="mt-2 text-sm font-bold text-content">Inventario Px Control</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-subtle">
            Menú principal
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto p-3" aria-label="Navegación principal">
          <NavGroups groups={groups} onNavigate={closeDrawer} />
        </nav>

        <div className="shrink-0 space-y-3 border-t border-border p-4">
          {sedeBlock}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-content">{user?.name}</p>
            {user?.role && (
              <span className="mt-1 inline-block rounded bg-sky-100 px-2 py-0.5 text-xs font-semibold capitalize text-sky-800 dark:bg-sky-800 dark:text-sky-100">
                {user.role}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle className="flex-1" />
            <button
              type="button"
              onClick={logout}
              className="min-h-[44px] flex-1 rounded-lg border border-border px-3 text-sm font-semibold text-content-muted transition hover:bg-surface-hover hover:text-content"
            >
              Salir
            </button>
          </div>
        </div>
      </aside>

      <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden lg:ml-72">
        <header className="shrink-0 border-b border-border bg-surface-elevated">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              type="button"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-border text-content lg:hidden"
              onClick={() => setDrawerOpen(true)}
              aria-label="Abrir menú"
              aria-expanded={drawerOpen}
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="min-w-0 flex-1 lg:hidden">
              <h1 className="truncate text-sm font-bold text-content">Inventario Px Control</h1>
              <p className="truncate text-xs text-content-muted">
                {sedeNombre || sede || user?.name}
              </p>
            </div>

            <div className="ml-auto flex items-center gap-2 lg:hidden">
              <ThemeToggle />
              <button
                type="button"
                onClick={logout}
                className="min-h-[44px] rounded-lg px-3 text-sm font-semibold text-content-muted hover:text-content"
              >
                Salir
              </button>
            </div>
          </div>
          <OfflineStatus />
        </header>

        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-stretch overflow-x-hidden overflow-y-auto p-4 sm:p-5 md:items-center">
          <div className="w-full min-w-0">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
