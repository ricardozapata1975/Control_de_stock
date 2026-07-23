-- Código de barras / QR original del fabricante en ítems
-- Ejecutar en SQL Editor de Supabase

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS codigo_fabricante TEXT;

-- Un código de fabricante no puede repetirse (cuando está cargado)
CREATE UNIQUE INDEX IF NOT EXISTS idx_items_codigo_fabricante_unique
  ON items (codigo_fabricante)
  WHERE codigo_fabricante IS NOT NULL AND btrim(codigo_fabricante) <> '';

CREATE INDEX IF NOT EXISTS idx_items_codigo_fabricante
  ON items (codigo_fabricante)
  WHERE codigo_fabricante IS NOT NULL AND btrim(codigo_fabricante) <> '';

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
  i.codigo_fabricante,
  s.cantidad,
  s.updated_at
FROM stock s
JOIN items i ON i.id = s.item_id AND COALESCE(i.activo, true) = true
JOIN contenedores c ON c.id = s.contenedor_id;
