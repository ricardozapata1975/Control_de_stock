#!/usr/bin/env node
/**
 * Borra el stock de un almacén (p. ej. tras una importación SISCOM fallida/parcial)
 * para poder reimportar desde cero sin sumar cantidades.
 *
 * Uso (dry-run por defecto):
 *   node backend/scripts/purge-almacen-stock.js --almacen ALM16
 *   node backend/scripts/purge-almacen-stock.js --almacen ALM16 --apply
 *
 * Opciones:
 *   --almacen ALM16              Obligatorio
 *   --apply                      Ejecuta el borrado (sin esto solo informa)
 *   --siscom-only                Solo filas de ítems con comentario SISCOM
 *   --deactivate-orphan-items    Marca activo=false en ítems que queden sin stock
 *   --delete-empty-contenedores  Borra contenedores del almacén que queden vacíos
 *
 * Requiere SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY en backend/.env
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

const { assertConfig } = await import('../config.js');
const { getSupabase } = await import('../db/supabase.js');

const PAGE = 1000;
const BATCH = 150;

function parseArgs(argv) {
  const args = {
    almacen: '',
    apply: false,
    siscomOnly: false,
    deactivateOrphanItems: false,
    deleteEmptyContenedores: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--apply') args.apply = true;
    else if (a === '--siscom-only') args.siscomOnly = true;
    else if (a === '--deactivate-orphan-items') args.deactivateOrphanItems = true;
    else if (a === '--delete-empty-contenedores') args.deleteEmptyContenedores = true;
    else if (a === '--almacen') args.almacen = argv[++i] || '';
  }
  return args;
}

function canonicalAlmacen(raw) {
  const s = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  const m = s.match(/^ALM(\d{1,2})$/);
  if (!m) throw new Error('Almacén inválido. Usá ALM16, ALM02…');
  return `ALM${String(parseInt(m[1], 10)).padStart(2, '0')}`;
}

async function fetchAll(supabase, table, select, applyFilters) {
  const rows = [];
  let from = 0;
  for (;;) {
    let q = supabase.from(table).select(select).range(from, from + PAGE - 1);
    q = applyFilters(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    const chunk = data || [];
    rows.push(...chunk);
    if (chunk.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

async function deleteByIds(supabase, table, ids) {
  let deleted = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    const slice = ids.slice(i, i + BATCH);
    const { error } = await supabase.from(table).delete().in('id', slice);
    if (error) throw new Error(`delete ${table}: ${error.message}`);
    deleted += slice.length;
  }
  return deleted;
}

function isSiscomItem(item) {
  const c = String(item?.comentario || '');
  return /dep[oó]sito\s*siscom|id\s*siscom|origen archivo/i.test(c);
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.almacen) {
    console.error(`Uso:
  node backend/scripts/purge-almacen-stock.js --almacen ALM16
  node backend/scripts/purge-almacen-stock.js --almacen ALM16 --apply
  node backend/scripts/purge-almacen-stock.js --almacen ALM16 --apply --siscom-only --deactivate-orphan-items --delete-empty-contenedores`);
    process.exit(1);
  }

  assertConfig();
  const alm = canonicalAlmacen(args.almacen);
  const supabase = getSupabase();

  console.log(`\nAlmacén: ${alm}`);
  console.log(`Modo: ${args.apply ? 'APPLY (borra de verdad)' : 'DRY-RUN (solo informa)'}`);
  if (args.siscomOnly) console.log('Filtro: solo ítems con comentario SISCOM');

  const contenedores = await fetchAll(supabase, 'contenedores', 'id, codigo, almacen, armario, estante', (q) =>
    q.eq('almacen', alm)
  );
  if (!contenedores.length) {
    console.log(`No hay contenedores en ${alm}. Nada que hacer.`);
    return;
  }
  console.log(`Contenedores en ${alm}: ${contenedores.length}`);

  const contIds = contenedores.map((c) => c.id);
  const stockRows = [];
  for (let i = 0; i < contIds.length; i += BATCH) {
    const slice = contIds.slice(i, i + BATCH);
    const chunk = await fetchAll(
      supabase,
      'stock',
      'id, item_id, contenedor_id, cantidad',
      (q) => q.in('contenedor_id', slice)
    );
    stockRows.push(...chunk);
  }
  console.log(`Filas de stock en esos contenedores: ${stockRows.length}`);

  let targetStock = stockRows;

  if (args.siscomOnly) {
    const itemIds = [...new Set(stockRows.map((s) => s.item_id).filter(Boolean))];
    const items = [];
    for (let i = 0; i < itemIds.length; i += BATCH) {
      const slice = itemIds.slice(i, i + BATCH);
      const chunk = await fetchAll(supabase, 'items', 'id, nombre, comentario, codigo_fabricante, activo', (q) =>
        q.in('id', slice)
      );
      items.push(...chunk);
    }
    const siscomItemIds = new Set(items.filter(isSiscomItem).map((it) => it.id));
    targetStock = stockRows.filter((s) => siscomItemIds.has(s.item_id));
    console.log(`Ítems SISCOM detectados: ${siscomItemIds.size}`);
    console.log(`Filas de stock a borrar (filtro SISCOM): ${targetStock.length}`);
  }

  const totalQty = targetStock.reduce((acc, s) => acc + Number(s.cantidad || 0), 0);
  const uniqueItems = new Set(targetStock.map((s) => s.item_id));
  console.log(`Cantidad total de unidades a borrar: ${totalQty}`);
  console.log(`Ítems afectados: ${uniqueItems.size}`);

  const sample = contenedores
    .slice(0, 8)
    .map((c) => c.codigo)
    .join(', ');
  console.log(`Ejemplos de contenedores: ${sample}${contenedores.length > 8 ? '…' : ''}`);

  if (!args.apply) {
    console.log('\nDry-run OK. Para borrar de verdad agregá --apply');
    console.log(
      `Ejemplo: node backend/scripts/purge-almacen-stock.js --almacen ${alm} --apply --deactivate-orphan-items --delete-empty-contenedores`
    );
    return;
  }

  if (!targetStock.length) {
    console.log('No hay stock que borrar.');
  } else {
    const deleted = await deleteByIds(
      supabase,
      'stock',
      targetStock.map((s) => s.id)
    );
    console.log(`Stock borrado: ${deleted} fila(s)`);
  }

  if (args.deactivateOrphanItems) {
    const candidateIds = [...uniqueItems];
    let deactivated = 0;
    for (let i = 0; i < candidateIds.length; i += BATCH) {
      const slice = candidateIds.slice(i, i + BATCH);
      const remaining = await fetchAll(supabase, 'stock', 'item_id', (q) => q.in('item_id', slice));
      const stillHave = new Set(remaining.map((r) => r.item_id));
      const orphans = slice.filter((id) => !stillHave.has(id));
      if (!orphans.length) continue;
      const { error } = await supabase.from('items').update({ activo: false }).in('id', orphans);
      if (error) throw new Error(`deactivate items: ${error.message}`);
      deactivated += orphans.length;
    }
    console.log(`Ítems desactivados (sin stock restante): ${deactivated}`);
  }

  if (args.deleteEmptyContenedores) {
    const still = await fetchAll(supabase, 'stock', 'contenedor_id', (q) => q.in('contenedor_id', contIds));
    const busy = new Set(still.map((s) => s.contenedor_id));
    const emptyIds = contIds.filter((id) => !busy.has(id));
    if (emptyIds.length) {
      const deletedC = await deleteByIds(supabase, 'contenedores', emptyIds);
      console.log(`Contenedores vacíos borrados: ${deletedC}`);
    } else {
      console.log('No hay contenedores vacíos para borrar.');
    }
  }

  console.log('\nListo. Ya podés reimportar el Excel SISCOM a este almacén.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
