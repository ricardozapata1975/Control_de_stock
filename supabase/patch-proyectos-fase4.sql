-- Fase 4 Proyectos: tránsito, recepción ítem a ítem, remitos pendientes de cierre
-- Ejecutar DESPUÉS de patch-remitos-transferencia.sql y patches de proyectos 1–3.
-- No rompe recepción completa existente; permite estado parcial y cantidad_recibida.

ALTER TABLE remito_items
  ADD COLUMN IF NOT EXISTS cantidad_recibida NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE remitos
  ADD COLUMN IF NOT EXISTS recepcion_informe JSONB,
  ADD COLUMN IF NOT EXISTS recepcion_abierta_at TIMESTAMPTZ;

-- Estados válidos de remito de transferencia ahora incluyen 'parcial'
COMMENT ON COLUMN remitos.estado IS 'confirmado | en_transito | parcial | recibido';

CREATE TABLE IF NOT EXISTS remito_recepcion_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  remito_id UUID NOT NULL REFERENCES remitos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  remito_item_id UUID REFERENCES remito_items(id) ON DELETE SET NULL,
  item_id UUID REFERENCES items(id) ON DELETE SET NULL,
  codigo TEXT,
  cantidad NUMERIC,
  notas TEXT,
  usuario TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_remito_recepcion_eventos_remito
  ON remito_recepcion_eventos(remito_id, created_at DESC);

COMMENT ON COLUMN remito_items.cantidad_recibida IS 'Cantidad ya validada en recepción ítem a ítem';
COMMENT ON TABLE remito_recepcion_eventos IS 'Trazabilidad de recepción parcial de transferencias';

-- Permitir recibir remanente cuando el remito está parcial
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
  v_pendiente NUMERIC;
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

  IF v_remito.estado NOT IN ('en_transito', 'parcial') THEN
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
    v_pendiente := GREATEST(0, coalesce(v_ri.cantidad, 0) - coalesce(v_ri.cantidad_recibida, 0));
    IF v_pendiente <= 0 THEN
      CONTINUE;
    END IF;

    SELECT * INTO v_mov_egreso
    FROM movimientos
    WHERE remito_id = p_remito_id
      AND item_id = v_ri.item_id
      AND contenedor_id = v_ri.contenedor_id
      AND tipo = 'egreso'
      AND estado = 'en_transito'
    FOR UPDATE;

    IF NOT FOUND THEN
      -- Ya transferido parcialmente vía ítem a ítem: seguir con upsert de remanente
      NULL;
    ELSE
      UPDATE movimientos
      SET estado = 'transferido',
          motivo = coalesce(motivo, 'Transferencia entre almacenes') || ' — recibido'
      WHERE id = v_mov_egreso.id;
    END IF;

    INSERT INTO stock (item_id, contenedor_id, cantidad)
    VALUES (v_ri.item_id, v_cont_dest_id, v_pendiente)
    ON CONFLICT (item_id, contenedor_id)
    DO UPDATE SET cantidad = stock.cantidad + EXCLUDED.cantidad, updated_at = now()
    RETURNING id INTO v_stock_id;

    INSERT INTO movimientos (
      item_id, contenedor_id, tipo, cantidad, usuario, sync_status,
      estado, motivo, remito_id, egreso_movimiento_id
    )
    VALUES (
      v_ri.item_id, v_cont_dest_id, 'ingreso', v_pendiente,
      coalesce(nullif(trim(p_recibido_por), ''), 'Sistema'), 'synced',
      'transferido', 'Transferencia recibida', p_remito_id,
      CASE WHEN v_mov_egreso.id IS NOT NULL THEN v_mov_egreso.id ELSE NULL END
    )
    RETURNING id INTO v_mov_ingreso_id;

    UPDATE remito_items
    SET cantidad_recibida = coalesce(cantidad, 0)
    WHERE id = v_ri.id;

    v_items_procesados := v_items_procesados + 1;
  END LOOP;

  UPDATE remitos SET
    estado = 'recibido',
    recibido_por = coalesce(nullif(trim(p_recibido_por), ''), 'Sistema'),
    recibido_at = now(),
    ubicacion_destino = jsonb_build_object(
      'sede', v_ubi->>'sede',
      'almacen', v_almacen,
      'armario', v_armario,
      'estante', v_estante,
      'contenedor', v_contenedor,
      'cede', v_ubi->>'cede'
    ),
    recepcion_informe = coalesce(recepcion_informe, '{}'::jsonb) || jsonb_build_object(
      'cierre', 'completo',
      'cerrado_at', now(),
      'items_procesados', v_items_procesados
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
