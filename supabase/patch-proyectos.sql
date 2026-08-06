-- Módulo PROYECTOS (desacoplado del inventario existente)
-- Ejecutar en SQL Editor de Supabase. No altera tablas de stock/movimientos.
-- Las reservas viven en "limbo": no descuentan stock.cantidad; el disponible neto
-- se calcula como stock - SUM(reservas activas) solo dentro de este módulo.

CREATE TABLE IF NOT EXISTS proyectos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  sede TEXT NOT NULL,
  prioridad TEXT NOT NULL DEFAULT 'media'
    CHECK (prioridad IN ('critica', 'alta', 'media', 'baja')),
  estado TEXT NOT NULL DEFAULT 'activo'
    CHECK (estado IN ('borrador', 'activo', 'pausado', 'cerrado', 'cancelado')),
  fecha_inicio DATE,
  fecha_objetivo DATE,
  responsable TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proyectos_sede ON proyectos(sede);
CREATE INDEX IF NOT EXISTS idx_proyectos_estado ON proyectos(estado);
CREATE INDEX IF NOT EXISTS idx_proyectos_prioridad ON proyectos(prioridad);

CREATE TABLE IF NOT EXISTS proyecto_tableros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  codigo TEXT,
  nombre TEXT NOT NULL,
  prioridad TEXT NOT NULL DEFAULT 'media'
    CHECK (prioridad IN ('critica', 'alta', 'media', 'baja')),
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'en_curso', 'bloqueado', 'completado', 'cancelado')),
  fecha_objetivo DATE,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proyecto_tableros_proyecto ON proyecto_tableros(proyecto_id);

CREATE TABLE IF NOT EXISTS proyecto_materiales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  tablero_id UUID REFERENCES proyecto_tableros(id) ON DELETE SET NULL,
  item_id UUID REFERENCES items(id) ON DELETE SET NULL,
  codigo_articulo TEXT,
  descripcion TEXT,
  cantidad_requerida NUMERIC NOT NULL DEFAULT 0 CHECK (cantidad_requerida >= 0),
  cantidad_reservada NUMERIC NOT NULL DEFAULT 0 CHECK (cantidad_reservada >= 0),
  cantidad_faltante NUMERIC NOT NULL DEFAULT 0 CHECK (cantidad_faltante >= 0),
  cantidad_entregada NUMERIC NOT NULL DEFAULT 0 CHECK (cantidad_entregada >= 0),
  cantidad_consumida NUMERIC NOT NULL DEFAULT 0 CHECK (cantidad_consumida >= 0),
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'parcial', 'completo', 'cancelado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proyecto_materiales_proyecto ON proyecto_materiales(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_proyecto_materiales_tablero ON proyecto_materiales(tablero_id);
CREATE INDEX IF NOT EXISTS idx_proyecto_materiales_item ON proyecto_materiales(item_id);

-- Reserva / LIMBO: material asignado a proyecto sin consumir stock físico
CREATE TABLE IF NOT EXISTS proyecto_reservas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  tablero_id UUID REFERENCES proyecto_tableros(id) ON DELETE SET NULL,
  material_id UUID REFERENCES proyecto_materiales(id) ON DELETE SET NULL,
  item_id UUID NOT NULL REFERENCES items(id),
  stock_id UUID,
  contenedor_id UUID REFERENCES contenedores(id) ON DELETE SET NULL,
  cantidad NUMERIC NOT NULL CHECK (cantidad > 0),
  estado TEXT NOT NULL DEFAULT 'activa'
    CHECK (estado IN ('activa', 'liberada', 'reasignada', 'entregada', 'consumida')),
  sede TEXT,
  notas TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proyecto_reservas_activas
  ON proyecto_reservas(item_id, estado) WHERE estado = 'activa';
CREATE INDEX IF NOT EXISTS idx_proyecto_reservas_proyecto ON proyecto_reservas(proyecto_id);

CREATE TABLE IF NOT EXISTS proyecto_faltantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  tablero_id UUID REFERENCES proyecto_tableros(id) ON DELETE SET NULL,
  material_id UUID REFERENCES proyecto_materiales(id) ON DELETE SET NULL,
  item_id UUID REFERENCES items(id) ON DELETE SET NULL,
  codigo_articulo TEXT,
  cantidad NUMERIC NOT NULL CHECK (cantidad > 0),
  cantidad_cubierta NUMERIC NOT NULL DEFAULT 0 CHECK (cantidad_cubierta >= 0),
  fecha_limite DATE,
  prioridad TEXT NOT NULL DEFAULT 'media'
    CHECK (prioridad IN ('critica', 'alta', 'media', 'baja')),
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'parcial', 'cubierto', 'cancelado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proyecto_faltantes_estado ON proyecto_faltantes(estado);
CREATE INDEX IF NOT EXISTS idx_proyecto_faltantes_proyecto ON proyecto_faltantes(proyecto_id);

CREATE TABLE IF NOT EXISTS proyecto_movimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID REFERENCES proyectos(id) ON DELETE SET NULL,
  tablero_id UUID REFERENCES proyecto_tableros(id) ON DELETE SET NULL,
  reserva_id UUID REFERENCES proyecto_reservas(id) ON DELETE SET NULL,
  material_id UUID REFERENCES proyecto_materiales(id) ON DELETE SET NULL,
  item_id UUID REFERENCES items(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL,
  cantidad NUMERIC,
  desde_proyecto_id UUID REFERENCES proyectos(id) ON DELETE SET NULL,
  hacia_proyecto_id UUID REFERENCES proyectos(id) ON DELETE SET NULL,
  estado_material TEXT,
  usuario TEXT,
  notas TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proyecto_movimientos_proyecto ON proyecto_movimientos(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_proyecto_movimientos_created ON proyecto_movimientos(created_at DESC);

CREATE TABLE IF NOT EXISTS proyecto_pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  tablero_id UUID REFERENCES proyecto_tableros(id) ON DELETE SET NULL,
  nombre TEXT,
  archivo_nombre TEXT,
  estado TEXT NOT NULL DEFAULT 'procesado'
    CHECK (estado IN ('borrador', 'procesado', 'cancelado')),
  resumen JSONB,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS proyecto_pedido_lineas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES proyecto_pedidos(id) ON DELETE CASCADE,
  codigo TEXT,
  cantidad NUMERIC NOT NULL DEFAULT 0,
  item_id UUID REFERENCES items(id) ON DELETE SET NULL,
  validado BOOLEAN NOT NULL DEFAULT false,
  error TEXT,
  material_id UUID REFERENCES proyecto_materiales(id) ON DELETE SET NULL,
  reservado NUMERIC NOT NULL DEFAULT 0,
  faltante NUMERIC NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS proyecto_alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID REFERENCES proyectos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  severidad TEXT NOT NULL DEFAULT 'info'
    CHECK (severidad IN ('info', 'warning', 'critical')),
  mensaje TEXT NOT NULL,
  leida BOOLEAN NOT NULL DEFAULT false,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proyecto_alertas_leida ON proyecto_alertas(leida) WHERE leida = false;

COMMENT ON TABLE proyectos IS 'Módulo Proyectos: fabricación de tableros eléctricos';
COMMENT ON TABLE proyecto_reservas IS 'Limbo: stock comprometido sin descontar cantidad física de stock';
COMMENT ON TABLE proyecto_movimientos IS 'Trazabilidad de estados/materiales del módulo Proyectos';
