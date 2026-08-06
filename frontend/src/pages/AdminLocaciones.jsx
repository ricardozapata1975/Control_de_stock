import { useEffect, useState } from 'react';
import FocusedPage from '../components/FocusedPage';
import { useAuth } from '../auth/AuthProvider';
import { api } from '../api/client';
import {
  ALMACEN_DEFAULT,
  ALMACEN_TIPOS,
  ARMARIO_TIPOS,
  SEDE_DEFAULT,
  buildCodigoCompletoPreview,
  getSedesFromCatalog,
} from '../utils/ubicacion';

/**
 * Administración de la estructura física: sedes, almacenes y armarios/gabinetes.
 */
export default function AdminLocaciones() {
  const { sede: sessionSede, sedeNombre: sessionSedeNombre } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [catalogo, setCatalogo] = useState({
    sedes: [],
    aduanasPorSede: {},
    almacenes: [],
    armariosPorAlmacen: {},
  });

  const [nuevoAlmTipo, setNuevoAlmTipo] = useState('Oficina');
  const [nuevoAlmNombre, setNuevoAlmNombre] = useState('');
  const [nuevoArmTipo, setNuevoArmTipo] = useState('Armario');
  const [nuevoArmNombre, setNuevoArmNombre] = useState('');
  const [nuevoSedeNombre, setNuevoSedeNombre] = useState('');
  const [mapAlmacen, setMapAlmacen] = useState(ALMACEN_DEFAULT);
  const [mapSede, setMapSede] = useState(SEDE_DEFAULT);
  const [almacenArmario, setAlmacenArmario] = useState(ALMACEN_DEFAULT);

  const almacenes = catalogo.almacenes?.length
    ? catalogo.almacenes
    : [{ codigo: ALMACEN_DEFAULT, nombre: 'Oficina principal', tipo: 'Oficina' }];
  const sedes = getSedesFromCatalog(catalogo);

  const mergeCatalogo = (cat) => ({
    sedes: cat?.sedes || [],
    aduanasPorSede: cat?.aduanasPorSede || {},
    almacenes: cat?.almacenes || [],
    armariosPorAlmacen: cat?.armariosPorAlmacen || {},
  });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const cat = await api.catalogoUbicacion(sessionSede ? { sede: sessionSede } : {});
      const next = mergeCatalogo(cat);
      setCatalogo(next);
      const codes = new Set((next.almacenes || []).map((a) => a.codigo));
      const first = next.almacenes?.[0]?.codigo || ALMACEN_DEFAULT;
      setMapAlmacen((prev) => (codes.has(prev) ? prev : first));
      setAlmacenArmario((prev) => (codes.has(prev) ? prev : first));
      if (sessionSede) setMapSede(sessionSede);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionSede]);

  const submitNuevoSede = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const result = await api.adminCreateSede({ nombre: nuevoSedeNombre.trim() });
      const aduana = result.sede?.aduana;
      const codigoPreview = aduana
        ? buildCodigoCompletoPreview(
            result.sede.codigo,
            aduana.almacen,
            aduana.armario,
            aduana.estante,
            aduana.contenedor
          )
        : '';
      setSuccess(
        `Sede ${result.sede.codigo} creada: ${result.sede.nombre}${
          codigoPreview ? ` — Aduana: ${codigoPreview}` : ''
        }`
      );
      setNuevoSedeNombre('');
      setCatalogo(mergeCatalogo(result.catalogo));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const submitMapAlmacenSede = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const result = await api.adminAssignAlmacenSede({ almacen: mapAlmacen, sede: mapSede });
      setSuccess(`Almacén ${result.almacen} asignado a sede ${result.sede}`);
      setCatalogo(mergeCatalogo(result.catalogo));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const submitNuevoAlmacen = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      if (!sessionSede) {
        throw new Error('No hay sucursal activa en la sesión. Volvé a iniciar sesión eligiendo sucursal.');
      }
      const result = await api.adminCreateAlmacen({
        tipo: nuevoAlmTipo,
        nombre: nuevoAlmNombre.trim(),
        sede: sessionSede,
      });
      setSuccess(
        `Almacén ${result.almacen.codigo} creado en ${sessionSedeNombre || sessionSede}: ${result.almacen.nombre}`
      );
      setNuevoAlmNombre('');
      setCatalogo(mergeCatalogo(result.catalogo));
      setAlmacenArmario(result.almacen.codigo);
      setMapAlmacen(result.almacen.codigo);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const submitNuevoArmario = async (e) => {
    e.preventDefault();
    if (!almacenArmario) return;
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const result = await api.adminCreateArmario({
        almacen: almacenArmario,
        tipo: nuevoArmTipo,
        nombre: nuevoArmNombre.trim(),
      });
      setSuccess(
        `${result.armario.tipo} ${result.armario.codigo} creado en ${almacenArmario}: ${result.armario.nombre}`
      );
      setNuevoArmNombre('');
      setCatalogo(mergeCatalogo(result.catalogo));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <FocusedPage maxWidth="max-w-5xl">
      <h2 className="page-title mb-2">Locaciones</h2>
      <p className="mb-2 text-muted">
        Jerarquía: Sede → Almacén → Armario/Gabinete → Estante → Contenedor. Cada sede tiene una{' '}
        <strong>aduana</strong> (recepción tránsito) para transferencias entre ubicaciones.
      </p>
      <p className="mb-4 rounded-lg border border-accent/40 bg-surface-muted px-3 py-2 text-sm text-content">
        Trabajando en sucursal:{' '}
        <strong className="text-accent">{sessionSedeNombre || sessionSede || '—'}</strong>
        . Almacenes y armarios nuevos se asocian a esta sucursal.
      </p>

      {error && <div className="alert-error mb-4">{error}</div>}
      {success && <div className="alert-success mb-4">{success}</div>}

      <details className="card mb-4" open>
        <summary className="cursor-pointer font-bold text-content">Sedes y aduanas de recepción</summary>
        <div className="mt-4 space-y-4">
          {sedes.length > 0 && (
            <ul className="space-y-2 text-sm">
              {sedes.map((s) => {
                const aduana = catalogo.aduanasPorSede?.[s.codigo] || s.aduana;
                const preview = aduana
                  ? buildCodigoCompletoPreview(
                      s.codigo,
                      aduana.almacen,
                      aduana.armario,
                      aduana.estante,
                      aduana.contenedor
                    )
                  : '—';
                return (
                  <li key={s.codigo} className="rounded-lg border border-border p-3">
                    <p className="font-semibold text-content">
                      {s.codigo} — {s.nombre}
                    </p>
                    <p className="mt-1 font-mono text-xs text-accent">Aduana: {preview}</p>
                    <p className="mt-1 text-xs text-muted">
                      Las transferencias entrantes se reciben primero aquí; luego el responsable
                      reubica el stock en el almacén final de la sede.
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
          <form onSubmit={submitNuevoSede} className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="text-label">Nueva sede *</label>
              <input
                className="input-field"
                placeholder="Ej: Oficina Santa Fe, Oficina Torcuato"
                value={nuevoSedeNombre}
                onChange={(e) => setNuevoSedeNombre(e.target.value)}
                required
              />
              <p className="mt-1 text-xs text-subtle">
                Se asigna código SED00x y se crea almacén aduana con gabinete, estante E01 y
                contenedor C01.
              </p>
            </div>
            <div className="flex items-end">
              <button type="submit" className="btn-secondary w-full" disabled={loading}>
                Crear sede + aduana
              </button>
            </div>
          </form>
          <form
            onSubmit={submitMapAlmacenSede}
            className="grid gap-3 border-t border-border pt-4 sm:grid-cols-3"
          >
            <div>
              <label className="text-label">Almacén</label>
              <select
                className="input-field"
                value={mapAlmacen}
                onChange={(e) => setMapAlmacen(e.target.value)}
              >
                {almacenes.map((a) => (
                  <option key={a.codigo} value={a.codigo}>
                    {a.codigo} — {a.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-label">Sede</label>
              <select className="input-field" value={mapSede} onChange={(e) => setMapSede(e.target.value)}>
                {sedes.map((s) => (
                  <option key={s.codigo} value={s.codigo}>
                    {s.codigo} — {s.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button type="submit" className="btn-secondary w-full" disabled={loading}>
                Asignar almacén a sede
              </button>
            </div>
          </form>
        </div>
      </details>

      <details className="card mb-4" open>
        <summary className="cursor-pointer font-bold text-content">
          Agregar almacén / depósito / oficina
        </summary>
        <form onSubmit={submitNuevoAlmacen} className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="text-label">Tipo *</label>
            <select
              className="input-field"
              value={nuevoAlmTipo}
              onChange={(e) => setNuevoAlmTipo(e.target.value)}
              required
            >
              {ALMACEN_TIPOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-label">Nombre descriptivo *</label>
            <input
              className="input-field"
              placeholder="Ej: Depósito norte, Oficina planta baja"
              value={nuevoAlmNombre}
              onChange={(e) => setNuevoAlmNombre(e.target.value)}
              required
            />
            <p className="mt-1 text-xs text-subtle">
              El código ALMxx se asigna automáticamente y queda ligado a{' '}
              <strong>{sessionSedeNombre || sessionSede || 'la sucursal activa'}</strong>.
            </p>
          </div>
          <button
            type="submit"
            className="btn-secondary sm:col-span-3"
            disabled={loading || !sessionSede}
          >
            Crear almacén
          </button>
        </form>
      </details>

      <details className="card mb-4" open>
        <summary className="cursor-pointer font-bold text-content">
          Agregar armario / estantería / gabinete
        </summary>
        <form onSubmit={submitNuevoArmario} className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="text-label">Almacén destino</label>
            <select
              className="input-field"
              value={almacenArmario}
              onChange={(e) => setAlmacenArmario(e.target.value)}
              required
            >
              {almacenes.map((a) => (
                <option key={a.codigo} value={a.codigo}>
                  {a.codigo} — {a.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-label">Tipo *</label>
            <select
              className="input-field"
              value={nuevoArmTipo}
              onChange={(e) => setNuevoArmTipo(e.target.value)}
              required
            >
              {ARMARIO_TIPOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-label">Nombre descriptivo *</label>
            <input
              className="input-field"
              placeholder="Ej: Estantería repuestos, Gabinete llaves"
              value={nuevoArmNombre}
              onChange={(e) => setNuevoArmNombre(e.target.value)}
              required
            />
            <p className="mt-1 text-xs text-subtle">
              El código Axx se asigna automáticamente dentro del almacén.
            </p>
          </div>
          <button
            type="submit"
            className="btn-secondary sm:col-span-3"
            disabled={loading || !nuevoArmNombre.trim()}
          >
            Crear en {almacenArmario}
          </button>
        </form>
      </details>

      <div className="card">
        <h3 className="section-title mb-3">Almacenes de la sucursal</h3>
        {loading && !almacenes.length ? (
          <p className="text-muted">Cargando…</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {almacenes.map((a) => {
              const arms = catalogo.armariosPorAlmacen?.[a.codigo] || [];
              return (
                <li key={a.codigo} className="rounded-lg border border-border p-3">
                  <p className="font-semibold">
                    {a.codigo} — {a.nombre}{' '}
                    <span className="font-normal text-muted">({a.tipo})</span>
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {arms.length
                      ? `Armarios: ${arms.map((x) => x.codigo).join(', ')}`
                      : 'Sin armarios aún'}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </FocusedPage>
  );
}
