import {
  createCliente,
  deactivateCliente,
  listClientesAgenda,
  searchClientes,
  updateCliente,
} from '../services/clientesService.js';

export async function getClientes(req, res) {
  const agenda = req.query.agenda === '1' || req.query.agenda === 'true';
  if (agenda) {
    const clientes = await listClientesAgenda(req.query.q);
    return res.json({ clientes });
  }
  const clientes = await searchClientes(req.query.q);
  res.json({ clientes });
}

export async function postClientes(req, res) {
  const cliente = await createCliente(req.body);
  res.status(201).json({ cliente });
}

export async function putCliente(req, res) {
  const cliente = await updateCliente(req.params.id, req.body);
  res.json({ cliente });
}

export async function deleteClienteHandler(req, res) {
  const cliente = await deactivateCliente(req.params.id);
  res.json({ ok: true, cliente });
}
