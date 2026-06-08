-- Datos demo (ejecutar después de schema.sql)

INSERT INTO contenedores (codigo, armario, estante, contenedor, ubicacion) VALUES
  ('A01-E01-C01', 'A01', 'E01', 'C01', 'Armario Herramientas'),
  ('A01-E02-C03', 'A01', 'E02', 'C03', 'Armario Herramientas'),
  ('A02-E01-C02', 'A02', 'E01', 'C02', 'Armario Electrónica'),
  ('A00-E03', 'A00', 'E03', NULL, 'Armario Papelería')
ON CONFLICT (codigo) DO UPDATE SET
  armario = EXCLUDED.armario,
  estante = EXCLUDED.estante,
  contenedor = EXCLUDED.contenedor,
  ubicacion = EXCLUDED.ubicacion;

INSERT INTO items (nombre, marca, modelo, tipo, detalle)
SELECT v.nombre, v.marca, v.modelo, v.tipo, v.detalle
FROM (VALUES
  ('Llave allen 10mm', 'Stanley', 'SA10', 'Herramienta', 'Juego métrico'),
  ('Multímetro digital', 'Fluke', '115', 'Medición', 'Uso eléctrico'),
  ('Taladro percutor', 'Bosch', 'GSB 13', 'Eléctrica', '220V')
) AS v(nombre, marca, modelo, tipo, detalle)
WHERE NOT EXISTS (SELECT 1 FROM items i WHERE i.nombre = v.nombre);

INSERT INTO stock (item_id, contenedor_id, cantidad)
SELECT i.id, c.id, v.cantidad
FROM (VALUES
  ('Llave allen 10mm', 'A01-E01-C01', 8),
  ('Multímetro digital', 'A01-E02-C03', 2),
  ('Taladro percutor', 'A02-E01-C02', 1)
) AS v(nombre, codigo, cantidad)
JOIN items i ON i.nombre = v.nombre
JOIN contenedores c ON c.codigo = v.codigo
ON CONFLICT (item_id, contenedor_id) DO UPDATE SET cantidad = EXCLUDED.cantidad;
