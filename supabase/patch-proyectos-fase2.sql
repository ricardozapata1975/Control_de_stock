-- Fase 2 Proyectos: recepciones + sugerencias de asignación a faltantes
-- Ejecutar DESPUÉS de patch-proyectos.sql. No altera stock/movimientos existentes.

CREATE TABLE IF NOT EXISTS proyecto_recepciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sede TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'manual'
    CHECK (tipo IN ('manual', 'remito', 'orden_compra')),
  proveedor TEXT,
  documento TEXT,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  operador TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente_asignacion'
    CHECK (estado IN ('borrador', 'pendiente_asignacion', 'parcial', 'cerrada', 'cancelada')),
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proyecto_recepciones_sede ON proyecto_recepciones(sede);
CREATE INDEX IF NOT EXISTS idx_proyecto_recepciones_estado ON proyecto_recepciones(estado);

CREATE TABLE IF NOT EXISTS proyecto_recepcion_lineas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recepcion_id UUID NOT NULL REFERENCES proyecto_recepciones(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id) ON DELETE SET NULL,
  codigo_articulo TEXT,
  descripcion TEXT,
  cantidad NUMERIC NOT NULL CHECK (cantidad > 0),
  cantidad_asignada NUMERIC NOT NULL DEFAULT 0 CHECK (cantidad_asignada >= 0),
  contenedor_id UUID REFERENCES contenedores(id) ON DELETE SET NULL,
  validado BOOLEAN NOT NULL DEFAULT false,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proyecto_recepcion_lineas_recepcion
  ON proyecto_recepcion_lineas(recepcion_id);
CREATE INDEX IF NOT EXISTS idx_proyecto_recepcion_lineas_item
  ON proyecto_recepcion_lineas(item_id);

CREATE TABLE IF NOT EXISTS proyecto_recepcion_sugerencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recepcion_id UUID NOT NULL REFERENCES proyecto_recepciones(id) ON DELETE CASCADE,
  linea_id UUID REFERENCES proyecto_recepcion_lineas(id) ON DELETE CASCADE,
  faltante_id UUID REFERENCES proyecto_faltantes(id) ON DELETE SET NULL,
  proyecto_id UUID REFERENCES proyectos(id) ON DELETE SET NULL,
  tablero_id UUID REFERENCES proyecto_tableros(id) ON DELETE SET NULL,
  material_id UUID REFERENCES proyecto_materiales(id) ON DELETE SET NULL,
  item_id UUID REFERENCES items(id) ON DELETE SET NULL,
  cantidad_sugerida NUMERIC NOT NULL CHECK (cantidad_sugerida > 0),
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'aceptada', 'rechazada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proyecto_sugerencias_estado
  ON proyecto_recepcion_sugerencias(estado) WHERE estado = 'pendiente';
CREATE INDEX IF NOT EXISTS idx_proyecto_sugerencias_recepcion
  ON proyecto_recepcion_sugerencias(recepcion_id);

COMMENT ON TABLE proyecto_recepciones IS 'Recepción documental de materiales para el módulo Proyectos (no descuenta/alta stock por sí sola)';
COMMENT ON TABLE proyecto_recepcion_sugerencias IS 'Sugerencias de asignación a faltantes al ingresar/recepcionar material';
