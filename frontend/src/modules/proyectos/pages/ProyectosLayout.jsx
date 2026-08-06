import { Outlet, NavLink } from 'react-router-dom';

export default function ProyectosLayout() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="page-title">PROYECTOS</h1>
          <p className="text-sm text-muted">
            Fabricación de tableros · reservas (limbo) · faltantes · pedidos
          </p>
        </div>
        <NavLink to="/proyectos" end className="text-sm text-accent underline">
          Dashboard
        </NavLink>
      </div>
      <Outlet />
    </div>
  );
}
