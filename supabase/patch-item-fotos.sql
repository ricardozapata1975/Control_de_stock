-- Foto de producto (baja resolución) en ítems + bucket Storage
-- Ejecutar en SQL Editor de Supabase

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS imagen_path TEXT;

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS imagen_url TEXT;

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
  i.imagen_path,
  i.imagen_url,
  s.cantidad,
  s.updated_at
FROM stock s
JOIN items i ON i.id = s.item_id AND COALESCE(i.activo, true) = true
JOIN contenedores c ON c.id = s.contenedor_id;

-- Bucket público para miniaturas (lectura desde el front)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'item-fotos',
  'item-fotos',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Lectura pública del bucket (por si las policies bloquean)
DROP POLICY IF EXISTS "item_fotos_public_read" ON storage.objects;
CREATE POLICY "item_fotos_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'item-fotos');
