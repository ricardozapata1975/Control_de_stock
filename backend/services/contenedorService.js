import { getSupabase } from '../db/supabase.js';
import * as demo from './demoService.js';
import { enrichContenedor, resolveUbicacion } from './ubicacionService.js';
import { mapUbicacionFields, parseCodigo } from './ubicacionUtils.js';

function mapInventarioRows(rows) {
  return (rows || []).map((r) => ({
    id: r.stock_id,
    stockId: r.stock_id,
    itemId: r.item_id,
    contenedorId: r.contenedor_id,
    contenedorCodigo: r.contenedor_codigo,
    ...mapUbicacionFields({
      codigo: r.contenedor_codigo,
      armario: r.armario,
      estante: r.estante,
      contenedor: r.contenedor,
      ubicacion: r.ubicacion,
    }),
    nombre: r.nombre,
    marca: r.marca,
    modelo: r.modelo,
    tipo: r.tipo,
    detalle: r.detalle,
    cantidad: r.cantidad,
    codigo: r.contenedor_codigo,
  }));
}

export async function getByCodigo(codigo) {
  if (demo.isDemoMode()) return demo.demoGetContenedor(codigo);

  const supabase = getSupabase();
  const parsed = parseCodigo(codigo);
  const normalized = parsed?.codigo || String(codigo || '').trim().toUpperCase();

  if (parsed?.armario && !parsed.estante) {
    const { data: rows, error: errI } = await supabase
      .from('v_inventario')
      .select('*')
      .eq('armario', parsed.armario);
    if (errI) throw Object.assign(new Error(errI.message), { status: 500 });
    const items = mapInventarioRows(rows);
    const cont = enrichContenedor({
      id: `arm-${parsed.armario}`,
      codigo: parsed.armario,
      armario: parsed.armario,
      estante: null,
      contenedor: null,
      ubicacion: parsed.armario,
    });
    return {
      contenedor: {
        ...cont,
        itemCount: items.length,
        totalStock: items.reduce((s, i) => s + i.cantidad, 0),
      },
      items,
      total: items.length,
    };
  }

  let cont;
  const { data: found, error: errC } = await supabase
    .from('contenedores')
    .select('*')
    .eq('codigo', normalized)
    .maybeSingle();

  if (errC) throw Object.assign(new Error(errC.message), { status: 500 });
  if (found) cont = found;
  else if (parsed) cont = await resolveUbicacion({ codigo: normalized });
  if (!cont) throw Object.assign(new Error('Ubicación no encontrada'), { status: 404 });

  let query = supabase.from('v_inventario').select('*');
  if (parsed?.estante && !parsed.contenedor) {
    query = query.eq('armario', parsed.armario).eq('estante', parsed.estante);
  } else {
    query = query.eq('contenedor_id', cont.id);
  }
  const { data: rows, error: errI } = await query;

  if (errI) throw Object.assign(new Error(errI.message), { status: 500 });

  const items = mapInventarioRows(rows);

  return {
    contenedor: {
      ...enrichContenedor(cont),
      itemCount: items.length,
      totalStock: items.reduce((s, i) => s + i.cantidad, 0),
    },
    items,
    total: items.length,
  };
}

export async function listContenedores() {
  if (demo.isDemoMode()) {
    const contenedores = await demo.demoListContenedores();
    return contenedores;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.from('contenedores').select('*').order('codigo');
  if (error) throw Object.assign(new Error(error.message), { status: 500 });

  const { data: stocks } = await supabase.from('v_inventario').select('contenedor_id, cantidad');

  return (data || []).map((c) => {
    const related = (stocks || []).filter((s) => s.contenedor_id === c.id);
    return {
      ...enrichContenedor(c),
      itemCount: related.length,
      totalStock: related.reduce((sum, s) => sum + s.cantidad, 0),
    };
  });
}
