-- Parche opcional: FKs en movimientos para que PostgREST pueda hacer embed joins.
-- Ejecutar en SQL Editor si querés alinear el esquema con schema.sql.
-- El backend ya funciona sin esto (consultas manuales por item_id/contenedor_id).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'movimientos_item_id_fkey'
  ) THEN
    ALTER TABLE movimientos
      ADD CONSTRAINT movimientos_item_id_fkey
      FOREIGN KEY (item_id) REFERENCES items(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'movimientos_contenedor_id_fkey'
  ) THEN
    ALTER TABLE movimientos
      ADD CONSTRAINT movimientos_contenedor_id_fkey
      FOREIGN KEY (contenedor_id) REFERENCES contenedores(id);
  END IF;
END $$;
