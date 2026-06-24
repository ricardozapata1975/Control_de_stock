import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import { useAuth } from '../auth/AuthProvider';
import { api } from '../api/client';
import { isAdminRole } from '../utils/role';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();
  const { completeLogin } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.resetPassword({ token, newPassword, confirmPassword });
      const profile = completeLogin(data);
      navigate(isAdminRole(profile?.role) ? '/admin' : '/', { replace: true });
    } catch (err) {
      setError(err.message || 'No se pudo restablecer la contraseña');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-6">
        <div className="card max-w-md text-center">
          <p className="text-content">El enlace no es válido.</p>
          <Link to="/olvide-contrasena" className="mt-4 inline-block text-accent underline">
            Solicitar uno nuevo
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-surface p-6">
      <div className="absolute right-4 top-4 safe-top">
        <ThemeToggle />
      </div>
      <div className="card w-full max-w-md">
        <h1 className="mb-2 text-xl font-bold text-content">Nueva contraseña</h1>
        <p className="mb-6 text-sm text-muted">Elegí una contraseña nueva para tu cuenta.</p>

        {error && <div className="alert-error mb-4 text-sm">{error}</div>}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-label">Nueva contraseña</label>
            <input
              type="password"
              className="input-field"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={6}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="text-label">Confirmar contraseña</label>
            <input
              type="password"
              className="input-field"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>
          <p className="text-xs text-subtle">Mínimo 6 caracteres.</p>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'GUARDANDO...' : 'GUARDAR Y ENTRAR'}
          </button>
        </form>
      </div>
    </div>
  );
}
