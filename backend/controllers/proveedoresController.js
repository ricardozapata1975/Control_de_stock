import {
  createProveedor,
  deactivateProveedor,
  listProveedoresAgenda,
  searchProveedores,
  updateProveedor,
} from '../services/proveedoresService.js';

export async function getProveedores(req, res) {
  const agenda = req.query.agenda === '1' || req.query.agenda === 'true';
  if (agenda) {
    const proveedores = await listProveedoresAgenda(req.query.q);
    return res.json({ proveedores });
  }
  const proveedores = await searchProveedores(req.query.q);
  res.json({ proveedores });
}

export async function postProveedor(req, res) {
  const proveedor = await createProveedor(req.body);
  res.status(201).json({ proveedor });
}

export async function putProveedor(req, res) {
  const proveedor = await updateProveedor(req.params.id, req.body);
  res.json({ proveedor });
}

export async function deleteProveedorHandler(req, res) {
  const proveedor = await deactivateProveedor(req.params.id);
  res.json({ ok: true, proveedor });
}
