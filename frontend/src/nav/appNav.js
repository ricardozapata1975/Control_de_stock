import { PROYECTOS_NAV } from '../modules/proyectos/constants';

/**
 * Menú principal + accesos rápidos (alineado al esquema Inventario / Agenda / Proyectos).
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
      { to: '/', label: 'Local', end: true },
      { to: '/consulta-sucursales', label: 'Otras sucursales' },
      { to: '/egreso', label: 'Egreso' },
      { to: '/ingreso', label: 'Ingreso' },
      { to: '/historial', label: 'Historial' },
      { to: '/escanear', label: 'QR' },
      { to: '/imprimir-qr', label: 'Etiquetas' },
      { to: '/remito', label: 'Remito' },
      { to: '/admin/editor-stock', label: 'Editor de Stock', admin: true },
      { to: '/admin/importar', label: 'Importar CSV', admin: true },
    ],
  },
  {
    id: 'agenda',
    label: 'Agenda',
    to: '/agenda',
    match: (path) =>
      path === '/agenda' ||
      path.startsWith('/admin/locaciones') ||
      path.startsWith('/admin/usuarios'),
    accesos: [
      { to: '/agenda', label: 'Empresas y clientes' },
      { to: '/admin/locaciones', label: 'Locaciones', admin: true },
      { to: '/admin/usuarios', label: 'Usuarios', admin: true },
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
    })),
  },
];

export function filterNavGroups(isAdmin) {
  return APP_NAV_GROUPS.map((g) => ({
    ...g,
    accesos: g.accesos.filter((a) => !a.admin || isAdmin),
  }));
}
