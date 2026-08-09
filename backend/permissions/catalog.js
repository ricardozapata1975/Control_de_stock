/**
 * Catálogo de permisos del sitio (páginas / funciones).
 * id estable → se guarda en app_roles.permisos
 */
export const APP_PERMISSIONS = [
  // Inventario
  { id: 'inventario.local', label: 'Inventario local', group: 'Inventario', path: '/' },
  { id: 'inventario.sucursales', label: 'Otras sucursales', group: 'Inventario', path: '/consulta-sucursales' },
  { id: 'inventario.egreso', label: 'Egreso', group: 'Inventario', path: '/egreso' },
  { id: 'inventario.ingreso', label: 'Ingreso', group: 'Inventario', path: '/ingreso' },
  { id: 'inventario.historial', label: 'Historial', group: 'Inventario', path: '/historial' },
  { id: 'inventario.qr', label: 'Escanear QR', group: 'Inventario', path: '/escanear' },
  { id: 'inventario.etiquetas', label: 'Etiquetas QR', group: 'Inventario', path: '/imprimir-qr' },
  { id: 'inventario.remito', label: 'Remito', group: 'Inventario', path: '/remito' },
  { id: 'inventario.editor_stock', label: 'Editor de stock', group: 'Inventario', path: '/admin/editor-stock' },
  { id: 'inventario.importar', label: 'Importar CSV stock', group: 'Inventario', path: '/admin/importar' },

  // Agenda
  { id: 'agenda.empresas', label: 'Empresas y clientes', group: 'Agenda', path: '/agenda' },
  { id: 'agenda.locaciones', label: 'Locaciones', group: 'Agenda', path: '/admin/locaciones' },
  { id: 'agenda.usuarios', label: 'Usuarios', group: 'Agenda', path: '/admin/usuarios' },

  // Proyectos
  { id: 'proyectos.dashboard', label: 'Dashboard proyectos', group: 'Proyectos', path: '/proyectos' },
  { id: 'proyectos.lista', label: 'Proyectos (lista)', group: 'Proyectos', path: '/proyectos/lista' },
  { id: 'proyectos.tableros', label: 'Tableros', group: 'Proyectos', path: '/proyectos/tableros' },
  { id: 'proyectos.materiales', label: 'Materiales (BOM)', group: 'Proyectos', path: '/proyectos/materiales' },
  { id: 'proyectos.pedidos', label: 'Pedidos masivos', group: 'Proyectos', path: '/proyectos/pedidos' },
  { id: 'proyectos.reservas', label: 'Reservas', group: 'Proyectos', path: '/proyectos/reservas' },
  { id: 'proyectos.faltantes', label: 'Faltantes', group: 'Proyectos', path: '/proyectos/faltantes' },
  { id: 'proyectos.recepciones', label: 'Recepciones', group: 'Proyectos', path: '/proyectos/recepciones' },
  { id: 'proyectos.transito', label: 'En tránsito', group: 'Proyectos', path: '/proyectos/transito' },
  { id: 'proyectos.disponibles', label: 'Disponibles', group: 'Proyectos', path: '/proyectos/disponibles' },
  { id: 'proyectos.produccion', label: 'Armado / Producción', group: 'Proyectos', path: '/proyectos/produccion' },
  { id: 'proyectos.transferencias', label: 'Transferencias', group: 'Proyectos', path: '/proyectos/transferencias' },
  { id: 'proyectos.pendientes_cierre', label: 'Pendientes de cierre', group: 'Proyectos', path: '/proyectos/pendientes-cierre' },
  { id: 'proyectos.devoluciones', label: 'Devoluciones', group: 'Proyectos', path: '/proyectos/devoluciones' },
  { id: 'proyectos.auditorias', label: 'Auditorías', group: 'Proyectos', path: '/proyectos/auditorias' },
  { id: 'proyectos.herramientas', label: 'Herramientas', group: 'Proyectos', path: '/proyectos/herramientas' },
  { id: 'proyectos.prioridades', label: 'Prioridades', group: 'Proyectos', path: '/proyectos/prioridades' },
  { id: 'proyectos.reportes', label: 'Reportes', group: 'Proyectos', path: '/proyectos/reportes' },
  { id: 'proyectos.configuracion', label: 'Config. módulo proyectos', group: 'Proyectos', path: '/proyectos/configuracion' },

  // Admin / sistema
  { id: 'admin.roles', label: 'Roles y permisos del sitio', group: 'Administración', path: '/admin/roles' },
  { id: 'admin.cambiar_sede', label: 'Cambiar sucursal en sesión', group: 'Administración', path: null },
];

export const ALL_PERMISSION_IDS = APP_PERMISSIONS.map((p) => p.id);

export function emptyPermMap() {
  const m = {};
  for (const id of ALL_PERMISSION_IDS) m[id] = false;
  return m;
}

