/** Helpers de permisos del sitio (alineados al catálogo backend). */

export function hasPermission(userOrPerms, permId) {
  if (!permId) return true;
  const perms = Array.isArray(userOrPerms)
    ? userOrPerms
    : userOrPerms?.permissions || (isAdminLike(userOrPerms) ? ['*'] : []);
  if (perms.includes('*')) return true;
  if (isAdminLike(userOrPerms) && !Array.isArray(userOrPerms)) return true;
  return perms.includes(permId);
}

function isAdminLike(user) {
  if (!user || Array.isArray(user)) return false;
  const r = String(user.role || '')
    .trim()
    .toLowerCase();
  return r === 'admin' || r === 'administrador';
}

export function hasAnyPermission(user, permIds) {
  return (permIds || []).some((id) => hasPermission(user, id));
}

/** Mapeo ruta menú → permiso */
export const PATH_PERMISSION = {
  '/': 'inventario.local',
  '/consulta-sucursales': 'inventario.sucursales',
  '/egreso': 'inventario.egreso',
  '/ingreso': 'inventario.ingreso',
  '/historial': 'inventario.historial',
  '/escanear': 'inventario.qr',
  '/imprimir-qr': 'inventario.etiquetas',
  '/remito': 'inventario.remito',
  '/admin/editor-stock': 'inventario.editor_stock',
  '/admin/importar': 'inventario.importar',
  '/agenda': 'agenda.empresas',
  '/admin/locaciones': 'agenda.locaciones',
  '/admin/usuarios': 'agenda.usuarios',
  '/admin/roles': 'admin.roles',
  '/proyectos': 'proyectos.dashboard',
  '/proyectos/lista': 'proyectos.lista',
  '/proyectos/tableros': 'proyectos.tableros',
  '/proyectos/materiales': 'proyectos.materiales',
  '/proyectos/pedidos': 'proyectos.pedidos',
  '/proyectos/reservas': 'proyectos.reservas',
  '/proyectos/faltantes': 'proyectos.faltantes',
  '/proyectos/recepciones': 'proyectos.recepciones',
  '/proyectos/transito': 'proyectos.transito',
  '/proyectos/disponibles': 'proyectos.disponibles',
  '/proyectos/produccion': 'proyectos.produccion',
  '/proyectos/transferencias': 'proyectos.transferencias',
  '/proyectos/pendientes-cierre': 'proyectos.pendientes_cierre',
  '/proyectos/devoluciones': 'proyectos.devoluciones',
  '/proyectos/auditorias': 'proyectos.auditorias',
  '/proyectos/herramientas': 'proyectos.herramientas',
  '/proyectos/prioridades': 'proyectos.prioridades',
  '/proyectos/reportes': 'proyectos.reportes',
  '/proyectos/configuracion': 'proyectos.configuracion',
};

export function permissionForPath(pathname) {
  const path = String(pathname || '').split('?')[0];
  if (PATH_PERMISSION[path]) return PATH_PERMISSION[path];
  if (path.startsWith('/item/') || path.startsWith('/contenedor/')) return 'inventario.local';
  if (path.startsWith('/proyectos/') && path !== '/proyectos/lista') {
    const rest = path.slice('/proyectos/'.length);
    if (rest && !rest.includes('/')) return 'proyectos.lista';
  }
  const keys = Object.keys(PATH_PERMISSION)
    .filter((p) => p !== '/' && path.startsWith(p))
    .sort((a, b) => b.length - a.length);
  return keys[0] ? PATH_PERMISSION[keys[0]] : null;
}
