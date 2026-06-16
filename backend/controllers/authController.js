import { loginUser } from '../services/authService.js';
import {
  beginFirstLogin,
  requestPasswordReset,
  resetPasswordWithToken,
  setUserPassword,
} from '../services/userService.js';

export async function postLogin(req, res) {
  const { username, password, nombre } = req.body;
  const user = String(username || nombre || '').trim();
  if (!user) {
    return res.status(400).json({ error: 'Ingresá tu usuario' });
  }

  const result = await loginUser(user, password);
  if (!result) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }

  if (result.requiresPasswordSetup) {
    return res.json({
      requiresPasswordSetup: true,
      setupToken: result.setupToken,
      user: result.user,
    });
  }

  if (result.requiresPasswordChange) {
    return res.json({
      requiresPasswordChange: true,
      token: result.token,
      user: result.user,
    });
  }

  return res.json(result);
}

export async function postFirstLogin(req, res) {
  const { username, nombre } = req.body;
  const user = String(username || nombre || '').trim();
  if (!user) {
    return res.status(400).json({ error: 'Ingresá tu usuario' });
  }

  try {
    const result = await beginFirstLogin(user);
    return res.json(result);
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message });
  }
}

export async function postSetPassword(req, res) {
  const { setupToken, token, newPassword, confirmPassword } = req.body;
  if (!newPassword || newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'Las contraseñas no coinciden' });
  }

  try {
    const result = await setUserPassword({ setupToken, token, newPassword });
    return res.json(result);
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message });
  }
}

export async function postForgotPassword(req, res) {
  const { email, username } = req.body;
  try {
    const result = await requestPasswordReset({ email, username });
    return res.json(result);
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message });
  }
}

export async function postResetPassword(req, res) {
  const { token, newPassword, confirmPassword } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Falta el token de recuperación' });
  }
  if (!newPassword || newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'Las contraseñas no coinciden' });
  }

  try {
    const result = await resetPasswordWithToken({ token, newPassword });
    return res.json(result);
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message });
  }
}
