import { searchClientes, createCliente } from '../services/clientesService.js';

export async function getClientes(req, res) {
  const clientes = await searchClientes(req.query.q);
  res.json({ clientes });
}

export async function postClientes(req, res) {
  const cliente = await createCliente(req.body);
  res.status(201).json({ cliente });
}
