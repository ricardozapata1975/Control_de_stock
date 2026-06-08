-- Migración: armario + estante (obligatorio) + contenedor opcional
-- Ejecutar en proyectos que ya tenían schema.sql antiguo

ALTER TABLE contenedores ADD COLUMN IF NOT EXISTS armario TEXT;

UPDATE contenedores SET armario = split_part(codigo, '-', 1) WHERE armario IS NULL;

UPDATE contenedores SET estante = 'E' || lpad(regexp_replace(split_part(codigo, '-', 2), '\D', '', 'g'), 2, '0')
WHERE estante ~ '^E\d$';

UPDATE contenedores SET contenedor = 'C' || lpad(regexp_replace(split_part(codigo, '-', 3), '\D', '', 'g'), 2, '0')
WHERE codigo ~ '-C\d' AND (contenedor IS NULL OR contenedor = '');

UPDATE contenedores SET contenedor = NULL
WHERE codigo !~ '-C\d{2}$' OR contenedor = '';

UPDATE contenedores SET ubicacion = CASE armario
  WHEN 'A00' THEN 'Armario Papelería'
  WHEN 'A01' THEN 'Armario Herramientas'
  WHEN 'A02' THEN 'Armario Electrónica'
  ELSE ubicacion
END WHERE armario IN ('A00', 'A01', 'A02');

ALTER TABLE contenedores ALTER COLUMN contenedor DROP NOT NULL;

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
  s.cantidad,
  s.updated_at
FROM stock s
JOIN items i ON i.id = s.item_id AND COALESCE(i.activo, true) = true
JOIN contenedores c ON c.id = s.contenedor_id;
