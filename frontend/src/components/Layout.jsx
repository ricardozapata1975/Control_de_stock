import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import OfflineStatus from './OfflineStatus';
import ThemeToggle from './ThemeToggle';

const links = [
  { to: '/', label: 'Inventario', end: true },
  { to: '/escanear', label: 'QR' },
  { to: '/egreso', label: 'Egreso' },
  { to: '/ingreso', label: 'Ingreso' },
  { to: '/historial', label: 'Historial' },
  { to: '/imprimir-qr', label: 'Etiquetas' },
];

const adminLinks = [
  { to: '/admin', label: 'Admin' },
  { to: '/admin/usuarios', label: 'Usuarios' },
  { to: '/admin/importar', label: 'Importar' },
];

function NavItems({ items, onNavigate }) {
  return (
    <ul className="space-y-1">
      {items.map((l) => (
        <li key={l.to}>
          <NavLink
            to={l.to}
            end={l.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `nav-link ${isActive ? 'nav-link-active' : 'nav-link-inactive'}`
            }
          >
            {l.label}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navLinks = isAdmin ? [...links, ...adminLinks] : links;

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

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
        </div>

        <nav className="flex-1 overflow-y-auto p-3" aria-label="Navegación principal">
          <NavItems items={navLinks} onNavigate={closeDrawer} />
        </nav>

        <div className="shrink-0 space-y-3 border-t border-border p-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-content">{user?.name}</p>
            {isAdmin && (
              <span className="mt-1 inline-block rounded bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800 dark:bg-sky-800 dark:text-sky-100">
                Admin
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
              <p className="truncate text-xs text-content-muted">{user?.name}</p>
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

        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center overflow-x-hidden overflow-y-auto p-4 sm:p-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
