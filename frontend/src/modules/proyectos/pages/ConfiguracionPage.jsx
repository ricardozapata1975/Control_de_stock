import { Link } from 'react-router-dom';
import { ROLES_MODULO } from '../constants';
import { fieldLabel } from '../../../utils/fieldLabels';

/**
 * Vista de referencia del módulo. La matriz editable del sitio está en Admin → Roles.
 */
export default function ConfiguracionPage() {
  return (
    <div className="space-y-4">
      <h2 className="section-title">Configuración del módulo</h2>
      <p className="text-sm text-muted">
        Los roles y permisos del sitio (todas las páginas) se administran en{' '}
        <Link className="text-accent underline" to="/admin/roles">
          Agenda → Roles y permisos
        </Link>
        . Ahí podés crear roles nuevos y marcar qué ve cada uno. En Usuarios asignás el rol y las
        sucursales a cada cuenta.
      </p>

      <div className="card overflow-x-auto">
        <p className="mb-2 text-sm font-semibold">Referencia histórica (módulo Proyectos)</p>
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="py-2">{fieldLabel('permisos')}</th>
              {ROLES_MODULO.map((r) => (
                <th key={r.id} className="px-2 py-2">
                  {r.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROLES_MODULO[0].permisos.map((_, idx) => {
              const label = ROLES_MODULO[0].permisos[idx].label;
              return (
                <tr key={label} className="border-b border-border/60">
                  <td className="py-2 pr-2">{label}</td>
                  {ROLES_MODULO.map((r) => (
                    <td key={r.id} className="px-2 text-center">
                      {r.permisos[idx]?.ok ? '✓' : '—'}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
