const API_URL = import.meta.env.VITE_API_URL || '';

export function getDocsUrl(path = '/docs/') {
  const base = API_URL || '';
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function getAdminToken() {
  return localStorage.getItem('inventario_admin_token');
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = options.admin ? getAdminToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

export const api = {
  health: () => request('/api/health'),
  login: (body) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  inventario: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
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
  egreso: (body) => request('/api/egreso', { method: 'POST', body: JSON.stringify(body) }),
  ingreso: (body) => request('/api/ingreso', { method: 'POST', body: JSON.stringify(body) }),
  sync: (actions) => request('/api/sync', { method: 'POST', body: JSON.stringify(actions) }),
  adminItems: () => request('/api/admin/items', { admin: true }),
  adminAltaStock: (body) =>
    request('/api/admin/stock/alta', { method: 'POST', body: JSON.stringify(body), admin: true }),
  adminUpdateItem: (itemId, body) =>
    request(`/api/admin/items/${encodeURIComponent(itemId)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
      admin: true,
    }),
  adminBajaItem: (itemId) =>
    request(`/api/admin/items/${encodeURIComponent(itemId)}/baja`, {
      method: 'POST',
      body: JSON.stringify({}),
      admin: true,
    }),
  importEspecificacion: () => request('/api/admin/import/especificacion', { admin: true }),
  importCsv: (body) =>
    request('/api/admin/import/csv', { method: 'POST', body: JSON.stringify(body), admin: true }),
  adminDbSchema: () => request('/api/admin/db/schema', { admin: true }),
  adminDbTable: (table) =>
    request(`/api/admin/db/${encodeURIComponent(table)}`, { admin: true }),
  adminDbCreate: (table, body) =>
    request(`/api/admin/db/${encodeURIComponent(table)}`, {
      method: 'POST',
      body: JSON.stringify(body),
      admin: true,
    }),
  adminDbUpdate: (table, id, body) =>
    request(`/api/admin/db/${encodeURIComponent(table)}/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
      admin: true,
    }),
  adminDbDelete: (table, id) =>
    request(`/api/admin/db/${encodeURIComponent(table)}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      admin: true,
    }),
  downloadPlantilla: async () => {
    const token = getAdminToken();
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
