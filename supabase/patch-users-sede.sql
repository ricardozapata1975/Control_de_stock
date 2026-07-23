-- Sucursal (sede) de trabajo en usuarios + sede en vista inventario
-- Ejecutar en SQL Editor de Supabase

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS sede_default TEXT DEFAULT 'SED001';

COMMENT ON COLUMN users.sede_default IS 'Última sucursal elegida en el login (filtro de trabajo)';

DROP VIEW IF EXISTS v_inventario CASCADE;

CREATE VIEW v_inventario AS
SELECT
  s.id AS stock_id,
  i.id AS item_id,
  c.id AS contenedor_id,
  c.codigo AS contenedor_codigo,
  c.almacen,
  COALESCE(NULLIF(trim(c.sede), ''), 'SED001') AS sede,
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
  i.imagen_path,
  i.imagen_url,
  s.cantidad,
  s.updated_at
FROM stock s
JOIN items i ON i.id = s.item_id AND COALESCE(i.activo, true) = true
JOIN contenedores c ON c.id = s.contenedor_id;

CREATE INDEX IF NOT EXISTS idx_contenedores_sede_almacen ON contenedores (sede, almacen);
