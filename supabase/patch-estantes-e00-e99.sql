-- Amplía estantes/gavetas a E00–E99 (códigos SISCOM tipo 11.41 → A11-E41)
-- Ejecutar en SQL Editor de Supabase si el catálogo ya está en DB.

INSERT INTO catalogo_config (key, value)
VALUES
  ('estanteMin', '0'::jsonb),
  ('estanteMax', '99'::jsonb)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value;
