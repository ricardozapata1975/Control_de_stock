-- Campos adicionales en ítems + vista inventario
ALTER TABLE items ADD COLUMN IF NOT EXISTS calibracion TEXT DEFAULT '';
ALTER TABLE items ADD COLUMN IF NOT EXISTS comentario TEXT DEFAULT '';
ALTER TABLE items ADD COLUMN IF NOT EXISTS fecha_relevamiento DATE;

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
JOIN items i ON i.id = s.item_id AND COALESCE(i.activo, true) = true
JOIN contenedores c ON c.id = s.contenedor_id;
