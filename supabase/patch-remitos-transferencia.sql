-- Parche: remitos de transferencia entre almacenes
-- Ejecutar en Supabase SQL Editor después de patch-remitos.sql

-- ─── Campos adicionales en remitos ───────────────────────────────────────────

ALTER TABLE remitos ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'venta';
ALTER TABLE remitos ADD COLUMN IF NOT EXISTS almacen_origen TEXT;
ALTER TABLE remitos ADD COLUMN IF NOT EXISTS almacen_destino TEXT;
ALTER TABLE remitos ADD COLUMN IF NOT EXISTS ubicacion_destino JSONB;
ALTER TABLE remitos ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'confirmado';
ALTER TABLE remitos ADD COLUMN IF NOT EXISTS recibido_por TEXT;
ALTER TABLE remitos ADD COLUMN IF NOT EXISTS recibido_at TIMESTAMPTZ;

-- Transferencias no requieren cliente externo obligatorio
ALTER TABLE remitos ALTER COLUMN cliente_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_remitos_tipo_estado ON remitos(tipo, estado);
CREATE INDEX IF NOT EXISTS idx_remitos_almacen_destino ON remitos(almacen_destino) WHERE almacen_destino IS NOT NULL;

-- ─── Vista egresos pendientes (excluye vendidos, consumidos y en tránsito) ───

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

-- ─── Resolver contenedor por ubicación (crea si no existe) ───────────────────

CREATE OR REPLACE FUNCTION resolver_contenedor_ubicacion(
  p_almacen TEXT,
  p_armario TEXT,
  p_estante TEXT,
  p_contenedor TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_almacen TEXT;
  v_armario TEXT;
  v_estante TEXT;
  v_contenedor TEXT;
  v_codigo TEXT;
  v_cont_id UUID;
BEGIN
  v_almacen := upper(trim(coalesce(p_almacen, 'ALM01')));
  v_armario := upper(trim(p_armario));
  v_estante := upper(trim(p_estante));
  v_contenedor := nullif(upper(trim(coalesce(p_contenedor, ''))), '');

  IF v_armario IS NULL OR v_armario = '' OR v_estante IS NULL OR v_estante = '' THEN
    RAISE EXCEPTION 'Armario y estante son obligatorios para la ubicación destino';
  END IF;

  IF v_contenedor IS NOT NULL THEN
    IF v_almacen = 'ALM01' THEN
      v_codigo := v_armario || '-' || v_estante || '-' || v_contenedor;
    ELSE
      v_codigo := v_almacen || '-' || v_armario || '-' || v_estante || '-' || v_contenedor;
    END IF;
  ELSE
    IF v_almacen = 'ALM01' THEN
      v_codigo := v_armario || '-' || v_estante;
    ELSE
      v_codigo := v_almacen || '-' || v_armario || '-' || v_estante;
    END IF;
  END IF;

  SELECT id INTO v_cont_id
  FROM contenedores
  WHERE codigo = v_codigo
  LIMIT 1;

  IF v_cont_id IS NOT NULL THEN
    RETURN v_cont_id;
  END IF;

  INSERT INTO contenedores (codigo, almacen, armario, estante, contenedor, ubicacion)
  VALUES (
    v_codigo,
    v_almacen,
    v_armario,
    v_estante,
    v_contenedor,
    v_armario
  )
  RETURNING id INTO v_cont_id;

  RETURN v_cont_id;
END;
$$;

-- ─── Crear remito (venta o transferencia) ────────────────────────────────────

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
  p_items JSONB,
  p_tipo TEXT DEFAULT 'venta',
  p_almacen_origen TEXT DEFAULT NULL,
  p_almacen_destino TEXT DEFAULT NULL,
  p_ubicacion_destino JSONB DEFAULT NULL
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
  v_tipo TEXT;
  v_estado_remito TEXT;
  v_estado_mov TEXT;
  v_motivo TEXT;
BEGIN
  v_tipo := lower(coalesce(nullif(trim(p_tipo), ''), 'venta'));

  IF v_tipo NOT IN ('venta', 'transferencia') THEN
    RAISE EXCEPTION 'Tipo de remito inválido: %', p_tipo;
  END IF;

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

  IF v_tipo = 'transferencia' THEN
    IF nullif(trim(p_almacen_origen), '') IS NULL OR nullif(trim(p_almacen_destino), '') IS NULL THEN
      RAISE EXCEPTION 'Almacén origen y destino son obligatorios para transferencias';
    END IF;
    IF upper(trim(p_almacen_origen)) = upper(trim(p_almacen_destino)) THEN
      RAISE EXCEPTION 'El almacén destino debe ser distinto del origen';
    END IF;
    v_estado_remito := 'en_transito';
    v_estado_mov := 'en_transito';
    v_motivo := 'Transferencia entre almacenes';
  ELSE
    v_estado_remito := 'confirmado';
    v_estado_mov := 'vendido';
    v_motivo := 'Vendido a cliente';
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
      RAISE EXCEPTION 'Nombre del destinatario requerido';
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
    aclaracion, dni, created_by,
    tipo, almacen_origen, almacen_destino, ubicacion_destino, estado
  )
  VALUES (
    p_numero, p_fecha, p_empresa_emisora_id, v_cliente_id,
    p_cant_bultos, p_transportista, p_transportista_cuit, p_transportista_domicilio,
    p_aclaracion, p_dni, p_created_by,
    v_tipo, nullif(trim(p_almacen_origen), ''), nullif(trim(p_almacen_destino), ''),
    p_ubicacion_destino, v_estado_remito
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
      v_estado_mov, v_motivo, v_remito_id
    )
    RETURNING id INTO v_mov_id;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'remito_id', v_remito_id,
    'numero', p_numero,
    'cliente_id', v_cliente_id,
    'tipo', v_tipo,
    'estado', v_estado_remito
  );
