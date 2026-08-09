-- Roles y permisos del sitio (matriz editable)
-- Ejecutar en SQL Editor de Supabase

CREATE TABLE IF NOT EXISTS app_roles (
  codigo TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT DEFAULT '',
  es_sistema BOOLEAN NOT NULL DEFAULT false,
  permisos JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE app_roles IS 'Roles del sitio con mapa de permisos (páginas/funciones)';
COMMENT ON COLUMN app_roles.permisos IS 'Objeto { "inventario.local": true, ... }';
COMMENT ON COLUMN app_roles.es_sistema IS 'admin/operario: no se eliminan';

-- users.role ya es TEXT: guarda el codigo del rol (admin, operario, taller, …)
