const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

let authToken = null;

export function setApiToken(token) {
  authToken = token;
}

export function getApiUrl() {
  return API_URL;
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || `Error ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  health: () => request('/api/health'),
  inventario: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/inventario${qs ? `?${qs}` : ''}`);
  },
  movimientos: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/movimientos${qs ? `?${qs}` : ''}`);
  },
  contenedor: (id) => request(`/api/contenedor/${encodeURIComponent(id)}`),
  egreso: (body) =>
    request('/api/movimientos/egreso', { method: 'POST', body: JSON.stringify(body) }),
  ingreso: (body) =>
    request('/api/movimientos/ingreso', { method: 'POST', body: JSON.stringify(body) }),
  sync: (actions) =>
    request('/api/sync', { method: 'POST', body: JSON.stringify(actions) }),
};