END;
$$;

-- ─── Recibir transferencia (ratificar en almacén destino) ────────────────────

CREATE OR REPLACE FUNCTION recibir_transferencia(
  p_remito_id UUID,
  p_recibido_por TEXT,
  p_ubicacion_destino JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_remito remitos%ROWTYPE;
  v_ubi JSONB;
  v_almacen TEXT;
  v_armario TEXT;
  v_estante TEXT;
  v_contenedor TEXT;
  v_cont_dest_id UUID;
  v_ri RECORD;
  v_mov_egreso RECORD;
  v_mov_ingreso_id UUID;
  v_stock_id UUID;
  v_items_procesados INTEGER := 0;
BEGIN
  SELECT * INTO v_remito
  FROM remitos
  WHERE id = p_remito_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Remito no encontrado';
  END IF;

  IF v_remito.tipo <> 'transferencia' THEN
    RAISE EXCEPTION 'El remito no es una transferencia';
  END IF;

  IF v_remito.estado <> 'en_transito' THEN
    RAISE EXCEPTION 'La transferencia ya fue recibida o no está en tránsito';
  END IF;

  v_ubi := coalesce(p_ubicacion_destino, v_remito.ubicacion_destino);
  IF v_ubi IS NULL THEN
    RAISE EXCEPTION 'Ubicación destino requerida para recibir la transferencia';
  END IF;

  v_almacen := coalesce(nullif(v_ubi->>'almacen', ''), v_remito.almacen_destino, 'ALM01');
  v_armario := nullif(trim(v_ubi->>'armario'), '');
  v_estante := nullif(trim(v_ubi->>'estante'), '');
  v_contenedor := nullif(trim(v_ubi->>'contenedor'), '');

  IF v_armario IS NULL OR v_estante IS NULL THEN
    RAISE EXCEPTION 'Armario y estante destino son obligatorios';
  END IF;

  v_cont_dest_id := resolver_contenedor_ubicacion(v_almacen, v_armario, v_estante, v_contenedor);

  FOR v_ri IN
    SELECT * FROM remito_items WHERE remito_id = p_remito_id
  LOOP
    SELECT * INTO v_mov_egreso
    FROM movimientos
    WHERE remito_id = p_remito_id
      AND item_id = v_ri.item_id
      AND contenedor_id = v_ri.contenedor_id
      AND tipo = 'egreso'
      AND estado = 'en_transito'
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Movimiento en tránsito no encontrado para ítem %', v_ri.item_id;
    END IF;

    INSERT INTO stock (item_id, contenedor_id, cantidad)
    VALUES (v_ri.item_id, v_cont_dest_id, v_ri.cantidad)
    ON CONFLICT (item_id, contenedor_id)
    DO UPDATE SET cantidad = stock.cantidad + EXCLUDED.cantidad, updated_at = now()
    RETURNING id INTO v_stock_id;

    UPDATE movimientos
    SET estado = 'transferido',
        motivo = coalesce(motivo, 'Transferencia entre almacenes') || ' — recibido'
    WHERE id = v_mov_egreso.id;

    INSERT INTO movimientos (
      item_id, contenedor_id, tipo, cantidad, usuario, sync_status,
      estado, motivo, remito_id, egreso_movimiento_id
    )
    VALUES (
      v_ri.item_id, v_cont_dest_id, 'ingreso', v_ri.cantidad,
      coalesce(nullif(trim(p_recibido_por), ''), 'Sistema'), 'synced',
      'transferido', 'Transferencia recibida', p_remito_id, v_mov_egreso.id
    )
    RETURNING id INTO v_mov_ingreso_id;

    v_items_procesados := v_items_procesados + 1;
  END LOOP;

  UPDATE remitos SET
    estado = 'recibido',
    recibido_por = coalesce(nullif(trim(p_recibido_por), ''), 'Sistema'),
    recibido_at = now(),
    ubicacion_destino = jsonb_build_object(
      'almacen', v_almacen,
      'armario', v_armario,
      'estante', v_estante,
      'contenedor', v_contenedor
    )
  WHERE id = p_remito_id;

  RETURN jsonb_build_object(
    'ok', true,
    'remito_id', p_remito_id,
    'items_procesados', v_items_procesados,
    'contenedor_destino_id', v_cont_dest_id
  );
END;
$$;
