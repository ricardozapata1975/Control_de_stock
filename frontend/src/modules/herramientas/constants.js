/** Navegación del módulo Herramientas / Pañol */
export const HERRAMIENTAS_NAV = [
  {
    to: '/herramientas',
    label: 'Dashboard',
    desc: 'Resumen del Pañol',
    permission: 'herramientas.ver',
    end: true,
  },
  {
    to: '/herramientas/stock',
    label: 'Stock del Pañol',
    desc: 'Disponibles en depósito Herramientas',
    permission: 'herramientas.ver',
  },
  {
    to: '/herramientas/recibir',
    label: 'Recibir en Pañol',
    desc: 'Pasar stock compartido al depósito',
    permission: 'herramientas.recibir',
  },
  {
    to: '/herramientas/prestar',
    label: 'Prestar',
    desc: 'Asignar a operario (egreso + remito)',
    permission: 'herramientas.prestar',
  },
  {
    to: '/herramientas/devolver',
    label: 'Devolver',
    desc: 'Pendientes de devolución',
    permission: 'herramientas.devolver',
  },
  {
    to: '/herramientas/historial',
    label: 'Historial',
    desc: 'Trazabilidad de préstamos',
    permission: 'herramientas.ver',
  },
];
