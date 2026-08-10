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

/**
 * Accesos del dashboard — rutas hijas bajo /proyectos.
 * Agrupados por operación; sin duplicados (reservados = reservas).
 */
export const PROYECTOS_NAV = [
  { to: '/proyectos/lista', label: 'Proyectos', desc: 'Alta y seguimiento', icon: '📁' },
  { to: '/proyectos/tableros', label: 'Tableros', desc: 'Listado + armado', icon: '🧩' },
  { to: '/proyectos/materiales', label: 'Materiales (BOM)', desc: 'Necesidades', icon: '📋' },
  { to: '/proyectos/pedidos', label: 'Pedidos masivos', desc: 'Importar CSV/Excel', icon: '📥' },
  { to: '/proyectos/reservas', label: 'Reservas', desc: 'Limbo / comprometidos', icon: '🔒' },
  { to: '/proyectos/faltantes', label: 'Faltantes', desc: 'Compras pendientes', icon: '⚠️' },
  { to: '/proyectos/recepciones', label: 'Recepciones', desc: 'Remito / OC / manual', icon: '📦' },
  { to: '/proyectos/transito', label: 'En tránsito', desc: 'Origen → destino', icon: '🚚' },
  { to: '/proyectos/disponibles', label: 'Disponibles', desc: 'Almacén general (neto)', icon: '✅' },
  { to: '/proyectos/produccion', label: 'Armado / Producción', desc: 'Escanear a tablero', icon: '🔧' },
  { to: '/proyectos/transferencias', label: 'Transferencias', desc: 'Recepción ítem a ítem', icon: '🔄' },
  { to: '/proyectos/pendientes-cierre', label: 'Pendientes de cierre', desc: 'Recepciones parciales', icon: '📝' },
  { to: '/proyectos/devoluciones', label: 'Devoluciones', desc: 'Desde proyecto / reserva', icon: '↩️' },
  { to: '/proyectos/auditorias', label: 'Auditorías', desc: 'Físico vs sistema', icon: '🔎' },
  { to: '/proyectos/herramientas', label: 'Préstamos (legado)', desc: 'Bitácora sin stock', icon: '🛠️' },
  { to: '/proyectos/prioridades', label: 'Prioridades', desc: 'Criticidad', icon: '🎯' },
  { to: '/proyectos/reportes', label: 'Reportes', desc: 'Indicadores y movimientos', icon: '📊' },
  { to: '/proyectos/configuracion', label: 'Configuración', desc: 'Roles (diseño)', icon: '⚙️' },
];

/** Diseño de roles (no altera auth global aún) */
const PERM_LABELS = [
  'Ver dashboard',
  'CRUD proyectos',
  'Pedidos / reservas',
  'Recepciones',
  'Devoluciones',
  'Auditorías',
  'Herramientas',
  'Reportes',
  'Configuración',
];

function perms(...flags) {
  return PERM_LABELS.map((label, i) => ({ label, ok: Boolean(flags[i]) }));
}

export const ROLES_MODULO = [
  { id: 'admin', label: 'Administrador', permisos: perms(1, 1, 1, 1, 1, 1, 1, 1, 1) },
  { id: 'supervisor', label: 'Supervisor', permisos: perms(1, 1, 1, 1, 1, 1, 1, 1, 0) },
  { id: 'deposito', label: 'Depósito', permisos: perms(1, 0, 1, 1, 1, 1, 0, 1, 0) },
  { id: 'panolero', label: 'Pañolero', permisos: perms(1, 0, 1, 0, 0, 0, 1, 0, 0) },
  { id: 'taller', label: 'Taller', permisos: perms(1, 0, 0, 0, 1, 0, 1, 0, 0) },
  { id: 'compras', label: 'Compras', permisos: perms(1, 0, 0, 1, 0, 0, 0, 1, 0) },
  { id: 'consulta', label: 'Consulta', permisos: perms(1, 0, 0, 0, 0, 0, 0, 1, 0) },
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
    const maybeHeader = /codigo|código|code|sku|articulo|artículo|mlfb|order-number/i.test(parts[0]);
    if (i === 0 && maybeHeader) continue;
    const codigo = parts[0];
    const cantidad = Number(String(parts[1] || '0').replace(',', '.'));
    if (!codigo) continue;
    if (!Number.isFinite(cantidad) || cantidad <= 0) continue;
    out.push({ codigo: codigo.toUpperCase(), cantidad });
  }
  return out;
}

/** Filas de Excel/hoja (col0=código, col1=cantidad) → mismo shape que parsePedidoCsv. */
export function parsePedidoRows(rows) {
  const out = [];
  (rows || []).forEach((row, i) => {
    const cells = Array.isArray(row) ? row : [];
    const codigo = String(cells[0] ?? '').trim();
    if (!codigo) return;
    if (i === 0 && /codigo|código|code|sku|articulo|artículo|mlfb|order-number/i.test(codigo)) {
      return;
    }
    const cantidad = Number(String(cells[1] ?? '0').replace(',', '.'));
    if (!Number.isFinite(cantidad) || cantidad <= 0) return;
    out.push({ codigo: codigo.toUpperCase(), cantidad });
  });
  return out;
}

/** Serializa líneas a texto editable en el textarea. */
export function pedidoLineasToCsv(lineas) {
  const rows = (lineas || []).map((l) => `${l.codigo},${l.cantidad}`);
  return ['codigo,cantidad', ...rows].join('\n');
}
