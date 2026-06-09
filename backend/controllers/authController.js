import { loginUser } from '../services/authService.js';
import { setUserPassword } from '../services/userService.js';

export async function postLogin(req, res) {
  const { username, password } = req.body;
  const user = String(username || '').trim();
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
