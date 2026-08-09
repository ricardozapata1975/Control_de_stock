/** Código de rol: admin | operario | custom */
export function normalizeRole(role) {
  const value = String(role || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (!value) return 'operario';
  if (value === 'administrador') return 'admin';
  return value.replace(/[^a-z0-9_]/g, '_') || 'operario';
}

export function isAdminRole(role) {
  return normalizeRole(role) === 'admin';
}
