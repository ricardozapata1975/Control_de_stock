import { useState } from 'react';
import { Link } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import { api } from '../api/client';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const data = await api.forgotPassword({ email: email.trim() });
      setMessage(data.message);
      setSent(true);
    } catch (err) {
      setError(err.message || 'No se pudo enviar el correo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-surface p-6">
      <div className="absolute right-4 top-4 safe-top">
        <ThemeToggle />
      </div>
      <div className="card w-full max-w-md">
        <h1 className="mb-2 text-xl font-bold text-content">Recuperar contraseña</h1>
        <p className="mb-6 text-sm text-muted">
          Ingresá el correo registrado en tu cuenta. Te enviaremos un enlace para crear una nueva
          contraseña.
        </p>

        {error && <div className="alert-error mb-4 text-sm">{error}</div>}
        {message && <div className="alert-success mb-4 text-sm">{message}</div>}

        {!sent ? (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-label" htmlFor="forgot-email">
                Correo electrónico
              </label>
              <input
                id="forgot-email"
                type="email"
                className="input-field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                autoFocus
              />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'ENVIANDO...' : 'ENVIAR ENLACE'}
            </button>
          </form>
        ) : (
          <p className="text-sm text-content-muted">
            Revisá tu bandeja de entrada y la carpeta de spam. El enlace vence en 1 hora.
          </p>
        )}

        <Link
          to="/login"
          className="mt-6 block text-center text-sm text-content-subtle underline hover:text-content"
        >
          Volver al login
        </Link>
      </div>
    </div>
  );
}
