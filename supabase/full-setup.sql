-- Inventario Taller â€” Supabase / PostgreSQL
-- Ejecutar en SQL Editor del proyecto Supabase

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- â”€â”€â”€ Tablas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS contenedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  armario TEXT NOT NULL,
  estante TEXT NOT NULL,
  contenedor TEXT,
  ubicacion TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  marca TEXT DEFAULT '',
  modelo TEXT DEFAULT '',
  tipo TEXT DEFAULT '',
  detalle TEXT DEFAULT '',
  calibracion TEXT DEFAULT '',
  comentario TEXT DEFAULT '',
  fecha_relevamiento DATE,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  contenedor_id UUID NOT NULL REFERENCES contenedores(id) ON DELETE CASCADE,
  cantidad INTEGER NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (item_id, contenedor_id)
);

CREATE TABLE IF NOT EXISTS movimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id),
  contenedor_id UUID NOT NULL REFERENCES contenedores(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('egreso', 'ingreso')),
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  usuario TEXT NOT NULL,
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  sync_status TEXT NOT NULL DEFAULT 'synced' CHECK (sync_status IN ('pending', 'synced', 'failed')),
  offline_id TEXT UNIQUE,
  egreso_movimiento_id UUID REFERENCES movimientos(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_contenedor ON stock(contenedor_id);
CREATE INDEX IF NOT EXISTS idx_stock_item ON stock(item_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_movimientos_usuario ON movimientos(usuario);
CREATE INDEX IF NOT EXISTS idx_movimientos_offline ON movimientos(offline_id) WHERE offline_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_movimientos_egreso_ref ON movimientos(egreso_movimiento_id);

-- Vista inventario (join para API / Power BI)
CREATE OR REPLACE VIEW v_inventario AS
SELECT
  s.id AS stock_id,
  i.id AS item_id,
  c.id AS contenedor_id,
  c.codigo AS contenedor_codigo,
  c.armario,
  c.ubicacion,
  c.estante,
  c.contenedor,
  i.nombre,
  i.marca,
  i.modelo,
  i.tipo,
  i.detalle,
  i.calibracion,
  i.comentario,
  i.fecha_relevamiento,
  s.cantidad,
  s.updated_at
FROM stock s
JOIN items i ON i.id = s.item_id AND i.activo = true
JOIN contenedores c ON c.id = s.contenedor_id;

-- Egresos pendientes de devoluciÃ³n
CREATE OR REPLACE VIEW v_egresos_pendientes AS
SELECT m.*
FROM movimientos m
WHERE m.tipo = 'egreso'
  AND NOT EXISTS (
    SELECT 1 FROM movimientos ing
    WHERE ing.tipo = 'ingreso' AND ing.egreso_movimiento_id = m.id
  );

-- â”€â”€â”€ Registrar egreso (transacciÃ³n) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE OR REPLACE FUNCTION registrar_egreso(
  p_item_id UUID,
  p_contenedor_id UUID,
  p_cantidad INTEGER,
  p_usuario TEXT,
  p_offline_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_stock INTEGER;
  v_mov_id UUID;
BEGIN
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RAISE EXCEPTION 'Cantidad invÃ¡lida';
  END IF;

  SELECT cantidad INTO v_stock
  FROM stock
  WHERE item_id = p_item_id AND contenedor_id = p_contenedor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock no encontrado para este Ã­tem/contenedor';
  END IF;

  IF v_stock < p_cantidad THEN
    RAISE EXCEPTION 'Stock insuficiente. Disponible: %', v_stock;
  END IF;

  UPDATE stock
  SET cantidad = cantidad - p_cantidad, updated_at = now()
  WHERE item_id = p_item_id AND contenedor_id = p_contenedor_id;

  INSERT INTO movimientos (item_id, contenedor_id, tipo, cantidad, usuario, sync_status, offline_id)
  VALUES (p_item_id, p_contenedor_id, 'egreso', p_cantidad, p_usuario, 'synced', p_offline_id)
  RETURNING id INTO v_mov_id;

  RETURN jsonb_build_object(
    'ok', true,
    'movimiento_id', v_mov_id,
    'stock_restante', v_stock - p_cantidad
  );
END;
$$;

-- â”€â”€â”€ Registrar ingreso / devoluciÃ³n (transacciÃ³n) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE OR REPLACE FUNCTION registrar_ingreso(
  p_egreso_movimiento_id UUID,
  p_usuario TEXT,
  p_offline_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_egreso movimientos%ROWTYPE;
  v_mov_id UUID;
BEGIN
  SELECT * INTO v_egreso
  FROM movimientos
  WHERE id = p_egreso_movimiento_id AND tipo = 'egreso'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Egreso no encontrado';
  END IF;

  IF EXISTS (
    SELECT 1 FROM movimientos
    WHERE egreso_movimiento_id = p_egreso_movimiento_id AND tipo = 'ingreso'
  ) THEN
    RAISE EXCEPTION 'Este egreso ya fue devuelto';
  END IF;

  UPDATE stock
  SET cantidad = cantidad + v_egreso.cantidad, updated_at = now()
  WHERE item_id = v_egreso.item_id AND contenedor_id = v_egreso.contenedor_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock no encontrado';
  END IF;

  INSERT INTO movimientos (
    item_id, contenedor_id, tipo, cantidad, usuario, egreso_movimiento_id, sync_status, offline_id
  )
  VALUES (
    v_egreso.item_id, v_egreso.contenedor_id, 'ingreso', v_egreso.cantidad,
    p_usuario, p_egreso_movimiento_id, 'synced', p_offline_id
  )
  RETURNING id INTO v_mov_id;

  RETURN jsonb_build_object('ok', true, 'movimiento_id', v_mov_id);
END;
$$;
-- Usuarios del sistema (operarios y administradores)
-- Ejecutar en SQL Editor de Supabase despuÃ©s de schema.sql

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

COMMENT ON TABLE users IS 'Cuentas de operarios y administradores del inventario';
COMMENT ON COLUMN users.password_hash IS 'NULL hasta que el usuario define su contraseÃ±a en el primer ingreso';
