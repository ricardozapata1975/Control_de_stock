-- Fix de emergencia: recrear v_inventario con columna almacen
-- Ejecutar en SQL Editor de Supabase si patch-almacen.sql falló al recrear la vista.
-- Requiere que contenedores.almacen ya exista (ADD COLUMN del patch principal).

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

-- Verificación rápida
SELECT contenedor_codigo, almacen, armario, estante
FROM v_inventario
LIMIT 5;
