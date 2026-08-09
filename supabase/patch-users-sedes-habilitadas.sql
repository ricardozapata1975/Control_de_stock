-- Sucursales habilitadas por usuario (multi-sede para operarios)
-- Ejecutar en SQL Editor de Supabase

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS sedes_habilitadas TEXT[] DEFAULT '{}';

COMMENT ON COLUMN users.sedes_habilitadas IS
  'Códigos de sede (SED001…) a los que el usuario puede ingresar. Admin ignora esta lista (todas). Vacío = solo sede_default.';

-- Migración suave: si hay sede_default y lista vacía, dejarla como única habilitada
UPDATE users
SET sedes_habilitadas = ARRAY[sede_default]
WHERE (sedes_habilitadas IS NULL OR cardinality(sedes_habilitadas) = 0)
  AND sede_default IS NOT NULL
  AND trim(sede_default) <> '';
