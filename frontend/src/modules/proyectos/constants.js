/** Constantes y navegación del módulo Proyectos */

export const PRIORIDADES = [
  { id: 'critica', label: 'Crítica' },
  { id: 'alta', label: 'Alta' },
  { id: 'media', label: 'Media' },
  { id: 'baja', label: 'Baja' },
];

export const ESTADOS_PROYECTO = [
  { id: 'borrador', label: 'Borrador' },
  { id: 'activo', label: 'Activo' },
  { id: 'pausado', label: 'Pausado' },
  { id: 'cerrado', label: 'Cerrado' },
  { id: 'cancelado', label: 'Cancelado' },
];

export const ESTADOS_TABLERO = [
  { id: 'pendiente', label: 'Pendiente' },
  { id: 'en_curso', label: 'En curso' },
  { id: 'bloqueado', label: 'Bloqueado' },
  { id: 'completado', label: 'Completado' },
  { id: 'cancelado', label: 'Cancelado' },
];

export const ESTADOS_MATERIAL = [
  'Disponible',
  'Reservado',
  'En Preparación',
  'En Tránsito',
  'Entregado al Taller',
  'Consumido',
  'Devuelto',
  'Ajustado',
];

/** Accesos del dashboard — rutas hijas bajo /proyectos */
export const PROYECTOS_NAV = [
  { to: '/proyectos/lista', label: 'Proyectos', desc: 'Alta y seguimiento', icon: '📁' },
  { to: '/proyectos/tableros', label: 'Tableros', desc: 'Por proyecto', icon: '🧩' },
  { to: '/proyectos/materiales', label: 'Materiales requeridos', desc: 'BOM / necesidades', icon: '📋' },
  { to: '/proyectos/pedidos', label: 'Pedidos masivos', desc: 'Importar CSV/Excel', icon: '📥' },
  { to: '/proyectos/reservas', label: 'Reservas', desc: 'Limbo / comprometidos', icon: '🔒' },
  { to: '/proyectos/faltantes', label: 'Faltantes', desc: 'Compras pendientes', icon: '⚠️' },
  { to: '/proyectos/recepciones', label: 'Recepciones', desc: 'Próximamente', icon: '📦', soon: true },
  { to: '/proyectos/transito', label: 'Materiales en tránsito', desc: 'Próximamente', icon: '🚚', soon: true },
  { to: '/proyectos/disponibles', label: 'Materiales disponibles', desc: 'Stock neto', icon: '✅', soon: true },
  { to: '/proyectos/reservados', label: 'Materiales reservados', desc: 'Vista de limbo', icon: '🏷️' },
  { to: '/proyectos/devoluciones', label: 'Devoluciones', desc: 'Próximamente', icon: '↩️', soon: true },
  { to: '/proyectos/auditorias', label: 'Auditorías', desc: 'Próximamente', icon: '🔎', soon: true },
  { to: '/proyectos/herramientas', label: 'Herramientas', desc: 'Próximamente', icon: '🛠️', soon: true },
  { to: '/proyectos/prioridades', label: 'Prioridades', desc: 'Criticidad', icon: '🎯' },
  { to: '/proyectos/transferencias', label: 'Transferencias depósitos', desc: 'Próximamente', icon: '🔄', soon: true },
  { to: '/proyectos/reportes', label: 'Reportes', desc: 'Próximamente', icon: '📊', soon: true },
  { to: '/proyectos/configuracion', label: 'Configuración', desc: 'Roles y params', icon: '⚙️', soon: true },
];

export const KPI_DEFS = [
  { key: 'totalProyectosActivos', label: 'Proyectos activos' },
  { key: 'proyectosCriticos', label: 'Proyectos críticos' },
  { key: 'faltantesPendientes', label: 'Faltantes pendientes' },
  { key: 'materialesReservados', label: 'Materiales reservados' },
  { key: 'materialesEnTransito', label: 'En tránsito' },
  { key: 'recepcionesPendientes', label: 'Recepciones pend.' },
  { key: 'devolucionesPendientes', label: 'Devoluciones pend.' },
  { key: 'herramientasAsignadas', label: 'Herramientas asignadas' },
  { key: 'alertasActivas', label: 'Alertas activas' },
];

export function prioridadClass(p) {
  switch (p) {
    case 'critica':
      return 'text-red-600 dark:text-red-300';
    case 'alta':
      return 'text-amber-700 dark:text-amber-300';
    case 'baja':
      return 'text-content-muted';
    default:
      return 'text-content';
  }
}

/** Parsea CSV simple: codigo,cantidad (con o sin encabezado) */
export function parsePedidoCsv(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const parts = lines[i].split(/[,;\t]/).map((p) => p.trim().replace(/^"|"$/g, ''));
    if (!parts.length) continue;
    const maybeHeader = /codigo|código|code|sku|articulo|artículo/i.test(parts[0]);
    if (i === 0 && maybeHeader) continue;
    const codigo = parts[0];
    const cantidad = Number(parts[1] || 0);
    if (!codigo) continue;
    out.push({ codigo, cantidad });
  }
  return out;
}
