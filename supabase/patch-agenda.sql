-- Agenda: logos/firmas de oficinas (empresas emisoras) + campos extra de clientes
-- Ejecutar en SQL Editor de Supabase

-- Empresas emisoras: vínculo a sede + assets de membrete
ALTER TABLE empresas_emisoras
  ADD COLUMN IF NOT EXISTS sede_codigo TEXT;

ALTER TABLE empresas_emisoras
  ADD COLUMN IF NOT EXISTS logo_path TEXT;

ALTER TABLE empresas_emisoras
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

ALTER TABLE empresas_emisoras
  ADD COLUMN IF NOT EXISTS firma_path TEXT;

ALTER TABLE empresas_emisoras
  ADD COLUMN IF NOT EXISTS firma_url TEXT;

ALTER TABLE empresas_emisoras
  ADD COLUMN IF NOT EXISTS notas TEXT;

-- Clientes: contacto y flags para agenda
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS telefono TEXT;

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS contacto TEXT;

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS notas TEXT;

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_clientes_activo ON clientes(activo);
CREATE INDEX IF NOT EXISTS idx_empresas_emisoras_sede ON empresas_emisoras(sede_codigo);

-- Bucket público para logos y firmas de oficinas
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'empresa-assets',
  'empresa-assets',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "empresa_assets_public_read" ON storage.objects;
CREATE POLICY "empresa_assets_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'empresa-assets');
