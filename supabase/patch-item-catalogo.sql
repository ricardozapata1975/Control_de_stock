-- Catálogo enriquecido de ítems (Siemens / Sivacon / listas de precios)
-- Ejecutar en SQL Editor de Supabase DESPUÉS de patch-item-fotos.sql / patch-users-sede.sql

ALTER TABLE items ADD COLUMN IF NOT EXISTS unidad TEXT DEFAULT '';
ALTER TABLE items ADD COLUMN IF NOT EXISTS packing TEXT DEFAULT '';
ALTER TABLE items ADD COLUMN IF NOT EXISTS precio_lista NUMERIC;
ALTER TABLE items ADD COLUMN IF NOT EXISTS moneda TEXT DEFAULT '';
ALTER TABLE items ADD COLUMN IF NOT EXISTS peso_kg NUMERIC;
ALTER TABLE items ADD COLUMN IF NOT EXISTS familia TEXT DEFAULT '';
ALTER TABLE items ADD COLUMN IF NOT EXISTS subfamilia TEXT DEFAULT '';
ALTER TABLE items ADD COLUMN IF NOT EXISTS tema TEXT DEFAULT '';
ALTER TABLE items ADD COLUMN IF NOT EXISTS catalogo_fuente TEXT DEFAULT '';
ALTER TABLE items ADD COLUMN IF NOT EXISTS catalogo_vigencia TEXT DEFAULT '';

COMMENT ON COLUMN items.unidad IS 'Unidad de medida del catálogo (PCE, etc.)';
COMMENT ON COLUMN items.packing IS 'Packing / MOQ del fabricante';
COMMENT ON COLUMN items.precio_lista IS 'Precio de lista del catálogo de origen';
COMMENT ON COLUMN items.moneda IS 'EUR | USD | ARS | …';
COMMENT ON COLUMN items.peso_kg IS 'Peso neto en kg (Sivacon)';
COMMENT ON COLUMN items.familia IS 'Familia Siemens/Sivacon';
COMMENT ON COLUMN items.subfamilia IS 'Subfamilia de producto';
COMMENT ON COLUMN items.tema IS 'Tema / línea de producto';
COMMENT ON COLUMN items.catalogo_fuente IS 'sivacon_s8 | siemens_ar | …';
COMMENT ON COLUMN items.catalogo_vigencia IS 'Vigencia del precio (texto o fecha ISO)';

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
  i.unidad,
  i.packing,
  i.precio_lista,
  i.moneda,
  i.peso_kg,
  i.familia,
  i.subfamilia,
  i.tema,
  i.catalogo_fuente,
  i.catalogo_vigencia,
  i.imagen_path,
  i.imagen_url,
  s.cantidad,
  s.updated_at
FROM stock s
JOIN items i ON i.id = s.item_id AND COALESCE(i.activo, true) = true
JOIN contenedores c ON c.id = s.contenedor_id;
