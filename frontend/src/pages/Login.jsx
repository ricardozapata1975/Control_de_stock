import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { isAdminRole } from '../utils/role';
import ThemeToggle from '../components/ThemeToggle';

export default function Login() {
  const { login, beginFirstLogin, completeLogin, setPassword: savePassword, isLoggedIn, isAdmin } =
    useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPasswordValue] = useState('');
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
    navigate(isAdminRole(profile?.role) ? '/admin' : '/');
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
      const profile = await savePassword({
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
  const isLoginStep = step === 'login';

  const stepTitle = isFirstStep
    ? 'Primer ingreso'
    : step === 'setup'
      ? 'Crear contraseña'
      : step === 'change'
        ? 'Nueva contraseña'
        : null;

  const subtitle = isLoginStep
    ? 'F-M-02 Control de Herramientas Compartidas'
    : isFirstStep
      ? 'Ingresá el usuario que te dio el administrador. Luego vas a crear tu contraseña.'
      : step === 'setup'
        ? `Bienvenido/a ${pendingUser?.name || pendingUser?.username || username}. Definí tu contraseña.`
        : step === 'change'
          ? `Actualizá la contraseña de ${pendingUser?.name || pendingUser?.username}.`
          : '';

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-surface px-6 py-10">
      <div className="absolute right-4 top-4 safe-top">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        <header className="mb-8 flex flex-col items-center text-center">
          <img
            src="/px-control-logo.png"
            alt="PX Control — Process Automation Experts"
            className="h-28 w-auto max-w-[min(100%,320px)] object-contain sm:h-32"
          />
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-content sm:text-3xl">
            Inventario Px Control
          </h1>
          <p className="mt-2 text-sm text-muted sm:text-base">{subtitle}</p>
          {(isSetupStep || isFirstStep) && (
            <p className="mt-2 font-mono text-sm text-amber-300">
              {pendingUser?.username || username}
            </p>
          )}
        </header>

        <div className="card">
          {stepTitle && (
            <h2 className="mb-4 text-center text-lg font-bold text-accent">{stepTitle}</h2>
          )}

          {error && <div className="alert-error mb-4 text-sm">{error}</div>}

          {isLoginStep && (
            <>
              <form
                onSubmit={submitLogin}
                className="space-y-4 rounded-lg border border-border bg-surface-muted/60 p-5"
              >
                <div>
                  <label className="text-label" htmlFor="login-username">
                    Usuario
                  </label>
                  <input
                    id="login-username"
                    className="input-field"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-label" htmlFor="login-password">
                    Contraseña
                  </label>
                  <input
                    id="login-password"
                    type="password"
                    className="input-field"
                    value={password}
                    onChange={(e) => setPasswordValue(e.target.value)}
                    autoComplete="current-password"
                    required
                    placeholder="Tu contraseña"
                  />
                </div>
                <button type="submit" className="btn-primary w-full" disabled={loading}>
                  {loading ? 'INGRESANDO...' : 'ENTRAR'}
                </button>
              </form>

              <div className="mt-5 space-y-2 text-center text-sm">
                <p>
                  <Link
                    to="/olvide-contrasena"
                    className="text-content-muted underline hover:text-content"
                  >
                    Olvidé mi contraseña
                  </Link>
                </p>
                <p>
                  <button
                    type="button"
                    className="text-content-muted underline hover:text-content"
                    onClick={() => {
                      setError('');
                      setPasswordValue('');
                      setStep('primer-ingreso');
                    }}
                  >
                    Primer ingreso — crear contraseña
                  </button>
                </p>
              </div>
            </>
          )}

          {isFirstStep && (
            <form onSubmit={submitFirstLogin} className="space-y-4">
              <div>
                <label className="text-label" htmlFor="first-login-username">
                  Usuario
                </label>
                <input
                  id="first-login-username"
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
                Si el administrador ya te creó la cuenta, en el siguiente paso vas a elegir tu
                contraseña personal.
              </p>
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? 'VERIFICANDO...' : 'CONTINUAR'}
              </button>
              <button
                type="button"
                className="w-full min-h-[44px] text-sm text-content-subtle underline hover:text-content"
                onClick={resetToLogin}
              >
                Volver al login
              </button>
            </form>
          )}

          {isSetupStep && (
            <form onSubmit={submitPassword} className="space-y-4">
              <div>
                <label className="text-label" htmlFor="new-password">
                  Nueva contraseña
                </label>
                <input
                  id="new-password"
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
                <label className="text-label" htmlFor="confirm-password">
                  Confirmar contraseña
                </label>
                <input
                  id="confirm-password"
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
                className="w-full min-h-[44px] text-sm text-content-subtle underline hover:text-content"
                onClick={resetToLogin}
              >
                Volver al login
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
