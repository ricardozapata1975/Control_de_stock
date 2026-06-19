-- Migración completa: nivel Almacén / Depósito / Oficina (ALM01, ALM02…)
-- Ejecutar TODO este archivo de una sola vez en SQL Editor de Supabase.
--
-- Error típico si falta la columna:
--   ERROR 42703: column c.almacen does not exist
-- Causa: se recreó v_inventario antes de ALTER TABLE contenedores, o el patch
-- original falló a mitad. Este script es idempotente y corrige ambos casos.
--
-- Orden obligatorio:
--   1) ALTER TABLE (columna almacen)
--   2) UPDATE + índice
--   3) DROP VIEW + CREATE VIEW (con c.almacen)

-- ─── 1. Columna almacén en contenedores ───────────────────────────────────

ALTER TABLE contenedores ADD COLUMN IF NOT EXISTS almacen TEXT NOT NULL DEFAULT 'ALM01';

UPDATE contenedores
SET almacen = 'ALM01'
WHERE almacen IS NULL OR almacen = '';

CREATE INDEX IF NOT EXISTS idx_contenedores_almacen ON contenedores(almacen);

-- ─── 2. Vista inventario con almacén ────────────────────────────────────────
-- DROP necesario: CREATE OR REPLACE no puede insertar columna `almacen` antes
-- de `armario` en una vista existente (PostgreSQL lo interpreta como renombrar).

DROP VIEW IF EXISTS v_inventario CASCADE;

CREATE VIEW v_inventario AS
SELECT
  s.id AS stock_id,
  i.id AS item_id,
  c.id AS contenedor_id,
  c.codigo AS contenedor_codigo,
  c.almacen,
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

-- ─── 3. Verificación (opcional; debe devolver filas sin error) ────────────

SELECT almacen, COUNT(*) AS contenedores
FROM contenedores
GROUP BY almacen
ORDER BY almacen;

SELECT stock_id, contenedor_codigo, almacen, armario, nombre, cantidad
FROM v_inventario
LIMIT 5;
