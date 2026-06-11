-- Parche: proyecto con tablas base incompletas (sin armario, activo, users, etc.)
-- Ejecutar en SQL Editor si full-setup.sql falló o solo corriste schema.sql antiguo.
-- Seguro si las tablas están vacías.

-- ─── contenedores: columna armario ─────────────────────────────────────────
ALTER TABLE contenedores ADD COLUMN IF NOT EXISTS armario TEXT;
UPDATE contenedores SET armario = split_part(codigo, '-', 1) WHERE armario IS NULL;
UPDATE contenedores SET armario = 'A00' WHERE armario IS NULL OR armario = '';
ALTER TABLE contenedores ALTER COLUMN armario SET NOT NULL;
ALTER TABLE contenedores ALTER COLUMN contenedor DROP NOT NULL;

-- ─── items: campos extra ───────────────────────────────────────────────────
ALTER TABLE items ADD COLUMN IF NOT EXISTS calibracion TEXT DEFAULT '';
ALTER TABLE items ADD COLUMN IF NOT EXISTS comentario TEXT DEFAULT '';
ALTER TABLE items ADD COLUMN IF NOT EXISTS fecha_relevamiento DATE;
ALTER TABLE items ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_items_activo ON items(activo) WHERE activo = true;

-- ─── movimientos: sync offline y devoluciones ──────────────────────────────
ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS sync_status TEXT NOT NULL DEFAULT 'synced';
ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS offline_id TEXT;
ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS egreso_movimiento_id UUID REFERENCES movimientos(id);
ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE movimientos SET sync_status = 'synced' WHERE sync_status IS NULL;
UPDATE movimientos SET created_at = COALESCE(fecha, now()) WHERE created_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS movimientos_offline_id_key ON movimientos(offline_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_offline ON movimientos(offline_id) WHERE offline_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_movimientos_egreso_ref ON movimientos(egreso_movimiento_id);

-- ─── usuarios ──────────────────────────────────────────────────────────────
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

-- ─── vistas y funciones (desde schema.sql) ───────────────────────────────────
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

CREATE OR REPLACE VIEW v_egresos_pendientes AS
SELECT m.*
FROM movimientos m
WHERE m.tipo = 'egreso'
  AND NOT EXISTS (
    SELECT 1 FROM movimientos ing
    WHERE ing.tipo = 'ingreso' AND ing.egreso_movimiento_id = m.id
  );

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
    RAISE EXCEPTION 'Cantidad inválida';
  END IF;

  SELECT cantidad INTO v_stock
  FROM stock
  WHERE item_id = p_item_id AND contenedor_id = p_contenedor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock no encontrado para este ítem/contenedor';
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
