import { altaStock, bajaItem, listItemsAdmin, listStockByAlmacen, purgeAlmacenStock, updateItem } from '../services/adminService.js';
import { deleteItemImage, uploadItemImage } from '../services/itemImageService.js';

export async function getAdminItems(req, res) {
  const items = await listItemsAdmin();
  res.json({ items, total: items.length });
}

export async function getStockByAlmacen(req, res) {
  const almacen = req.query.almacen || req.params.almacen;
  if (!almacen) return res.status(400).json({ error: 'Query almacen requerido' });
  const data = await listStockByAlmacen(almacen);
  res.json(data);
}

export async function postPurgeAlmacenStock(req, res) {
  const result = await purgeAlmacenStock(req.body || {});
  res.json(result);
}

export async function postAltaStock(req, res) {
  const result = await altaStock(
    { ...req.body, sede: req.body?.sede || req.user?.sede || req.admin?.sede },
    req.admin?.name || req.user?.name || 'admin'
  );
  res.status(201).json(result);
}

export async function putUpdateItem(req, res) {
  const { itemId } = req.params;
  const result = await updateItem(itemId, {
    ...req.body,
    sede: req.body?.sede || req.user?.sede || req.admin?.sede,
  });
  res.json(result);
}

export async function postBajaItem(req, res) {
  const { itemId } = req.params;
  const result = await bajaItem(itemId, req.admin?.name || 'admin');
  res.json(result);
}

export async function postItemImagen(req, res) {
  const { itemId } = req.params;
  const result = await uploadItemImage(itemId, req.body);
  res.json(result);
}

export async function deleteItemImagen(req, res) {
  const { itemId } = req.params;
  const result = await deleteItemImage(itemId);
  res.json(result);
}
