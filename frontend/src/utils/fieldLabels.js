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
  mensaje: 'mensaje',

  // remitos / clientes / empresas
  numero: 'numero',
  fecha: 'fecha',
  tipoRemito: 'tipo',
  razonSocial: 'razon_social',
  razon_social: 'razon_social',
  iva: 'iva',
  domicilio: 'domicilio',
  localidad: 'localidad',
  vRef: 'v_ref',
  v_ref: 'v_ref',
  cuit: 'cuit',
  cantBultos: 'cant_bultos',
  cant_bultos: 'cant_bultos',
  bultos: 'cant_bultos',
  transportista: 'transportista',
  transportistaCuit: 'transportista_cuit',
  cuitTransportista: 'transportista_cuit',
  transportista_cuit: 'transportista_cuit',
  transportistaDomicilio: 'transportista_domicilio',
  domicilioTransportista: 'transportista_domicilio',
  transportista_domicilio: 'transportista_domicilio',
  aclaracion: 'aclaracion',
  dni: 'dni',
  descripcion: 'descripcion',
  almacenOrigen: 'almacen_origen',
  almacen_origen: 'almacen_origen',
  almacenDestino: 'almacen_destino',
  almacen_destino: 'almacen_destino',
  ubicacionDestino: 'ubicacion_destino',
  ubicacion_destino: 'ubicacion_destino',
  estado: 'estado',
  recibidoPor: 'recibido_por',
  recibido_por: 'recibido_por',

  // locaciones
  visibleOtrasSedes: 'visible_otras_sedes',
  visible_otras_sedes: 'visible_otras_sedes',

  // agenda / proveedores / oficinas
  rubro: 'rubro',
  contacto: 'contacto',
  telefono: 'telefono',
  email: 'email',
  web: 'web',
  notas: 'notas',
  fax: 'fax',
  ingBrutos: 'ing_brutos',
  ing_brutos: 'ing_brutos',
  fechaInicioActividades: 'fecha_inicio_actividades',
  fecha_inicio_actividades: 'fecha_inicio_actividades',
  codigoDocumento: 'codigo_documento',
  codigo_documento: 'codigo_documento',
  sedeCodigo: 'sede_codigo',
  sede_codigo: 'sede_codigo',
  logoUrl: 'logo_url',
  logo_url: 'logo_url',
  logo: 'logo_url',
  firmaUrl: 'firma_url',
  firma_url: 'firma_url',
  firma: 'firma_url',

  // usuarios
  username: 'username',
  displayName: 'display_name',
  display_name: 'display_name',
  role: 'role',
  isActive: 'is_active',
  is_active: 'is_active',
  sedesHabilitadas: 'sedes_habilitadas',
  sedes_habilitadas: 'sedes_habilitadas',
  mustChangePassword: 'must_change_password',
  must_change_password: 'must_change_password',
  password: 'password',
  confirmPassword: 'confirm_password',

  // roles
  permisos: 'permisos',

  // proyectos
  proyecto: 'proyecto',
  tablero: 'tablero',
  reserva: 'reserva',
  prioridad: 'prioridad',
  fechaObjetivo: 'fecha_objetivo',
  fecha_objetivo: 'fecha_objetivo',
  fechaInicio: 'fecha_inicio',
  fecha_inicio: 'fecha_inicio',
  fechaLimite: 'fecha_limite',
  fecha_limite: 'fecha_limite',
  responsable: 'responsable',
  codigoArticulo: 'codigo_articulo',
  codigo_articulo: 'codigo_articulo',
  cantidadRequerida: 'cantidad_requerida',
  cantidad_requerida: 'cantidad_requerida',
  cantidadReservada: 'cantidad_reservada',
  cantidad_reservada: 'cantidad_reservada',
  cantidadFaltante: 'cantidad_faltante',
  cantidad_faltante: 'cantidad_faltante',
  cantidadEntregada: 'cantidad_entregada',
  cantidad_entregada: 'cantidad_entregada',
  cantidadConsumida: 'cantidad_consumida',
  cantidad_consumida: 'cantidad_consumida',
  cantidadCubierta: 'cantidad_cubierta',
  cantidad_cubierta: 'cantidad_cubierta',
  operario: 'operario',
  caja: 'caja',
  motivo: 'motivo',
  documento: 'documento',
  proveedor: 'proveedor',
  desde: 'desde',
  hasta: 'hasta',
  faltante: 'faltante',
  pendiente: 'pendiente',
  cantidadPendiente: 'cantidad_pendiente',
  cantidad_pendiente: 'cantidad_pendiente',
  cantidadRecibida: 'cantidad_recibida',
  cantidad_recibida: 'cantidad_recibida',
  costo: 'costo',

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
