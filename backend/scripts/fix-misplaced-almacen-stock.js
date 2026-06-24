#!/usr/bin/env node
/**
 * Repara stock guardado por error en ALM01 (código legacy) cuando debía ir a otro almacén.
 *
 * Uso:
 *   node backend/scripts/fix-misplaced-almacen-stock.js --almacen ALM02 --armario A00
 *   node backend/scripts/fix-misplaced-almacen-stock.js --almacen ALM02 --armario A00 --apply
 *
 * Por defecto solo informa (dry-run). Con --apply mueve el stock a contenedores ALMxx- prefijados.
 */
import { getSupabase } from '../db/supabase.js';
import { assertConfig } from '../config.js';
import {
  ALMACEN_DEFAULT,
  buildCodigo,
  getArmarioNombre,
  normalizeAlmacen,
} from '../services/ubicacionUtils.js';

function parseArgs(argv) {
  const args = { almacen: '', armario: '', apply: false };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--apply') args.apply = true;
    else if (argv[i] === '--almacen') args.almacen = argv[++i] || '';
    else if (argv[i] === '--armario') args.armario = argv[++i] || '';
  }
  return args;
}

async function ensureTargetContenedor(supabase, targetAlm, sourceCont) {
  const targetCodigo = buildCodigo(
    targetAlm,
    sourceCont.armario,
    sourceCont.estante,
    sourceCont.contenedor
  );

  const { data: existing, error: e1 } = await supabase
    .from('contenedores')
    .select('*')
    .eq('codigo', targetCodigo)
    .maybeSingle();
  if (e1) throw new Error(e1.message);
  if (existing) return existing;

  const row = {
    codigo: targetCodigo,
    almacen: targetAlm,
    armario: sourceCont.armario,
    estante: sourceCont.estante,
    contenedor: sourceCont.contenedor,
    ubicacion: getArmarioNombre(sourceCont.armario, targetAlm),
  };

  const { data: created, error: e2 } = await supabase
    .from('contenedores')
    .insert(row)
    .select('*')
    .single();
  if (e2) throw new Error(e2.message);
  return created;
}

async function moveStock(supabase, stockRow, targetContenedorId) {
  const { data: dest, error: e1 } = await supabase
    .from('stock')
    .select('id, cantidad')
    .eq('item_id', stockRow.item_id)
    .eq('contenedor_id', targetContenedorId)
    .maybeSingle();
  if (e1) throw new Error(e1.message);

  if (dest) {
    const { error: eu } = await supabase
      .from('stock')
      .update({
        cantidad: dest.cantidad + stockRow.cantidad,
        updated_at: new Date().toISOString(),
      })
      .eq('id', dest.id);
    if (eu) throw new Error(eu.message);
    const { error: ed } = await supabase.from('stock').delete().eq('id', stockRow.id);
    if (ed) throw new Error(ed.message);
    return 'merged';
  }

  const { error: em } = await supabase
    .from('stock')
    .update({
      contenedor_id: targetContenedorId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', stockRow.id);
  if (em) throw new Error(em.message);
  return 'moved';
}

async function main() {
  const { almacen, armario, apply } = parseArgs(process.argv);
  if (!almacen || !armario) {
    console.error('Uso: node fix-misplaced-almacen-stock.js --almacen ALM02 --armario A00 [--apply]');
    process.exit(1);
  }

  assertConfig();
  const targetAlm = normalizeAlmacen(almacen);
  const armarioCode = armario.toUpperCase();
  const supabase = getSupabase();

  const { data: sourceContenedores, error: ec } = await supabase
    .from('contenedores')
    .select('*')
    .eq('almacen', ALMACEN_DEFAULT)
    .eq('armario', armarioCode)
    .not('codigo', 'like', 'ALM%');
  if (ec) throw new Error(ec.message);

  if (!sourceContenedores?.length) {
    console.log(`No hay contenedores legacy ALM01 con armario ${armarioCode}.`);
    return;
  }

  const sourceIds = sourceContenedores.map((c) => c.id);
  const { data: stockRows, error: es } = await supabase
    .from('stock')
    .select('id, item_id, contenedor_id, cantidad')
    .in('contenedor_id', sourceIds);
  if (es) throw new Error(es.message);

  if (!stockRows?.length) {
    console.log('No hay stock en contenedores legacy candidatos.');
    return;
  }

  console.log(
    `${apply ? 'APLICANDO' : 'DRY-RUN'}: ${stockRows.length} fila(s) de stock en ALM01/${armarioCode} → ${targetAlm}`
  );

  for (const stockRow of stockRows) {
    const sourceCont = sourceContenedores.find((c) => c.id === stockRow.contenedor_id);
    const targetCodigo = buildCodigo(
      targetAlm,
      sourceCont.armario,
      sourceCont.estante,
      sourceCont.contenedor
    );
    console.log(
      `  stock ${stockRow.id}: ${sourceCont.codigo} (${stockRow.cantidad} u.) → ${targetCodigo}`
    );

    if (apply) {
      const targetCont = await ensureTargetContenedor(supabase, targetAlm, sourceCont);
      const action = await moveStock(supabase, stockRow, targetCont.id);
      console.log(`    → ${action}`);
    }
  }

  if (!apply) {
    console.log('\nEjecutá con --apply para mover el stock. Revisá antes si hay stock legítimo en ALM01.');
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
