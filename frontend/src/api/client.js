const API_URL = import.meta.env.VITE_API_URL || '';

let onUnauthorized = null;

export function setUnauthorizedHandler(handler) {
  onUnauthorized = typeof handler === 'function' ? handler : null;
}

export function getDocsUrl(path = '/docs/') {
  const base = API_URL || '';
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function getToken() {
  return (
    localStorage.getItem('inventario_token') || localStorage.getItem('inventario_admin_token')
  );
}

async function request(path, options = {}) {
  const { timeoutMs, skipUnauthorizedHandler, ...fetchOptions } = options;
  const headers = { 'Content-Type': 'application/json', ...fetchOptions.headers };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = timeoutMs ? new AbortController() : null;
  const timeoutId =
    controller && timeoutMs
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...fetchOptions,
      headers,
      signal: controller?.signal,
    });
    const raw = await res.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      /* respuesta HTML u otro formato no JSON */
    }
    if (!res.ok) {
      if (res.status === 401 && onUnauthorized && !skipUnauthorizedHandler) {
        onUnauthorized();
      }
      if (res.status === 404) {
        throw new Error(
          data.error ||
            'Ruta no encontrada en el servidor (404). El backend puede no estar actualizado: en Render, abrí el servicio y hacé Manual Deploy desde main.'
        );
      }
      throw new Error(data.error || `Error ${res.status}`);
    }
    return data;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(
        'La solicitud tardó demasiado. El servidor de correo puede estar mal configurado o inaccesible desde Render.'
      );
    }
    throw err;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export const api = {
  health: () => request('/api/health'),
  me: () => request('/api/auth/me', { skipUnauthorizedHandler: true }),
  login: (body) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  firstLogin: (body) =>
    request('/api/auth/first-login', { method: 'POST', body: JSON.stringify(body) }),
  setPassword: (body) =>
    request('/api/auth/set-password', { method: 'POST', body: JSON.stringify(body) }),
  switchSede: (body) =>
    request('/api/auth/sede', { method: 'POST', body: JSON.stringify(body) }),
  forgotPassword: (body) =>
    request('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify(body) }),
  resetPassword: (body) =>
    request('/api/auth/reset-password', { method: 'POST', body: JSON.stringify(body) }),
  inventario: (params = {}) => {
    const clean = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null && String(v).trim() !== '')
    );
    const qs = new URLSearchParams(clean).toString();
    return request(`/api/inventario${qs ? `?${qs}` : ''}`);
  },
  movimientos: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/movimientos${qs ? `?${qs}` : ''}`);
  },
  pendientes: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/movimientos/pendientes${qs ? `?${qs}` : ''}`);
  },
  contenedor: (codigo) => request(`/api/contenedor/${encodeURIComponent(codigo)}`),
  contenedores: () => request('/api/contenedor'),
  catalogoUbicacion: (params = {}) => {
    const clean = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null && String(v).trim() !== '')
    );
    const qs = new URLSearchParams(clean).toString();
    return request(`/api/ubicacion/catalogo${qs ? `?${qs}` : ''}`);
  },
  tipos: () => request('/api/tipos'),
  adminCreateAlmacen: (body) =>
    request('/api/admin/catalogo/almacen', { method: 'POST', body: JSON.stringify(body) }),
  adminCreateArmario: (body) =>
    request('/api/admin/catalogo/armario', { method: 'POST', body: JSON.stringify(body) }),
  adminCreateSede: (body) =>
    request('/api/admin/catalogo/sede', { method: 'POST', body: JSON.stringify(body) }),
  adminAssignAlmacenSede: (body) =>
    request('/api/admin/catalogo/almacen-sede', { method: 'PATCH', body: JSON.stringify(body) }),
  egreso: (body) => request('/api/egreso', { method: 'POST', body: JSON.stringify(body) }),
  egresoContenedor: (body) =>
    request('/api/egreso/contenedor', { method: 'POST', body: JSON.stringify(body) }),
  egresoLote: (loteId) => request(`/api/egreso/lotes/${encodeURIComponent(loteId)}`),
  devolverEgresoLote: (loteId, body = {}) =>
    request(`/api/egreso/lotes/${encodeURIComponent(loteId)}/devolver`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  ingreso: (body) => request('/api/ingreso', { method: 'POST', body: JSON.stringify(body) }),
  sync: (actions) => request('/api/sync', { method: 'POST', body: JSON.stringify(actions) }),
  adminItems: () => request('/api/admin/items'),
  adminAltaStock: (body) =>
    request('/api/admin/stock/alta', { method: 'POST', body: JSON.stringify(body) }),
  adminUpdateItem: (itemId, body) =>
    request(`/api/admin/items/${encodeURIComponent(itemId)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  adminBajaItem: (itemId) =>
    request(`/api/admin/items/${encodeURIComponent(itemId)}/baja`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  solicitarEnvio: (body) =>
    request('/api/solicitudes-envio', { method: 'POST', body: JSON.stringify(body) }),
  adminUploadItemImage: (itemId, body) =>
    request(`/api/admin/items/${encodeURIComponent(itemId)}/imagen`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  adminDeleteItemImage: (itemId) =>
    request(`/api/admin/items/${encodeURIComponent(itemId)}/imagen`, {
      method: 'DELETE',
    }),
  importEspecificacion: () => request('/api/admin/import/especificacion'),
  importCsv: (body) =>
    request('/api/admin/import/csv', { method: 'POST', body: JSON.stringify(body) }),
  adminDbSchema: () => request('/api/admin/db/schema'),
  adminDbTable: (table) => request(`/api/admin/db/${encodeURIComponent(table)}`),
  adminDbCreate: (table, body) =>
    request(`/api/admin/db/${encodeURIComponent(table)}`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  adminDbUpdate: (table, id, body) =>
    request(`/api/admin/db/${encodeURIComponent(table)}/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  adminDbDelete: (table, id) =>
    request(`/api/admin/db/${encodeURIComponent(table)}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  adminUsers: () => request('/api/admin/users'),
  adminCreateUser: (body) =>
    request('/api/admin/users', { method: 'POST', body: JSON.stringify(body) }),
  adminUpdateUser: (id, body) =>
    request(`/api/admin/users/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  adminDeleteUser: (id) =>
    request(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  adminResetPassword: (id) =>
    request(`/api/admin/users/${encodeURIComponent(id)}/reset-password`, { method: 'POST' }),
  adminSendWelcome: (id) =>
    request(`/api/admin/users/${encodeURIComponent(id)}/send-welcome`, {
      method: 'POST',
      timeoutMs: 45000,
    }),
  adminUsersImportSpec: () => request('/api/admin/users/import/especificacion'),
  adminUsersImportPreview: (csv) =>
    request('/api/admin/users/import/preview', {
      method: 'POST',
      body: JSON.stringify({ csv }),
    }),
  adminUsersImport: (csv, modoDuplicados = 'skip') =>
    request('/api/admin/users/import', {
      method: 'POST',
      body: JSON.stringify({ csv, modoDuplicados }),
    }),
  clientes: (q = '', opts = {}) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (opts.agenda) params.set('agenda', '1');
    const qs = params.toString();
    return request(`/api/clientes${qs ? `?${qs}` : ''}`);
  },
  createCliente: (body) =>
    request('/api/clientes', { method: 'POST', body: JSON.stringify(body) }),
  updateCliente: (id, body) =>
    request(`/api/clientes/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteCliente: (id) =>
    request(`/api/clientes/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  empresasEmisoras: (opts = {}) => {
    const qs = opts.all ? '?all=1' : '';
    return request(`/api/empresas-emisoras${qs}`);
  },
  createEmpresaEmisora: (body) =>
    request('/api/empresas-emisoras', { method: 'POST', body: JSON.stringify(body) }),
  updateEmpresaEmisora: (id, body) =>
    request(`/api/empresas-emisoras/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  uploadEmpresaAsset: (id, kind, body) =>
    request(`/api/empresas-emisoras/${encodeURIComponent(id)}/${encodeURIComponent(kind)}`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deleteEmpresaAsset: (id, kind) =>
    request(`/api/empresas-emisoras/${encodeURIComponent(id)}/${encodeURIComponent(kind)}`, {
      method: 'DELETE',
    }),
  proximoNumeroRemito: (empresaId) =>
    request(`/api/empresas-emisoras/proximo-numero?empresaId=${encodeURIComponent(empresaId)}`),
  crearRemito: (body) =>
    request('/api/remitos', { method: 'POST', body: JSON.stringify(body) }),
  getRemito: (id) => request(`/api/remitos/${encodeURIComponent(id)}`),
  transferenciasPendientes: (params = {}) => {
    const clean =
      typeof params === 'string'
        ? { almacenDestino: params }
        : Object.fromEntries(
            Object.entries(params).filter(([, v]) => v != null && String(v).trim() !== '')
          );
    const qs = new URLSearchParams(clean).toString();
    return request(`/api/remitos/transferencias/pendientes${qs ? `?${qs}` : ''}`);
  },
  recibirTransferencia: (id, body) =>
    request(`/api/remitos/${encodeURIComponent(id)}/recibir`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // Módulo Proyectos
  proyectosDashboard: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/proyectos/dashboard${q ? `?${q}` : ''}`);
  },
  proyectos: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/proyectos${q ? `?${q}` : ''}`);
  },
  proyecto: (id) => request(`/api/proyectos/${encodeURIComponent(id)}`),
  crearProyecto: (body) =>
    request('/api/proyectos', { method: 'POST', body: JSON.stringify(body) }),
  actualizarProyecto: (id, body) =>
    request(`/api/proyectos/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  crearTablero: (proyectoId, body) =>
    request(`/api/proyectos/${encodeURIComponent(proyectoId)}/tableros`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  actualizarTablero: (tableroId, body) =>
    request(`/api/proyectos/tableros/${encodeURIComponent(tableroId)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  proyectosReservas: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/proyectos/reservas${q ? `?${q}` : ''}`);
  },
  proyectosFaltantes: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/proyectos/faltantes${q ? `?${q}` : ''}`);
  },
  liberarReservaProyecto: (id, body = {}) =>
    request(`/api/proyectos/reservas/${encodeURIComponent(id)}/liberar`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  reasignarReservaProyecto: (id, body) =>
    request(`/api/proyectos/reservas/${encodeURIComponent(id)}/reasignar`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  pedidoMasivoProyecto: (body) =>
    request('/api/proyectos/pedidos-masivos', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  proyectosAlertas: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/proyectos/alertas${q ? `?${q}` : ''}`);
  },
  proyectosRecepciones: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/proyectos/recepciones${q ? `?${q}` : ''}`);
  },
  proyectoRecepcion: (id) => request(`/api/proyectos/recepciones/${encodeURIComponent(id)}`),
  crearRecepcionProyecto: (body) =>
    request('/api/proyectos/recepciones', { method: 'POST', body: JSON.stringify(body) }),
  aceptarSugerenciaProyecto: (id) =>
    request(`/api/proyectos/sugerencias/${encodeURIComponent(id)}/aceptar`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  rechazarSugerenciaProyecto: (id) =>
    request(`/api/proyectos/sugerencias/${encodeURIComponent(id)}/rechazar`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  sugerenciasPorItemsProyecto: (body) =>
    request('/api/proyectos/sugerencias/por-items', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  proyectosDevoluciones: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/proyectos/devoluciones${q ? `?${q}` : ''}`);
  },
  crearDevolucionProyecto: (body) =>
    request('/api/proyectos/devoluciones', { method: 'POST', body: JSON.stringify(body) }),
  proyectosAuditorias: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/proyectos/auditorias${q ? `?${q}` : ''}`);
  },
  proyectoAuditoria: (id) => request(`/api/proyectos/auditorias/${encodeURIComponent(id)}`),
  crearAuditoriaProyecto: (body) =>
    request('/api/proyectos/auditorias', { method: 'POST', body: JSON.stringify(body) }),
  agregarLineaAuditoriaProyecto: (id, body) =>
    request(`/api/proyectos/auditorias/${encodeURIComponent(id)}/lineas`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  cerrarAuditoriaProyecto: (id) =>
    request(`/api/proyectos/auditorias/${encodeURIComponent(id)}/cerrar`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  proyectosHerramientas: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/proyectos/herramientas${q ? `?${q}` : ''}`);
  },
  proyectoHerramienta: (id) => request(`/api/proyectos/herramientas/${encodeURIComponent(id)}`),
  asignarHerramientaProyecto: (body) =>
    request('/api/proyectos/herramientas', { method: 'POST', body: JSON.stringify(body) }),
  eventoHerramientaProyecto: (id, body) =>
    request(`/api/proyectos/herramientas/${encodeURIComponent(id)}/evento`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  proyectosReportes: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/proyectos/reportes${q ? `?${q}` : ''}`);
  },
  proyectosDisponiblesNetos: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/proyectos/disponibles-netos${q ? `?${q}` : ''}`);
  },
  proyectosTransito: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/proyectos/transito${q ? `?${q}` : ''}`);
  },
  proyectosRemitosPendientesCierre: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/proyectos/remitos-pendientes-cierre${q ? `?${q}` : ''}`);
  },
  proyectoTransferencia: (id) =>
    request(`/api/proyectos/transferencias/${encodeURIComponent(id)}`),
  validarItemTransferencia: (id, body) =>
    request(`/api/proyectos/transferencias/${encodeURIComponent(id)}/validar-item`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  cerrarRecepcionParcialTransferencia: (id, body) =>
    request(`/api/proyectos/transferencias/${encodeURIComponent(id)}/cerrar-parcial`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  downloadPlantilla: async () => {
    const token = getToken();
    const res = await fetch(`${API_URL}/api/admin/import/plantilla.csv`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('No se pudo descargar la plantilla');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla-inventario.csv';
    a.click();
    URL.revokeObjectURL(url);
  },
};
