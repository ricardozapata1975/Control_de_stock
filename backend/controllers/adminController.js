import { altaStock, bajaItem, listItemsAdmin, updateItem } from '../services/adminService.js';

export async function getAdminItems(req, res) {
  const items = await listItemsAdmin();
  res.json({ items, total: items.length });
}

export async function postAltaStock(req, res) {
  const result = await altaStock(req.body, req.admin?.name || 'admin');
  res.status(201).json(result);
}

export async function putUpdateItem(req, res) {
  const { itemId } = req.params;
  const result = await updateItem(itemId, req.body);
  res.json(result);
}

export async function postBajaItem(req, res) {
  const { itemId } = req.params;
  const result = await bajaItem(itemId, req.admin?.name || 'admin');
  res.json(result);
}
