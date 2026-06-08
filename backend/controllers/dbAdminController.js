import {
  deleteTableRow,
  getTableRows,
  listTablesMeta,
  saveTableRow,
} from '../services/dbAdminService.js';

export function getDbSchema(_req, res) {
  res.json({ tables: listTablesMeta() });
}

export async function getDbTable(req, res) {
  const data = await getTableRows(req.params.table);
  res.json(data);
}

export async function postDbRow(req, res) {
  const row = await saveTableRow(req.params.table, req.body);
  res.status(201).json({ row });
}

export async function putDbRow(req, res) {
  const { table, id } = req.params;
  const rowId = table === 'catalogo' ? undefined : id;
  const row = await saveTableRow(table, req.body, rowId);
  res.json({ row });
}

export async function deleteDbRow(req, res) {
  const result = await deleteTableRow(req.params.table, req.params.id);
  res.json(result);
}
