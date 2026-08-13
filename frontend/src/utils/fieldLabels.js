/**
 * Etiquetas de campos alineadas al nombre de columna en DB.
 * Regla: misma clave en toda la app; al mostrar se formatea quitando _ y -
 * y capitalizando cada palabra (solo letras/números/espacios).
 *
 * Uso: fieldLabel('codigoFabricante') → "Codigo fabricante"
 *      fieldLabel('fecha_relevamiento') → "Fecha relevamiento"
 */

/** camelCase / alias frontend → columna snake_case en DB (o clave canónica). */
const FIELD_TO_DB = {
  // items
  id: 'id',
  itemId: 'item_id',
  nombre: 'nombre',
  marca: 'marca',
  modelo: 'modelo',
  tipo: 'tipo',
  detalle: 'detalle',
  calibracion: 'calibracion',
  comentario: 'comentario',
  fechaRelevamiento: 'fecha_relevamiento',
  fecha_relevamiento: 'fecha_relevamiento',
  codigoFabricante: 'codigo_fabricante',
  codigo_fabricante: 'codigo_fabricante',
  unidad: 'unidad',
  packing: 'packing',
  precioLista: 'precio_lista',
  precio_lista: 'precio_lista',
  moneda: 'moneda',
  pesoKg: 'peso_kg',
  peso_kg: 'peso_kg',
  familia: 'familia',
  subfamilia: 'subfamilia',
  tema: 'tema',
  catalogoFuente: 'catalogo_fuente',
  catalogo_fuente: 'catalogo_fuente',
  catalogoVigencia: 'catalogo_vigencia',
  catalogo_vigencia: 'catalogo_vigencia',
  imagenPath: 'imagen_path',
  imagen_path: 'imagen_path',
  activo: 'activo',

  // stock / vista
  stockId: 'stock_id',
  cantidad: 'cantidad',
  stock: 'cantidad',

  // contenedores / ubicación
  contenedorId: 'contenedor_id',
  contenedorCodigo: 'contenedor_codigo',
  codigo: 'codigo',
  almacen: 'almacen',
  armario: 'armario',
  estante: 'estante',
  contenedor: 'contenedor',
  ubicacion: 'ubicacion',
  sede: 'sede',

  // movimientos
  usuario: 'usuario',

  // agregados UI (no columna única; misma regla de formato)
  ubicaciones: 'ubicaciones',
  fisico: 'fisico',
  reservado: 'reservado',
  neto: 'neto',
};

/**
 * Normaliza cualquier clave (camelCase, snake_case, con guiones) a snake_case canónico.
 */
export function toDbColumn(field) {
  const raw = String(field || '').trim();
  if (!raw) return '';
  if (FIELD_TO_DB[raw]) return FIELD_TO_DB[raw];
  if (raw.includes('_') || raw.includes('-')) {
    return raw.replace(/-/g, '_').toLowerCase();
  }
  // camelCase → snake_case
  return raw
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

/**
 * Formato visible: solo letras, números y espacios (sin _ ni -).
 * codigo_fabricante → "Codigo fabricante"
 */
export function formatDbColumnLabel(dbColumn) {
  const col = String(dbColumn || '').trim();
  if (!col) return '';
  const words = col
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Etiqueta de campo para formularios / tablas / popups.
 * @param {string} field - clave frontend o columna DB
 * @param {{ required?: boolean }} [opts]
 */
export function fieldLabel(field, opts = {}) {
  const label = formatDbColumnLabel(toDbColumn(field));
  if (opts.required && label) return `${label} *`;
  return label;
}

/** Atajo: mapa de varias claves → etiquetas */
export function fieldLabels(...fields) {
  return Object.fromEntries(fields.map((f) => [f, fieldLabel(f)]));
}
