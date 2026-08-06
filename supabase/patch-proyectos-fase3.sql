-- Fase 3 Proyectos: devoluciones, auditorías, herramientas
-- Ejecutar DESPUÉS de patch-proyectos.sql y patch-proyectos-fase2.sql.
-- No altera stock/movimientos/egresos del inventario existente.

CREATE TABLE IF NOT EXISTS proyecto_devoluciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  tablero_id UUID REFERENCES proyecto_tableros(id) ON DELETE SET NULL,
  material_id UUID REFERENCES proyecto_materiales(id) ON DELETE SET NULL,
  reserva_id UUID REFERENCES proyecto_reservas(id) ON DELETE SET NULL,
  item_id UUID REFERENCES items(id) ON DELETE SET NULL,
  codigo_articulo TEXT,
  cantidad NUMERIC NOT NULL CHECK (cantidad > 0),
  motivo TEXT,
  usuario TEXT,
  sede TEXT,
  estado TEXT NOT NULL DEFAULT 'registrada'
    CHECK (estado IN ('pendiente', 'registrada', 'cancelada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proyecto_devoluciones_proyecto ON proyecto_devoluciones(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_proyecto_devoluciones_estado ON proyecto_devoluciones(estado);

CREATE TABLE IF NOT EXISTS proyecto_auditorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sede TEXT NOT NULL,
  almacen TEXT,
  armario TEXT,
  estante TEXT,
  contenedor_codigo TEXT,
  estado TEXT NOT NULL DEFAULT 'abierta'
    CHECK (estado IN ('abierta', 'cerrada', 'cancelada')),
  operador TEXT,
  notas TEXT,
  resumen JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_proyecto_auditorias_sede ON proyecto_auditorias(sede);
CREATE INDEX IF NOT EXISTS idx_proyecto_auditorias_estado ON proyecto_auditorias(estado);

CREATE TABLE IF NOT EXISTS proyecto_auditoria_lineas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auditoria_id UUID NOT NULL REFERENCES proyecto_auditorias(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id) ON DELETE SET NULL,
  codigo TEXT,
  nombre TEXT,
  cantidad_sistema NUMERIC NOT NULL DEFAULT 0,
  cantidad_fisica NUMERIC,
  diferencia NUMERIC,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proyecto_auditoria_lineas_aud
  ON proyecto_auditoria_lineas(auditoria_id);

CREATE TABLE IF NOT EXISTS proyecto_herramientas_asignaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES items(id) ON DELETE SET NULL,
  codigo TEXT,
  nombre TEXT,
  operario TEXT NOT NULL,
  caja TEXT,
  sede TEXT,
  estado TEXT NOT NULL DEFAULT 'prestada'
    CHECK (estado IN ('prestada', 'devuelta', 'perdida', 'rota', 'reemplazada')),
  fecha_entrega TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_devolucion TIMESTAMPTZ,
  notas TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proyecto_herramientas_estado
  ON proyecto_herramientas_asignaciones(estado);
CREATE INDEX IF NOT EXISTS idx_proyecto_herramientas_sede
  ON proyecto_herramientas_asignaciones(sede);

CREATE TABLE IF NOT EXISTS proyecto_herramientas_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asignacion_id UUID NOT NULL REFERENCES proyecto_herramientas_asignaciones(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  usuario TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proyecto_herramientas_eventos_asig
  ON proyecto_herramientas_eventos(asignacion_id);

COMMENT ON TABLE proyecto_devoluciones IS 'Devolución de material de proyecto (trazabilidad módulo; no ajusta stock físico sola)';
COMMENT ON TABLE proyecto_auditorias IS 'Conteo físico vs sistema por ubicación';
COMMENT ON TABLE proyecto_herramientas_asignaciones IS 'Préstamo de herramientas a operarios/cajas';
