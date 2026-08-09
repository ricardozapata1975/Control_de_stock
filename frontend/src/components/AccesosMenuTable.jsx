import { Link } from 'react-router-dom';
import { filterNavGroups } from '../nav/appNav';
import { useAuth } from '../auth/AuthProvider';

/**
 * Tabla Menú principal | Accesos rápidos (esquema Inventario / Agenda / Proyectos).
 */
export default function AccesosMenuTable({ className = '' }) {
  const { isAdmin } = useAuth();
  const groups = filterNavGroups(isAdmin);

  return (
    <div className={`overflow-x-auto rounded-xl border border-edge ${className}`}>
      <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
        <thead className="bg-surface-2">
          <tr>
            <th className="w-[28%] border-b border-edge px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-content-muted">
              Menú principal
            </th>
            <th className="border-b border-edge px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-content-muted">
              Accesos rápidos
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.id} className="align-top odd:bg-surface even:bg-surface-muted/30">
              <td className="border-b border-edge px-3 py-3">
                <Link to={g.to} className="font-semibold text-accent underline-offset-2 hover:underline">
                  {g.label}
                </Link>
              </td>
              <td className="border-b border-edge px-3 py-3">
                <ul className="flex flex-col gap-1.5">
                  {g.accesos.map((a) => (
                    <li key={`${g.id}-${a.to || a.label}`}>
                      {a.soon || !a.to ? (
                        <span className="text-content-muted">{a.label}</span>
                      ) : (
                        <Link
                          to={a.to}
                          className="text-sky-700 underline underline-offset-2 hover:text-sky-500 dark:text-sky-300 dark:hover:text-sky-200"
                        >
                          {a.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
