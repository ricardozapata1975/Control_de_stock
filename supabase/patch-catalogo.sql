-- Catálogo persistente de almacenes y armarios
-- Sobrevive redeploys en Render (filesystem efímero).
-- Ejecutar en SQL Editor de Supabase después de schema.sql / patch-almacen.sql

CREATE TABLE IF NOT EXISTS catalogo_almacenes (
  codigo TEXT PRIMARY KEY,
  tipo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  next_armario_num INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS catalogo_armarios (
  almacen_codigo TEXT NOT NULL REFERENCES catalogo_almacenes(codigo) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'armario',
  PRIMARY KEY (almacen_codigo, codigo)
);

CREATE INDEX IF NOT EXISTS idx_catalogo_armarios_almacen ON catalogo_armarios(almacen_codigo);

CREATE TABLE IF NOT EXISTS catalogo_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

-- Seed inicial ALM01 (solo si las tablas están vacías)
INSERT INTO catalogo_almacenes (codigo, tipo, nombre, next_armario_num)
SELECT 'ALM01', 'Oficina', 'Oficina principal', 3
WHERE NOT EXISTS (SELECT 1 FROM catalogo_almacenes);

INSERT INTO catalogo_armarios (almacen_codigo, codigo, nombre, tipo)
SELECT v.almacen_codigo, v.codigo, v.nombre, v.tipo
FROM (VALUES
  ('ALM01', 'A00', 'Armario Papelería', 'armario'),
  ('ALM01', 'A01', 'Armario Herramientas', 'armario'),
  ('ALM01', 'A02', 'Armario Electrónica', 'armario')
) AS v(almacen_codigo, codigo, nombre, tipo)
WHERE EXISTS (SELECT 1 FROM catalogo_almacenes WHERE codigo = 'ALM01')
  AND NOT EXISTS (SELECT 1 FROM catalogo_armarios WHERE almacen_codigo = 'ALM01' AND codigo = v.codigo);

INSERT INTO catalogo_config (key, value)
SELECT v.key, v.value::jsonb
FROM (VALUES
  ('nextAlmacenNum', '2'),
  ('estanteMin', '1'),
  ('estanteMax', '9'),
  ('contenedorReglas', '{"C":{"min":1,"max":99},"B":{"min":0,"max":99},"H":{"min":1,"max":99}}'),
  ('contenedorEspecial', '"SC"')
) AS v(key, value)
WHERE NOT EXISTS (SELECT 1 FROM catalogo_config);

-- Recuperar ALM02 u otros almacenes que ya existan en contenedores pero no en catálogo
INSERT INTO catalogo_almacenes (codigo, tipo, nombre, next_armario_num)
SELECT DISTINCT
  CASE
    WHEN c.almacen ~ '^ALM\d+$' THEN 'ALM' || lpad(regexp_replace(c.almacen, '\D', '', 'g'), 2, '0')
    ELSE upper(trim(c.almacen))
  END AS codigo,
  'Almacén',
  'Almacén ' || CASE
    WHEN c.almacen ~ '^ALM\d+$' THEN 'ALM' || lpad(regexp_replace(c.almacen, '\D', '', 'g'), 2, '0')
    ELSE upper(trim(c.almacen))
  END || ' (recuperado)',
  0
FROM contenedores c
WHERE c.almacen IS NOT NULL
  AND trim(c.almacen) <> ''
  AND c.almacen ~ '^ALM\d+$'
  AND NOT EXISTS (
    SELECT 1 FROM catalogo_almacenes ca
    WHERE ca.codigo = 'ALM' || lpad(regexp_replace(c.almacen, '\D', '', 'g'), 2, '0')
  );

INSERT INTO catalogo_armarios (almacen_codigo, codigo, nombre, tipo)
SELECT DISTINCT
  'ALM' || lpad(regexp_replace(c.almacen, '\D', '', 'g'), 2, '0'),
  upper(trim(c.armario)),
  coalesce(nullif(trim(c.ubicacion), ''), 'Armario ' || upper(trim(c.armario))),
  'armario'
FROM contenedores c
WHERE c.almacen IS NOT NULL
  AND c.armario IS NOT NULL
  AND trim(c.almacen) <> ''
  AND trim(c.armario) <> ''
  AND c.almacen ~ '^ALM\d+$'
  AND EXISTS (
    SELECT 1 FROM catalogo_almacenes ca
    WHERE ca.codigo = 'ALM' || lpad(regexp_replace(c.almacen, '\D', '', 'g'), 2, '0')
  )
  AND NOT EXISTS (
    SELECT 1 FROM catalogo_armarios ar
    WHERE ar.almacen_codigo = 'ALM' || lpad(regexp_replace(c.almacen, '\D', '', 'g'), 2, '0')
      AND ar.codigo = upper(trim(c.armario))
  );

-- Verificación
SELECT codigo, tipo, nombre, next_armario_num FROM catalogo_almacenes ORDER BY codigo;
SELECT almacen_codigo, codigo, nombre, tipo FROM catalogo_armarios ORDER BY almacen_codigo, codigo;
