import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LEDGER_PATH = path.join(__dirname, '../data/sync-ledger.json');

async function readLedger() {
  if (!config.demoMode) return { processed: {}, conflicts: {} };
  try {
    const raw = await fs.readFile(LEDGER_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { processed: {}, conflicts: {} };
  }
}

async function writeLedger(ledger) {
  if (!config.demoMode) return;
  await fs.mkdir(path.dirname(LEDGER_PATH), { recursive: true });
  await fs.writeFile(LEDGER_PATH, JSON.stringify(ledger, null, 2));
}

export async function getProcessedEntry(clientId) {
  const ledger = await readLedger();
  return ledger.processed[clientId] || null;
}

export async function markProcessed(clientId, meta) {
  const ledger = await readLedger();
  ledger.processed[clientId] = {
    ...meta,
    appliedAt: new Date().toISOString(),
  };
  await writeLedger(ledger);
}

/** Conflicto ingreso: gana el timestamp más reciente si aún no hay ingreso aplicado */
export async function resolveIngresoConflict(movimientoId, clientId, timestamp) {
  const ledger = await readLedger();
  const key = `ingreso:${movimientoId}`;
  const existing = ledger.conflicts[key];

  if (!existing) {
    ledger.conflicts[key] = { clientId, timestamp, applied: false };
    await writeLedger(ledger);
    return { allow: true, reason: 'new' };
  }

  if (existing.applied && existing.clientId !== clientId) {
    const existingTs = new Date(existing.timestamp).getTime();
    const incomingTs = new Date(timestamp).getTime();
    if (incomingTs <= existingTs) {
      return { allow: false, reason: 'stale', winner: existing.clientId };
    }
  }

  if (!existing.applied) {
    const existingTs = new Date(existing.timestamp).getTime();
    const incomingTs = new Date(timestamp).getTime();
    if (incomingTs >= existingTs) {
      ledger.conflicts[key] = { clientId, timestamp, applied: false };
      await writeLedger(ledger);
      return { allow: true, reason: 'newer-wins' };
    }
    return { allow: false, reason: 'older-loses', winner: existing.clientId };
  }

  return { allow: false, reason: 'already-applied', winner: existing.clientId };
}

export async function markIngresoApplied(movimientoId, clientId, timestamp) {
  const ledger = await readLedger();
  ledger.conflicts[`ingreso:${movimientoId}`] = { clientId, timestamp, applied: true };
  await writeLedger(ledger);
}