export function allPermMap() {
  const m = {};
  for (const id of ALL_PERMISSION_IDS) m[id] = true;
  return m;
}

export function normalizePermMap(raw) {
  const base = emptyPermMap();
  if (!raw || typeof raw !== 'object') return base;
  for (const id of ALL_PERMISSION_IDS) {
    if (raw[id] !== undefined) base[id] = Boolean(raw[id]);
  }
  return base;
}

/** Plantillas iniciales de roles del sitio */
export function defaultRolesSeed() {
  const op = emptyPermMap();
  for (const id of [
    'inventario.local',
    'inventario.sucursales',
    'inventario.egreso',
    'inventario.ingreso',
    'inventario.historial',
    'inventario.qr',
    'inventario.etiquetas',
    'inventario.remito',
    'agenda.empresas',
    'proyectos.dashboard',
    'proyectos.lista',
    'proyectos.tableros',
    'proyectos.materiales',
    'proyectos.pedidos',
    'proyectos.reservas',
    'proyectos.faltantes',
    'proyectos.recepciones',
    'proyectos.transito',
    'proyectos.disponibles',
    'proyectos.produccion',
    'proyectos.transferencias',
    'proyectos.pendientes_cierre',
    'proyectos.devoluciones',
    'proyectos.herramientas',
    'proyectos.prioridades',
    'proyectos.reportes',
  ]) {
    op[id] = true;
  }

  const taller = emptyPermMap();
  for (const id of [
    'inventario.local',
    'inventario.qr',
    'inventario.egreso',
    'inventario.ingreso',
    'proyectos.dashboard',
    'proyectos.tableros',
    'proyectos.materiales',
    'proyectos.produccion',
    'proyectos.herramientas',
  ]) {
    taller[id] = true;
  }

  const deposito = emptyPermMap();
  for (const id of [
    'inventario.local',
    'inventario.sucursales',
    'inventario.egreso',
    'inventario.ingreso',
    'inventario.historial',
    'inventario.qr',
    'inventario.etiquetas',
    'inventario.remito',
    'proyectos.dashboard',
    'proyectos.pedidos',
    'proyectos.reservas',
    'proyectos.faltantes',
    'proyectos.recepciones',
    'proyectos.transito',
    'proyectos.disponibles',
    'proyectos.transferencias',
    'proyectos.pendientes_cierre',
    'proyectos.devoluciones',
    'proyectos.auditorias',
    'proyectos.reportes',
  ]) {
    deposito[id] = true;
  }

  const consulta = emptyPermMap();
  for (const id of [
    'inventario.local',
    'inventario.sucursales',
    'inventario.historial',
    'proyectos.dashboard',
    'proyectos.lista',
    'proyectos.materiales',
    'proyectos.disponibles',
    'proyectos.reportes',
  ]) {
    consulta[id] = true;
  }

  return [
    {
      codigo: 'admin',
      nombre: 'Administrador',
      descripcion: 'Acceso total al sitio. No se puede eliminar.',
      es_sistema: true,
      permisos: allPermMap(),
    },
    {
      codigo: 'operario',
      nombre: 'Operario',
      descripcion: 'Operación diaria de inventario y proyectos (sin admin).',
      es_sistema: true,
      permisos: op,
    },
    {
      codigo: 'taller',
      nombre: 'Taller',
      descripcion: 'Armado de tableros y egresos/ingresos básicos.',
      es_sistema: false,
      permisos: taller,
    },
    {
      codigo: 'deposito',
      nombre: 'Depósito',
      descripcion: 'Reservas, recepciones, transferencias y auditoría.',
      es_sistema: false,
      permisos: deposito,
    },
    {
      codigo: 'consulta',
      nombre: 'Consulta',
      descripcion: 'Solo lectura / consulta.',
      es_sistema: false,
      permisos: consulta,
    },
  ];
}

/** Resuelve permiso requerido para una ruta del frontend */
export function permissionForPath(pathname) {
  const path = String(pathname || '').split('?')[0];
  if (path.startsWith('/proyectos/') && path !== '/proyectos/lista') {
    // detalle /proyectos/:id
    const rest = path.slice('/proyectos/'.length);
    if (rest && !rest.includes('/') && !APP_PERMISSIONS.some((p) => p.path === path)) {
      return 'proyectos.lista';
    }
  }
  if (path.startsWith('/item/') || path.startsWith('/contenedor/')) return 'inventario.local';

  const exact = APP_PERMISSIONS.find((p) => p.path === path);
  if (exact) return exact.id;

  const byPrefix = APP_PERMISSIONS.filter((p) => p.path && p.path !== '/' && path.startsWith(p.path)).sort(
    (a, b) => b.path.length - a.path.length
  );
  return byPrefix[0]?.id || null;
}
