import { useEffect, useState } from 'react';
import FocusedPage from '../components/FocusedPage';
import { api, getDocsUrl } from '../api/client';
import { useAuth } from '../auth/AuthProvider';

export default function ImportarCSV() {
  const { token } = useAuth();
  const [spec, setSpec] = useState(null);
  const [csv, setCsv] = useState('');
  const [modo, setModo] = useState('agregar');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.importEspecificacion().then(setSpec).catch((e) => setError(e.message));
  }, []);

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result || ''));
    reader.readAsText(file, 'UTF-8');
  };

  const downloadPlantilla = () => api.downloadPlantilla();

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const data = await api.importCsv({ csv, modo });
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <FocusedPage maxWidth="max-w-5xl" align="start">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="page-title">Importar datos (CSV)</h2>
          <p className="text-muted">Migrá inventario desde una planilla con el formato definido.</p>
        </div>
        <a
          href={getDocsUrl('/docs/import-csv.html')}
          target="_blank"
          rel="noreferrer"
          className="btn-secondary py-2 text-sm"
        >
          Ver documentación
        </a>
      </div>

      {error && <div className="alert-error mb-4">{error}</div>}

      {spec && (
        <div className="card mb-4">
          <h3 className="section-title mb-2">Formato del CSV</h3>
          <p className="mb-3 text-sm text-muted">{spec.formato}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="table-head">
                <tr>
                  <th className="px-3 py-2">Columna</th>
                  <th className="px-3 py-2">Obligatorio</th>
                  <th className="px-3 py-2">Descripción</th>
                  <th className="px-3 py-2">Ejemplo</th>
                </tr>
              </thead>
              <tbody>
                {spec.columnas.map((c) => (
                  <tr key={c.nombre} className="table-row">
                    <td className="px-3 py-2 font-mono text-amber-300">{c.nombre}</td>
                    <td className="px-3 py-2">{c.obligatorio ? 'Sí' : 'No'}</td>
                    <td className="px-3 py-2 table-cell-muted">{c.descripcion}</td>
                    <td className="px-3 py-2 table-cell-muted">{c.ejemplo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-subtle">
            Base actual: <strong className="text-slate-200">{spec.db}</strong>
            {spec.demoMode && ' — modo reemplazar disponible'}
          </p>
        </div>
      )}

      <form onSubmit={submit} className="card max-w-2xl space-y-4">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary text-sm" onClick={downloadPlantilla}>
            Descargar plantilla.csv
          </button>
          <label className="btn-secondary cursor-pointer text-sm">
            Elegir archivo
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
          </label>
        </div>

        <div>
          <label className="text-label">Modo</label>
          <select className="input-field" value={modo} onChange={(e) => setModo(e.target.value)}>
            <option value="agregar">Agregar / sumar al inventario actual</option>
            {spec?.demoMode && (
              <option value="reemplazar">Reemplazar todo (solo demo local)</option>
            )}
          </select>
          {modo === 'reemplazar' && (
            <p className="mt-1 text-sm text-amber-200">
              Borra ítems y stock actuales en demo-db.json antes de importar.
            </p>
          )}
        </div>

        <div>
          <label className="text-label">Contenido CSV</label>
          <textarea
            className="input-field min-h-[200px] font-mono text-base"
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder="nombre,marca,modelo,tipo,detalle,armario,estante,contenedor,cantidad&#10;..."
            required
          />
        </div>

        <button type="submit" className="btn-primary w-full" disabled={loading || !csv.trim()}>
          {loading ? 'IMPORTANDO...' : 'IMPORTAR'}
        </button>
      </form>

      {result && (
        <div className={`mt-4 ${result.errores?.length ? 'alert-warning' : 'alert-success'}`}>
          <p>
            Importadas <strong>{result.ok}</strong> de {result.filas} filas (modo: {result.modo}).
          </p>
          {result.ok > 0 && (
            <p className="mt-2 text-sm">
              Andá a <strong>Inventario</strong> y tocá <strong>Actualizar</strong> para ver los datos nuevos.
            </p>
          )}
          {result.errores?.length > 0 && (
            <>
              <p className="mt-2 text-sm">
                {result.errores.length} fila(s) con error
                {result.errores.length > 20 ? ' (mostrando las primeras 20)' : ''}:
              </p>
              <ul className="mt-1 max-h-48 list-inside list-disc overflow-y-auto text-sm">
                {result.errores.slice(0, 20).map((err) => (
                  <li key={err.linea}>
                    Línea {err.linea}: {err.error}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {!token && (
        <p className="mt-4 text-sm text-amber-200">Sesión admin requerida para importar.</p>
      )}
    </FocusedPage>
  );
}
