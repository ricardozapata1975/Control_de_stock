import {
  createRole,
  deleteRole,
  getPermissionsCatalog,
  listRoles,
  updateRole,
} from '../services/rolesService.js';

function handle(err, res) {
  res.status(err.status || 500).json({ error: err.message || 'Error' });
}

export async function getRolesCatalog(_req, res) {
  res.json(getPermissionsCatalog());
}

export async function getRoles(_req, res) {
  try {
    const roles = await listRoles();
    res.json({ roles });
  } catch (err) {
    handle(err, res);
  }
}

export async function postRole(req, res) {
  try {
    const role = await createRole(req.body || {});
    res.status(201).json({ role });
  } catch (err) {
    handle(err, res);
  }
}

export async function putRole(req, res) {
  try {
    const role = await updateRole(req.params.codigo, req.body || {});
    res.json({ role });
  } catch (err) {
    handle(err, res);
  }
}

export async function deleteRoleHandler(req, res) {
  try {
    const result = await deleteRole(req.params.codigo);
    res.json(result);
  } catch (err) {
    handle(err, res);
  }
}
