-- Agenda de proveedores (espejo de clientes + rubro / web)
-- Ejecutar en SQL Editor de Supabase

CREATE TABLE IF NOT EXISTS proveedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  razon_social TEXT,
  iva TEXT,
  domicilio TEXT,
  localidad TEXT,
  v_ref TEXT,
  cuit TEXT,
  rubro TEXT,
  contacto TEXT,
  telefono TEXT,
  email TEXT,
  web TEXT,
  notas TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proveedores_nombre ON proveedores(nombre);
CREATE INDEX IF NOT EXISTS idx_proveedores_activo ON proveedores(activo);
CREATE INDEX IF NOT EXISTS idx_proveedores_cuit ON proveedores(cuit);
CREATE INDEX IF NOT EXISTS idx_proveedores_rubro ON proveedores(rubro);

COMMENT ON TABLE proveedores IS 'Agenda de proveedores (compras / recepciones)';
COMMENT ON COLUMN proveedores.rubro IS 'Rubro o categoría del proveedor';
COMMENT ON COLUMN proveedores.contacto IS 'Persona de contacto';
COMMENT ON COLUMN proveedores.web IS 'Página web / URL';
