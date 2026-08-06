import { ROLES_MODULO } from '../constants';

export default function ConfiguracionPage() {
  return (
    <div className="space-y-4">
      <h2 className="section-title">Configuración del módulo</h2>
      <p className="text-sm text-muted">
        Matriz de roles prevista para Proyectos. Hoy la app usa roles globales{' '}
        <strong>admin / operario</strong>; esta matriz documenta el diseño sin alterar el login
        existente (Fase posterior: permisos por módulo en usuarios).
      </p>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="py-2">Función</th>
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
