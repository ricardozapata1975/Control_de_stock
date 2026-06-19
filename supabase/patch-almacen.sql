-- Migración completa: nivel Almacén / Depósito / Oficina (ALM01, ALM02…)
-- Ejecutar TODO este archivo de una vez en SQL Editor de Supabase.
-- Idempotente: se puede volver a ejecutar sin romper nada.
--
-- Error típico si se ejecuta solo la vista (sin DROP previo):
--   ERROR 42P16: cannot change name of view column "armario" to "almacen"
--   ERROR 42703: column c.almacen does not exist
-- Causa: CREATE OR REPLACE no puede insertar columnas nuevas en medio de la vista,
-- o la columna contenedores.almacen no existe aún.
-- Solución: pegar y ejecutar este script completo (pasos 1→3).

-- ─── 1. Columna almacén en contenedores ───────────────────────────────────
ALTER TABLE contenedores ADD COLUMN IF NOT EXISTS almacen TEXT NOT NULL DEFAULT 'ALM01';

UPDATE contenedores
SET almacen = 'ALM01'
WHERE almacen IS NULL OR almacen = '';

CREATE INDEX IF NOT EXISTS idx_contenedores_almacen ON contenedores(almacen);

-- ─── 2. Vista inventario con almacén ────────────────────────────────────────
-- DROP necesario: CREATE OR REPLACE no puede insertar columna `almacen` antes de `armario`
-- en una vista existente (PostgreSQL interpreta el cambio como renombrar columnas).
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

-- ─── 3. Verificación (opcional; debe devolver filas con almacen = ALM01) ──
SELECT contenedor_codigo, almacen, armario, estante
FROM v_inventario
LIMIT 5;
