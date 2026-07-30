-- Egreso por lote (retiro de contenedor completo) + QR de devolución
-- Ejecutar en SQL Editor de Supabase

CREATE TABLE IF NOT EXISTS egreso_lotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contenedor_id UUID REFERENCES contenedores(id),
  contenedor_codigo TEXT,
  usuario TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notas TEXT
);

CREATE INDEX IF NOT EXISTS idx_egreso_lotes_created ON egreso_lotes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_egreso_lotes_contenedor ON egreso_lotes(contenedor_id);

ALTER TABLE movimientos
  ADD COLUMN IF NOT EXISTS egreso_lote_id UUID REFERENCES egreso_lotes(id);

CREATE INDEX IF NOT EXISTS idx_movimientos_egreso_lote
  ON movimientos(egreso_lote_id)
  WHERE egreso_lote_id IS NOT NULL;

COMMENT ON TABLE egreso_lotes IS 'Lote de egreso (kit/contenedor completo) para remito interno y devolución por QR';
COMMENT ON COLUMN movimientos.egreso_lote_id IS 'Agrupa egresos de un retiro de contenedor completo; no es remito_id comercial';
