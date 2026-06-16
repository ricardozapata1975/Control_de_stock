import {
  createUser,
  listUsers,
  resetUserPassword,
  sendUserWelcome,
  updateUser,
} from '../services/userService.js';
import {
  getUsersImportSpec,
  importUsersCsv,
  previewUsersCsv,
} from '../services/userCsvImportService.js';

export async function getUsers(req, res) {
  const users = await listUsers();
  res.json({ users });
}

export async function postUser(req, res) {
  const { username, displayName, role, email } = req.body;
  try {
    const user = await createUser({ username, displayName, role, email });
    res.status(201).json({
      user,
      message:
        'Usuario creado. Deberá definir su contraseña en el primer ingreso con su nombre de usuario.',
    });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
}

export async function putUser(req, res) {
  const { displayName, role, isActive } = req.body;
  try {
    const user = await updateUser(req.params.id, { displayName, role, isActive });
    res.json({ user });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
}

export async function postResetPassword(req, res) {
  try {
    const user = await resetUserPassword(req.params.id);
    res.json({
      user,
      message:
        'Contraseña restablecida. El usuario deberá crear una nueva en su próximo ingreso.',
    });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
}

export async function postSendWelcome(req, res) {
  try {
    const result = await sendUserWelcome(req.params.id);
    res.json(result);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
}

export function getUsersImportSpecHandler(_req, res) {
  res.json(getUsersImportSpec());
}

export async function postUsersImportPreview(req, res) {
  const { csv } = req.body;
  if (!csv?.trim()) {
    return res.status(400).json({ error: 'Enviá el contenido CSV en el campo "csv"' });
  }
  try {
    const preview = await previewUsersCsv(csv);
    res.json({ ok: true, ...preview });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
}

export async function postUsersImport(req, res) {
  const { csv, modoDuplicados = 'skip' } = req.body;
  if (!csv?.trim()) {
    return res.status(400).json({ error: 'Enviá el contenido CSV en el campo "csv"' });
  }
  try {
    const resultado = await importUsersCsv(csv, { modoDuplicados });
    res.json({ ok: true, ...resultado });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
}
