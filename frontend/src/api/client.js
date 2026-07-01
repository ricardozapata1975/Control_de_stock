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
  pendientes: () => request('/api/movimientos/pendientes'),
  contenedor: (codigo) => request(`/api/contenedor/${encodeURIComponent(codigo)}`),
  contenedores: () => request('/api/contenedor'),
  catalogoUbicacion: () => request('/api/ubicacion/catalogo'),
  tipos: () => request('/api/tipos'),
  adminCreateAlmacen: (body) =>
    request('/api/admin/catalogo/almacen', { method: 'POST', body: JSON.stringify(body) }),
  adminCreateArmario: (body) =>
    request('/api/admin/catalogo/armario', { method: 'POST', body: JSON.stringify(body) }),
  egreso: (body) => request('/api/egreso', { method: 'POST', body: JSON.stringify(body) }),
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
  clientes: (q = '') => {
    const qs = q ? `?q=${encodeURIComponent(q)}` : '';
    return request(`/api/clientes${qs}`);
  },
  empresasEmisoras: () => request('/api/empresas-emisoras'),
  proximoNumeroRemito: (empresaId) =>
    request(`/api/empresas-emisoras/proximo-numero?empresaId=${encodeURIComponent(empresaId)}`),
  crearRemito: (body) =>
    request('/api/remitos', { method: 'POST', body: JSON.stringify(body) }),
  getRemito: (id) => request(`/api/remitos/${encodeURIComponent(id)}`),
  transferenciasPendientes: (almacenDestino) => {
    const qs = almacenDestino ? `?almacenDestino=${encodeURIComponent(almacenDestino)}` : '';
    return request(`/api/remitos/transferencias/pendientes${qs}`);
  },
  recibirTransferencia: (id, body) =>
    request(`/api/remitos/${encodeURIComponent(id)}/recibir`, {
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
