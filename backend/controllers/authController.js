import { loginAdmin, loginOperario } from '../services/authService.js';

export async function postLogin(req, res) {
  const { username, password, nombre } = req.body;

  if (username && password) {
    const result = loginAdmin(username, password);
    if (!result) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }
    return res.json(result);
  }

  const result = loginOperario(nombre);
  if (!result) {
    return res.status(400).json({ error: 'Ingresá tu nombre para continuar' });
  }
  return res.json(result);
}
