-- Flujo recepción en 3 pasos: remito → ingreso físico → aduana
-- Ejecutar DESPUÉS de patch-proyectos-fase2.sql

-- Estados nuevos + legado
ALTER TABLE proyecto_recepciones DROP CONSTRAINT IF EXISTS proyecto_recepciones_estado_check;
ALTER TABLE proyecto_recepciones
  ADD CONSTRAINT proyecto_recepciones_estado_check
  CHECK (estado IN (
    'borrador',
    'pendiente_asignacion',
    'parcial',
    'cerrada',
    'cancelada',
    'pendiente_ingreso',
    'ingreso_en_curso',
    'pendiente_cierre',
    'en_aduana'
  ));

ALTER TABLE proyecto_recepciones
  ADD COLUMN IF NOT EXISTS proveedor_id UUID REFERENCES proveedores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS proveedor_cuit TEXT,
  ADD COLUMN IF NOT EXISTS proveedor_domicilio TEXT,
  ADD COLUMN IF NOT EXISTS proveedor_localidad TEXT,
  ADD COLUMN IF NOT EXISTS proveedor_iva TEXT,
  ADD COLUMN IF NOT EXISTS operador_ingreso TEXT,
  ADD COLUMN IF NOT EXISTS cierre_notas TEXT;

CREATE INDEX IF NOT EXISTS idx_proyecto_recepciones_proveedor
  ON proyecto_recepciones(proveedor_id);

ALTER TABLE proyecto_recepcion_lineas
  ADD COLUMN IF NOT EXISTS unidad TEXT,
  ADD COLUMN IF NOT EXISTS cantidad_confirmada NUMERIC NOT NULL DEFAULT 0
    CHECK (cantidad_confirmada >= 0),
  ADD COLUMN IF NOT EXISTS motivo TEXT
    CHECK (motivo IS NULL OR motivo IN ('faltante_fisico', 'diferencia', 'extra')),
  ADD COLUMN IF NOT EXISTS es_extra BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stock_id UUID REFERENCES stock(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notas_ingreso TEXT;

CREATE INDEX IF NOT EXISTS idx_proyecto_recepcion_lineas_stock
  ON proyecto_recepcion_lineas(stock_id)
  WHERE stock_id IS NOT NULL;

COMMENT ON COLUMN proyecto_recepciones.estado IS
  'Flujo v2: pendiente_ingreso → ingreso_en_curso → en_aduana|pendiente_cierre; legado: pendiente_asignacion/parcial/cerrada';
COMMENT ON COLUMN proyecto_recepcion_lineas.cantidad_confirmada IS
  'Cantidad física confirmada en ingreso (scan/marca)';
COMMENT ON COLUMN proyecto_recepcion_lineas.stock_id IS
  'Stock creado en aduana al enviar ingreso';
