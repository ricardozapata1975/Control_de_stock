import { Link } from 'react-router-dom';

export default function ProyectosPlaceholder({ title, description }) {
  return (
    <div className="card max-w-xl">
      <h2 className="section-title">{title}</h2>
      <p className="mt-2 text-muted">{description}</p>
      <p className="mt-4 text-sm text-content-muted">
        Planificado para una fase posterior del módulo Proyectos. El núcleo actual (proyectos,
        tableros, pedidos, reservas y faltantes) no depende de esta pantalla.
      </p>
      <Link to="/proyectos" className="btn-secondary mt-4 inline-block">
        Volver al dashboard
      </Link>
    </div>
  );
}
