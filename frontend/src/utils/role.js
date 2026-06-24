/** Rol canónico: 'admin' | 'operario' */
export function normalizeRole(role) {
  const value = String(role || '')
    .trim()
    .toLowerCase();
  if (value === 'admin' || value === 'administrador') return 'admin';
  return 'operario';
}

export function isAdminRole(role) {
  return normalizeRole(role) === 'admin';
}
