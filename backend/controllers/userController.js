import {
  createUser,
  listUsers,
  resetUserPassword,
  updateUser,
} from '../services/userService.js';

export async function getUsers(req, res) {
  const users = await listUsers();
  res.json({ users });
}

export async function postUser(req, res) {
  const { username, displayName, role } = req.body;
  try {
    const user = await createUser({ username, displayName, role });
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
