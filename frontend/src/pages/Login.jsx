import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

export default function Login() {
  const { login, beginFirstLogin, completeLogin, setPassword, isLoggedIn, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [modo, setModo] = useState('operario');
  const [step, setStep] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [changeToken, setChangeToken] = useState('');
  const [pendingUser, setPendingUser] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isLoggedIn) {
    return <Navigate to={isAdmin ? '/admin' : '/'} replace />;
  }

  const goHome = (profile) => {
    navigate(profile?.role === 'admin' ? '/admin' : '/');
  };

  const resetToLogin = () => {
    setStep('login');
    setNewPassword('');
    setConfirmPassword('');
    setSetupToken('');
    setChangeToken('');
    setPendingUser(null);
    setError('');
  };

  const submitLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(username, password);
      if (data.requiresPasswordSetup) {
        setPendingUser(data.user);
        setSetupToken(data.setupToken);
        setStep('setup');
        return;
      }
      if (data.requiresPasswordChange) {
        setPendingUser(data.user);
        setChangeToken(data.token);
        setStep('change');
        return;
      }
      const profile = completeLogin(data);
      goHome(profile);
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const submitFirstLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await beginFirstLogin(username);
      setPendingUser(data.user);
      setSetupToken(data.setupToken);
      setStep('setup');
    } catch (err) {
      setError(err.message || 'No se pudo iniciar el primer ingreso');
    } finally {
      setLoading(false);
    }
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const profile = await setPassword({
        setupToken: step === 'setup' ? setupToken : undefined,
        token: step === 'change' ? changeToken : undefined,
        newPassword,
        confirmPassword,
      });
      goHome(profile);
    } catch (err) {
      setError(err.message || 'No se pudo guardar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  const isSetupStep = step === 'setup' || step === 'change';
  const isFirstStep = step === 'primer-ingreso';

  const title = isFirstStep
    ? 'Primer ingreso'
    : step === 'setup'
      ? 'Crear contraseña'
      : step === 'change'
        ? 'Nueva contraseña'
        : modo === 'admin'
          ? 'Administrador'
          : 'Operario';

  const subtitle = isFirstStep
    ? 'Ingresá el usuario que te dio el administrador. Luego vas a crear tu contraseña.'
    : step === 'setup'
      ? `Bienvenido/a ${pendingUser?.name || pendingUser?.username || username}. Definí tu contraseña.`
      : step === 'change'
        ? `Actualizá la contraseña de ${pendingUser?.name || pendingUser?.username}.`
        : 'F-M-02 Control de Herramientas Compartidas';

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
          <p className="text-muted">{subtitle}</p>
          {(isSetupStep || isFirstStep) && (
            <p className="mt-2 font-mono text-sm text-amber-300">{pendingUser?.username || username}</p>
          )}
        </div>

        {!isSetupStep && !isFirstStep && (
          <div className="mb-4 flex rounded-lg border border-slate-600 p-1">
            <button
              type="button"
              className={`flex-1 rounded-md py-2 text-sm font-bold ${
                modo === 'operario' ? 'bg-amber-500 text-slate-950' : 'text-slate-200'
              }`}
              onClick={() => {
                setModo('operario');
                setError('');
              }}
            >
              Operario
            </button>
            <button
              type="button"
              className={`flex-1 rounded-md py-2 text-sm font-bold ${
                modo === 'admin' ? 'bg-amber-500 text-slate-950' : 'text-slate-200'
              }`}
              onClick={() => {
                setModo('admin');
                setError('');
              }}
            >
              Administrador
            </button>
          </div>
        )}

        <h2 className="mb-4 text-center text-lg font-bold text-amber-400">{title}</h2>

        {error && <div className="alert-error mb-4 text-sm">{error}</div>}

        {step === 'login' && (
          <form onSubmit={submitLogin} className="space-y-4">
            <div>
              <label className="text-label">Usuario</label>
              <input
                className="input-field"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                autoFocus
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
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'INGRESANDO...' : 'ENTRAR'}
            </button>
            {modo === 'operario' && (
              <p className="text-center text-sm">
                <button
                  type="button"
                  className="text-sky-300 underline hover:text-sky-100"
                  onClick={() => {
                    setError('');
                    setPassword('');
                    setStep('primer-ingreso');
                  }}
                >
                  ¿Es tu primer ingreso? Creá tu contraseña aquí
                </button>
              </p>
            )}
          </form>
        )}

        {step === 'primer-ingreso' && (
          <form onSubmit={submitFirstLogin} className="space-y-4">
            <div>
              <label className="text-label">Usuario</label>
              <input
                className="input-field"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="El que te asignó el administrador"
                required
                autoFocus
              />
            </div>
            <p className="text-xs text-subtle">
              Si el administrador ya te creó la cuenta, en el siguiente paso vas a elegir tu contraseña
              personal.
            </p>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'VERIFICANDO...' : 'CONTINUAR'}
            </button>
            <button
              type="button"
              className="w-full text-sm text-slate-300 underline hover:text-white"
              onClick={resetToLogin}
            >
              Volver al login de operario
            </button>
          </form>
        )}

        {isSetupStep && (
          <form onSubmit={submitPassword} className="space-y-4">
            <div>
              <label className="text-label">Nueva contraseña</label>
              <input
                type="password"
                className="input-field"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
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
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>
            <p className="text-xs text-subtle">Mínimo 6 caracteres.</p>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'GUARDANDO...' : 'GUARDAR Y ENTRAR'}
            </button>
            <button
              type="button"
              className="w-full text-sm text-slate-300 underline hover:text-white"
              onClick={resetToLogin}
            >
              Volver al login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
