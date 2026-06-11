-- Paso 1: solo columnas faltantes (idempotente)
-- Ejecutar en SQL Editor si patch-partial-schema.sql falló en vistas/funciones.
-- Después corré el resto de patch-partial-schema.sql (desde "vistas y funciones").

-- contenedores
ALTER TABLE contenedores ADD COLUMN IF NOT EXISTS armario TEXT;
UPDATE contenedores SET armario = split_part(codigo, '-', 1) WHERE armario IS NULL;
UPDATE contenedores SET armario = 'A00' WHERE armario IS NULL OR armario = '';
ALTER TABLE contenedores ALTER COLUMN armario SET NOT NULL;
ALTER TABLE contenedores ALTER COLUMN contenedor DROP NOT NULL;

-- items
ALTER TABLE items ADD COLUMN IF NOT EXISTS calibracion TEXT DEFAULT '';
ALTER TABLE items ADD COLUMN IF NOT EXISTS comentario TEXT DEFAULT '';
ALTER TABLE items ADD COLUMN IF NOT EXISTS fecha_relevamiento DATE;
ALTER TABLE items ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_items_activo ON items(activo) WHERE activo = true;

-- movimientos
ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS sync_status TEXT NOT NULL DEFAULT 'synced';
ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS offline_id TEXT;
ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS egreso_movimiento_id UUID REFERENCES movimientos(id);
ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE movimientos SET sync_status = 'synced' WHERE sync_status IS NULL;
UPDATE movimientos SET created_at = COALESCE(fecha, now()) WHERE created_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS movimientos_offline_id_key ON movimientos(offline_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_offline ON movimientos(offline_id) WHERE offline_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_movimientos_egreso_ref ON movimientos(egreso_movimiento_id);

-- users (tabla completa si no existe)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'operario')),
  must_change_password BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users (lower(username));
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
