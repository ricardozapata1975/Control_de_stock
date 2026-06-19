-- Migración: nivel Almacén / Depósito / Oficina (ALM01, ALM02…)
-- Ejecutar en SQL Editor de Supabase (idempotente).

-- Columna almacén en contenedores
ALTER TABLE contenedores ADD COLUMN IF NOT EXISTS almacen TEXT NOT NULL DEFAULT 'ALM01';

UPDATE contenedores
SET almacen = 'ALM01'
WHERE almacen IS NULL OR almacen = '';

CREATE INDEX IF NOT EXISTS idx_contenedores_almacen ON contenedores(almacen);

-- Vista inventario con almacén
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
