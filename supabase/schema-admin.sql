-- Migración: ítems activos/inactivos + usuario administrador (ejecutar después de schema.sql)

ALTER TABLE items ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_items_activo ON items(activo) WHERE activo = true;

-- Vista inventario solo ítems activos
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
