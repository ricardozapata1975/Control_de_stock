import { PROYECTOS_NAV } from '../modules/proyectos/constants';
import { hasPermission, PATH_PERMISSION } from '../utils/permissions';

/**
 * Menú principal (Inventario / Agenda / Proyectos).
 * Cada acceso lleva `permission` para filtrar por rol.
 */
export const APP_NAV_GROUPS = [
  {
    id: 'inventario',
    label: 'Inventario',
    to: '/',
    match: (path) =>
      path === '/' ||
      [
        '/consulta-sucursales',
        '/egreso',
        '/ingreso',
        '/historial',
        '/escanear',
        '/imprimir-qr',
        '/remito',
        '/admin/editor-stock',
        '/admin/importar',
        '/contenedor',
        '/item',
      ].some((p) => path === p || path.startsWith(`${p}/`)),
    accesos: [
      { to: '/', label: 'Local', end: true, permission: 'inventario.local' },
      { to: '/consulta-sucursales', label: 'Otras sucursales', permission: 'inventario.sucursales' },
      { to: '/egreso', label: 'Egreso', permission: 'inventario.egreso' },
      { to: '/ingreso', label: 'Ingreso', permission: 'inventario.ingreso' },
      { to: '/historial', label: 'Historial', permission: 'inventario.historial' },
      { to: '/escanear', label: 'QR', permission: 'inventario.qr' },
      { to: '/imprimir-qr', label: 'Etiquetas', permission: 'inventario.etiquetas' },
      { to: '/remito', label: 'Remito', permission: 'inventario.remito' },
      { to: '/admin/editor-stock', label: 'Editor de Stock', permission: 'inventario.editor_stock' },
      { to: '/admin/importar', label: 'Importar CSV', permission: 'inventario.importar' },
    ],
  },
  {
    id: 'agenda',
    label: 'Agenda',
    to: '/agenda',
    match: (path) =>
      path === '/agenda' ||
      path.startsWith('/admin/locaciones') ||
      path.startsWith('/admin/usuarios') ||
      path.startsWith('/admin/roles'),
    accesos: [
      { to: '/agenda', label: 'Empresas y clientes', permission: 'agenda.empresas' },
      { to: '/admin/locaciones', label: 'Locaciones', permission: 'agenda.locaciones' },
      { to: '/admin/usuarios', label: 'Usuarios', permission: 'agenda.usuarios' },
      { to: '/admin/roles', label: 'Roles y permisos', permission: 'admin.roles' },
      { label: 'Proveedores', soon: true },
    ],
  },
  {
    id: 'proyectos',
    label: 'Proyectos',
    to: '/proyectos',
    match: (path) => path === '/proyectos' || path.startsWith('/proyectos/'),
    accesos: PROYECTOS_NAV.map((item) => ({
      to: item.soon ? undefined : item.to,
      label: `${item.icon ? `${item.icon} ` : ''}${item.label}`,
      soon: item.soon,
      desc: item.desc,
      permission: item.to ? PATH_PERMISSION[item.to] || null : null,
    })),
  },
];

/** Filtra grupos/accesos según permisos del usuario. */
export function filterNavGroups(user) {
  return APP_NAV_GROUPS.map((g) => ({
    ...g,
    accesos: g.accesos.filter((a) => {
      if (a.soon) return true;
      if (!a.to) return true;
      if (!a.permission) return true;
      return hasPermission(user, a.permission);
    }),
  })).filter((g) => g.accesos.some((a) => a.to || a.soon));
}
