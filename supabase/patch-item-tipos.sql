-- Tipos de ítem dinámicos (reemplaza lista hardcodeada en frontend)
-- Ejecutar en SQL Editor de Supabase después de schema.sql

CREATE TABLE IF NOT EXISTS item_tipos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  activo BOOLEAN NOT NULL DEFAULT true,
  orden INTEGER
);

CREATE INDEX IF NOT EXISTS idx_item_tipos_activo ON item_tipos(activo);
CREATE INDEX IF NOT EXISTS idx_item_tipos_orden ON item_tipos(orden);

-- Tipos originales del sistema
INSERT INTO item_tipos (nombre, activo, orden)
SELECT v.nombre, true, v.orden
FROM (VALUES
  ('Herramienta', 1),
  ('Medición', 2),
  ('Eléctrica', 3),
  ('Neumática', 4),
  ('Consumible', 5),
  ('Otro', 6)
) AS v(nombre, orden)
ON CONFLICT (nombre) DO NOTHING;

-- Tipos ya usados en items importados
INSERT INTO item_tipos (nombre, activo, orden)
SELECT DISTINCT trim(i.tipo), true, 100 + row_number() OVER (ORDER BY trim(i.tipo))
FROM items i
WHERE i.tipo IS NOT NULL
  AND trim(i.tipo) <> ''
ON CONFLICT (nombre) DO NOTHING;

-- Verificación
SELECT nombre, activo, orden FROM item_tipos ORDER BY orden NULLS LAST, nombre;
