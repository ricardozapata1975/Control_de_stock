import { Link } from 'react-router-dom';

const HUB_ITEMS = [
  {
    to: '/proyectos/recepciones/carga',
    icon: '📄',
    label: 'Carga de remito',
    desc: 'Formulario documental: proveedor, nro. remito y líneas.',
  },
  {
    to: '/proyectos/recepciones/ingreso',
    icon: '📷',
    label: 'Ingreso físico',
    desc: 'Pendientes de ingreso, escaneo y cierre a aduana.',
  },
  {
    to: '/proyectos/recepciones/aduana',
    icon: '📦',
    label: 'Desde aduana',
    desc: 'Stock en aduana: ubicar en depósito o asignar FIFO a proyecto.',
  },
];

export default function RecepcionesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="section-title">Recepciones</h2>
        <p className="text-sm text-muted">
          Flujo en tres pasos: carga documental, ingreso físico y despacho desde aduana.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {HUB_ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="card border-accent/40 transition hover:border-accent"
          >
            <p className="text-lg font-semibold text-content">
              <span className="mr-2" aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </p>
            <p className="mt-1 text-sm text-muted">{item.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
