import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import OfflineStatus from './OfflineStatus';

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
  { to: '/admin/importar', label: 'Importar' },
  { to: '/admin/base-datos', label: 'Base datos' },
];

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const navLinks = isAdmin ? [...links, ...adminLinks] : links;

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/px-control-logo.png"
              alt="PX Control"
              className="h-10 w-auto max-w-[180px] shrink-0 object-contain sm:h-12 sm:max-w-[220px]"
            />
            <div className="min-w-0 border-l border-slate-700 pl-3">
              <h1 className="truncate text-sm font-bold text-slate-100 sm:text-base">Inventario Px Control</h1>
              <p className="truncate text-xs text-slate-300 sm:text-sm">
                {user?.name}
                {isAdmin && (
                  <span className="ml-2 rounded bg-sky-800 px-2 py-0.5 text-xs text-sky-100">Admin</span>
                )}
              </p>
            </div>
          </div>
          <button type="button" onClick={logout} className="text-sm text-slate-200 hover:text-white">
            Salir
          </button>
        </div>
        <OfflineStatus />
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 pb-2">
          {navLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-bold uppercase tracking-wide ${
                  isActive
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl p-4">
        <Outlet />
      </main>
    </div>
  );
}
