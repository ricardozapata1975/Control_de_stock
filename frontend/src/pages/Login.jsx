import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

export default function Login() {
  const { loginOperario, loginAdmin, isLoggedIn, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [modo, setModo] = useState('operario');
  const [nombre, setNombre] = useState('');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isLoggedIn) {
    return <Navigate to={isAdmin ? '/admin' : '/'} replace />;
  }

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (modo === 'admin') {
        await loginAdmin(username, password);
        navigate('/admin');
      } else {
        if (!nombre.trim()) return;
        await loginOperario(nombre);
        navigate('/');
      }
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-6">
      <div className="card w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <img
            src="/px-control-logo.png"
            alt="PX Control — Process Automation Experts"
            className="h-14 w-auto max-w-full object-contain"
          />
          <h1 className="mt-4 text-xl font-bold text-slate-100">Inventario Px Control</h1>
          <p className="text-muted">F-M-02 Control de Herramientas Compartidas</p>
        </div>

        <div className="mb-4 flex rounded-lg border border-slate-600 p-1">
          <button
            type="button"
            className={`flex-1 rounded-md py-2 text-sm font-bold ${
              modo === 'operario' ? 'bg-amber-500 text-slate-950' : 'text-slate-200'
            }`}
            onClick={() => setModo('operario')}
          >
            Operario
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md py-2 text-sm font-bold ${
              modo === 'admin' ? 'bg-amber-500 text-slate-950' : 'text-slate-200'
            }`}
            onClick={() => setModo('admin')}
          >
            Administrador
          </button>
        </div>

        {error && <div className="alert-error mb-4 text-sm">{error}</div>}

        <form onSubmit={submit} className="space-y-4">
          {modo === 'operario' ? (
            <input
              className="input-field"
              placeholder="Tu nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoFocus
            />
          ) : (
            <>
              <div>
                <label className="text-label">Usuario</label>
                <input
                  className="input-field"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
              <div>
                <label className="text-label">Contraseña</label>
                <input
                  type="password"
                  className="input-field"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
            </>
          )}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'INGRESANDO...' : 'ENTRAR'}
          </button>
        </form>
      </div>
    </div>
  );
}
