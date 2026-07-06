-- Sedes (ubicaciones físicas / oficinas) — nivel superior al almacén
-- Ejecutar en SQL Editor de Supabase después de patch-catalogo.sql

CREATE TABLE IF NOT EXISTS catalogo_sedes (
  codigo TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  aduana JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE catalogo_sedes ADD COLUMN IF NOT EXISTS aduana JSONB;

ALTER TABLE catalogo_almacenes
  ADD COLUMN IF NOT EXISTS sede_codigo TEXT REFERENCES catalogo_sedes(codigo) DEFAULT 'SED001';

ALTER TABLE contenedores
  ADD COLUMN IF NOT EXISTS sede TEXT NOT NULL DEFAULT 'SED001';

CREATE INDEX IF NOT EXISTS idx_contenedores_sede ON contenedores(sede);
CREATE INDEX IF NOT EXISTS idx_catalogo_almacenes_sede ON catalogo_almacenes(sede_codigo);

INSERT INTO catalogo_sedes (codigo, nombre)
SELECT 'SED001', 'Oficina Ballester'
WHERE NOT EXISTS (SELECT 1 FROM catalogo_sedes WHERE codigo = 'SED001');

UPDATE catalogo_sedes SET nombre = 'Oficina Ballester' WHERE codigo = 'SED001';

UPDATE catalogo_almacenes SET sede_codigo = 'SED001' WHERE sede_codigo IS NULL;
UPDATE contenedores SET sede = 'SED001' WHERE sede IS NULL OR trim(sede) = '';

-- Resolver contenedor con sede en el código completo
CREATE OR REPLACE FUNCTION resolver_contenedor_ubicacion(
  p_sede TEXT DEFAULT 'SED001',
  p_almacen TEXT,
  p_armario TEXT,
  p_estante TEXT,
  p_contenedor TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_sede TEXT;
  v_almacen TEXT;
  v_armario TEXT;
  v_estante TEXT;
  v_contenedor TEXT;
  v_codigo TEXT;
  v_cont_id UUID;
BEGIN
  v_sede := upper(trim(coalesce(nullif(p_sede, ''), 'SED001')));
  v_almacen := upper(trim(coalesce(p_almacen, 'ALM01')));
  v_armario := upper(trim(p_armario));
  v_estante := upper(trim(p_estante));
  v_contenedor := nullif(upper(trim(coalesce(p_contenedor, ''))), '');

  IF v_armario IS NULL OR v_armario = '' OR v_estante IS NULL OR v_estante = '' THEN
    RAISE EXCEPTION 'Armario y estante son obligatorios para la ubicación destino';
  END IF;

  IF v_contenedor IS NOT NULL THEN
    v_codigo := v_sede || '-' || v_almacen || '-' || v_armario || '-' || v_estante || '-' || v_contenedor;
  ELSE
    v_codigo := v_sede || '-' || v_almacen || '-' || v_armario || '-' || v_estante;
  END IF;

  SELECT id INTO v_cont_id FROM contenedores WHERE codigo = v_codigo LIMIT 1;

  IF v_cont_id IS NOT NULL THEN
    RETURN v_cont_id;
  END IF;

  INSERT INTO contenedores (codigo, sede, almacen, armario, estante, contenedor, ubicacion)
  VALUES (
    v_codigo,
    v_sede,
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
