-- Parche: módulo Remito (empresas emisoras, clientes, remitos, estados movimientos)
-- Ejecutar en Supabase SQL Editor después de schema.sql

-- ─── Empresas emisoras ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS empresas_emisoras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  razon_social TEXT NOT NULL,
  cuit TEXT NOT NULL,
  ing_brutos TEXT,
  domicilio TEXT,
  localidad TEXT,
  telefono TEXT,
  fax TEXT,
  email TEXT,
  web TEXT,
  fecha_inicio_actividades DATE,
  codigo_documento TEXT NOT NULL DEFAULT '91',
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_empresas_emisoras_activo ON empresas_emisoras(activo);

-- ─── Clientes destinatarios ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  razon_social TEXT,
  iva TEXT,
  domicilio TEXT,
  localidad TEXT,
  v_ref TEXT,
  cuit TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clientes_nombre ON clientes(lower(nombre));

-- ─── Remitos ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS remitos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero INTEGER NOT NULL,
  fecha DATE NOT NULL,
  empresa_emisora_id UUID NOT NULL REFERENCES empresas_emisoras(id),
  cliente_id UUID NOT NULL REFERENCES clientes(id),
  cant_bultos TEXT,
  transportista TEXT,
  transportista_cuit TEXT,
  transportista_domicilio TEXT,
  aclaracion TEXT,
  dni TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (empresa_emisora_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_remitos_fecha ON remitos(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_remitos_cliente ON remitos(cliente_id);

CREATE TABLE IF NOT EXISTS remito_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  remito_id UUID NOT NULL REFERENCES remitos(id) ON DELETE CASCADE,
  stock_id UUID NOT NULL,
  item_id UUID NOT NULL REFERENCES items(id),
  contenedor_id UUID NOT NULL REFERENCES contenedores(id),
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  descripcion TEXT
);

CREATE INDEX IF NOT EXISTS idx_remito_items_remito ON remito_items(remito_id);

-- ─── Campos adicionales en movimientos ─────────────────────────────────────

ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS estado TEXT;
ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS motivo TEXT;
ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS remito_id UUID REFERENCES remitos(id);

CREATE INDEX IF NOT EXISTS idx_movimientos_remito ON movimientos(remito_id) WHERE remito_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_movimientos_estado ON movimientos(estado) WHERE estado IS NOT NULL;

-- ─── Vista egresos pendientes (excluye vendidos y consumidos) ──────────────

CREATE OR REPLACE VIEW v_egresos_pendientes AS
SELECT m.*
FROM movimientos m
WHERE m.tipo = 'egreso'
  AND m.remito_id IS NULL
  AND COALESCE(m.estado, 'prestamo') = 'prestamo'
  AND NOT EXISTS (
    SELECT 1 FROM movimientos ing
    WHERE ing.tipo = 'ingreso' AND ing.egreso_movimiento_id = m.id
  );

-- ─── Actualizar registrar_egreso (estado consumible / préstamo) ─────────────

CREATE OR REPLACE FUNCTION registrar_egreso(
  p_item_id UUID,
  p_contenedor_id UUID,
  p_cantidad INTEGER,
  p_usuario TEXT,
  p_offline_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_stock INTEGER;
  v_mov_id UUID;
  v_tipo TEXT;
  v_estado TEXT;
BEGIN
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RAISE EXCEPTION 'Cantidad inválida';
  END IF;

  SELECT cantidad INTO v_stock
  FROM stock
  WHERE item_id = p_item_id AND contenedor_id = p_contenedor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock no encontrado para este ítem/contenedor';
  END IF;

  IF v_stock < p_cantidad THEN
    RAISE EXCEPTION 'Stock insuficiente. Disponible: %', v_stock;
  END IF;

  SELECT lower(coalesce(tipo, '')) INTO v_tipo FROM items WHERE id = p_item_id;
  IF v_tipo = 'consumible' THEN
    v_estado := 'consumido';
  ELSE
    v_estado := 'prestamo';
  END IF;

  UPDATE stock
  SET cantidad = cantidad - p_cantidad, updated_at = now()
  WHERE item_id = p_item_id AND contenedor_id = p_contenedor_id;

  INSERT INTO movimientos (
    item_id, contenedor_id, tipo, cantidad, usuario, sync_status, offline_id, estado, motivo
  )
  VALUES (
    p_item_id, p_contenedor_id, 'egreso', p_cantidad, p_usuario, 'synced', p_offline_id,
    v_estado,
    CASE WHEN v_estado = 'consumido' THEN 'Consumible' ELSE NULL END
  )
  RETURNING id INTO v_mov_id;

  RETURN jsonb_build_object(
    'ok', true,
    'movimiento_id', v_mov_id,
    'stock_restante', v_stock - p_cantidad,
    'estado', v_estado
  );
END;
$$;

-- ─── Crear remito (transacción atómica) ────────────────────────────────────

CREATE OR REPLACE FUNCTION crear_remito(
  p_numero INTEGER,
  p_fecha DATE,
  p_empresa_emisora_id UUID,
  p_cliente JSONB,
  p_cant_bultos TEXT,
  p_transportista TEXT,
  p_transportista_cuit TEXT,
  p_transportista_domicilio TEXT,
  p_aclaracion TEXT,
  p_dni TEXT,
  p_created_by TEXT,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_cliente_id UUID;
  v_remito_id UUID;
  v_item JSONB;
  v_stock INTEGER;
  v_item_id UUID;
  v_contenedor_id UUID;
  v_qty INTEGER;
  v_mov_id UUID;
BEGIN
  IF p_numero IS NULL OR p_numero <= 0 THEN
    RAISE EXCEPTION 'Número de remito inválido';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El remito debe tener al menos un ítem';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM empresas_emisoras WHERE id = p_empresa_emisora_id AND activo = true) THEN
    RAISE EXCEPTION 'Empresa emisora no encontrada';
  END IF;

  IF EXISTS (
    SELECT 1 FROM remitos WHERE empresa_emisora_id = p_empresa_emisora_id AND numero = p_numero
  ) THEN
    RAISE EXCEPTION 'Ya existe un remito con ese número para la empresa seleccionada';
  END IF;

  IF p_cliente ? 'id' AND nullif(p_cliente->>'id', '') IS NOT NULL THEN
    v_cliente_id := (p_cliente->>'id')::UUID;
    IF NOT EXISTS (SELECT 1 FROM clientes WHERE id = v_cliente_id) THEN
      RAISE EXCEPTION 'Cliente no encontrado';
    END IF;
    UPDATE clientes SET
      nombre = coalesce(nullif(p_cliente->>'nombre', ''), nombre),
      razon_social = coalesce(nullif(p_cliente->>'razon_social', ''), razon_social),
      iva = coalesce(nullif(p_cliente->>'iva', ''), iva),
      domicilio = coalesce(nullif(p_cliente->>'domicilio', ''), domicilio),
      localidad = coalesce(nullif(p_cliente->>'localidad', ''), localidad),
      v_ref = coalesce(nullif(p_cliente->>'v_ref', ''), v_ref),
      cuit = coalesce(nullif(p_cliente->>'cuit', ''), cuit),
      updated_at = now()
    WHERE id = v_cliente_id;
  ELSE
    IF nullif(trim(p_cliente->>'nombre'), '') IS NULL THEN
      RAISE EXCEPTION 'Nombre del cliente requerido';
    END IF;
    INSERT INTO clientes (nombre, razon_social, iva, domicilio, localidad, v_ref, cuit)
    VALUES (
      trim(p_cliente->>'nombre'),
      coalesce(nullif(trim(p_cliente->>'razon_social'), ''), trim(p_cliente->>'nombre')),
      nullif(p_cliente->>'iva', ''),
      nullif(p_cliente->>'domicilio', ''),
      nullif(p_cliente->>'localidad', ''),
      nullif(p_cliente->>'v_ref', ''),
      nullif(p_cliente->>'cuit', '')
    )
    RETURNING id INTO v_cliente_id;
  END IF;

  INSERT INTO remitos (
    numero, fecha, empresa_emisora_id, cliente_id,
    cant_bultos, transportista, transportista_cuit, transportista_domicilio,
    aclaracion, dni, created_by
  )
  VALUES (
    p_numero, p_fecha, p_empresa_emisora_id, v_cliente_id,
    p_cant_bultos, p_transportista, p_transportista_cuit, p_transportista_domicilio,
    p_aclaracion, p_dni, p_created_by
  )
  RETURNING id INTO v_remito_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := (v_item->>'cantidad')::INTEGER;
    v_item_id := (v_item->>'item_id')::UUID;
    v_contenedor_id := (v_item->>'contenedor_id')::UUID;

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida en ítem';
    END IF;

    SELECT cantidad INTO v_stock
    FROM stock
    WHERE id = (v_item->>'stock_id')::UUID
      AND item_id = v_item_id
      AND contenedor_id = v_contenedor_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Stock no encontrado para ítem %', v_item->>'stock_id';
    END IF;

    IF v_stock < v_qty THEN
      RAISE EXCEPTION 'Stock insuficiente para ítem. Disponible: %, solicitado: %', v_stock, v_qty;
    END IF;

    UPDATE stock
    SET cantidad = cantidad - v_qty, updated_at = now()
    WHERE id = (v_item->>'stock_id')::UUID;

    INSERT INTO remito_items (remito_id, stock_id, item_id, contenedor_id, cantidad, descripcion)
    VALUES (
      v_remito_id,
      (v_item->>'stock_id')::UUID,
      v_item_id,
      v_contenedor_id,
      v_qty,
      nullif(v_item->>'descripcion', '')
    );

    INSERT INTO movimientos (
      item_id, contenedor_id, tipo, cantidad, usuario, sync_status,
      estado, motivo, remito_id
    )
    VALUES (
      v_item_id, v_contenedor_id, 'egreso', v_qty, coalesce(p_created_by, 'Sistema'), 'synced',
      'vendido', 'Vendido a cliente', v_remito_id
    )
    RETURNING id INTO v_mov_id;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'remito_id', v_remito_id,
    'numero', p_numero,
    'cliente_id', v_cliente_id
  );
END;
$$;

-- ─── Seed empresas emisoras Grupo SYSTELEC ─────────────────────────────────

INSERT INTO empresas_emisoras (
  nombre, razon_social, cuit, ing_brutos, domicilio, localidad,
  telefono, fax, email, web, fecha_inicio_actividades, codigo_documento, activo
)
SELECT
  'SYSTELEC S.A.',
  'SYSTELEC S.A.',
  '30-68479873-8',
  '901-68479873-8',
  '26 de Julio 5450',
  'Villa Ballester (1653) — San Martín, Buenos Aires',
  '(011) 4768-7677',
  '(011) 4768-7677',
  'contacto@systelec.com.ar',
  'www.systelec.com.ar',
  '1996-08-02'::DATE,
  '91',
  true
WHERE NOT EXISTS (SELECT 1 FROM empresas_emisoras WHERE cuit = '30-68479873-8');

INSERT INTO empresas_emisoras (
  nombre, razon_social, cuit, ing_brutos, domicilio, localidad,
  telefono, fax, email, web, fecha_inicio_actividades, codigo_documento, activo
)
SELECT
  'PX Control',
  'PX Control S.A.',
  '30-00000000-0',
  '000-00000000-0',
  '26 de Julio 5450',
  'Villa Ballester, Buenos Aires',
  '(011) 0000-0000',
  '',
  'info@pxcontrol.com.ar',
  'www.pxcontrol.com.ar',
  '2020-01-01'::DATE,
  '91',
  true
WHERE NOT EXISTS (SELECT 1 FROM empresas_emisoras WHERE nombre = 'PX Control');

INSERT INTO empresas_emisoras (
  nombre, razon_social, cuit, ing_brutos, domicilio, localidad,
  telefono, fax, email, web, fecha_inicio_actividades, codigo_documento, activo
)
SELECT
  'Talemec',
  'Talemec S.A.',
  '30-00000001-1',
  '000-00000001-1',
  'Domicilio a completar',
  'Buenos Aires',
  '(011) 0000-0001',
  '',
  'info@talemec.com.ar',
  'www.talemec.com.ar',
  '2020-01-01'::DATE,
  '91',
  true
WHERE NOT EXISTS (SELECT 1 FROM empresas_emisoras WHERE nombre = 'Talemec');
