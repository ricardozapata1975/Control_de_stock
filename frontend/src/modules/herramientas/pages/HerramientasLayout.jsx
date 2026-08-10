import { NavLink, Outlet } from 'react-router-dom';
import { HERRAMIENTAS_NAV } from '../constants';
import { useAuth } from '../../../auth/AuthProvider';
import { hasPermission } from '../../../utils/permissions';

export default function HerramientasLayout() {
  const { user } = useAuth();
  const links = HERRAMIENTAS_NAV.filter((a) => hasPermission(user, a.permission));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="page-title">HERRAMIENTAS / PAÑOL</h1>
          <p className="text-sm text-muted">
            Depósito por sede · préstamos individuales y cajas · devolución e historial
          </p>
        </div>
      </div>
      <nav className="flex flex-wrap gap-2 border-b border-border pb-2">
        {links.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `rounded-md px-3 py-1.5 text-sm ${
                isActive ? 'bg-accent text-white' : 'bg-surface text-muted hover:text-fg'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
