import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { api, getDocsUrl } from '../api/client';
import { useAuth } from '../auth/AuthProvider';

function sheetToCsv(workbook) {
  const name = workbook.SheetNames?.[0];
  if (!name) throw new Error('El Excel no tiene hojas');
  return XLSX.utils.sheet_to_csv(workbook.Sheets[name]);
}

/**
 * Carga masiva CSV/XLS con análisis previo (preview) y aplicación.
 * Soporta plantilla nativa y export SISCOM (ingreso a aduana de la sede).
 */
export default function StockBulkImport({ onImported }) {
  const { sede, sedeNombre } = useAuth();
  const [spec, setSpec] = useState(null);
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState('');
  const [modo, setModo] = useState('agregar');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.importEspecificacion().then(setSpec).catch((e) => setError(e.message));
  }, []);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setPreview(null);
    setResult(null);
    setFileName(file.name);
    const lower = file.name.toLowerCase();
    try {
      if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        setCsv(sheetToCsv(wb));
      } else {
        setCsv(await file.text());
      }
    } catch (err) {
      setError(err.message || 'No se pudo leer el archivo');
      setCsv('');
      setFileName('');
    }
  };

  const analizar = async () => {
    if (!csv.trim()) {
      setError('Cargá un CSV/Excel o pegá el contenido primero');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await api.importPreview({ csv, sede });
      setPreview(data);
    } catch (err) {
      setError(err.message);
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  const aplicar = async () => {
    if (!csv.trim()) return;
    if (preview && preview.invalidas > 0) {
      const ok = window.confirm(
        `Hay ${preview.invalidas} fila(s) con error. Se importarán solo las válidas (${preview.validas}). ¿Continuar?`
      );
      if (!ok) return;
    } else if (!window.confirm('¿Aplicar la importación al inventario?')) {
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await api.importCsv({ csv, modo, sede });
      setResult(data);
      setPreview(null);
      onImported?.(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="section-title">Carga masiva (CSV / Excel)</h3>
          <p className="text-sm text-muted">
            Plantilla nativa o export SISCOM. Analizá antes de aplicar.
          </p>
        </div>
        <a
          href={getDocsUrl('/docs/import-csv.html')}
          target="_blank"
          rel="noreferrer"
          className="btn-secondary py-2 text-sm"
        >
          Documentación
        </a>
      </div>

      <div className="rounded-lg border border-accent/40 bg-surface-muted px-3 py-2 text-sm">
        Destino de importación SISCOM: aduana de{' '}
        <strong className="text-accent">{sedeNombre || sede || '—'}</strong>
        . Después reubicá cada ítem en <strong>Editor de Stock → Editar existente</strong>.
      </div>

      {error && <div className="alert-error">{error}</div>}

      {spec && (
        <div className="overflow-x-auto rounded-xl border border-edge">
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
                  <td className="px-3 py-2 font-mono text-amber-700 dark:text-amber-300">{c.nombre}</td>
                  <td className="px-3 py-2">{c.obligatorio ? 'Sí' : 'No'}</td>
                  <td className="px-3 py-2 table-cell-muted">{c.descripcion}</td>
                  <td className="px-3 py-2 table-cell-muted">{c.ejemplo}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-edge px-3 py-2 text-xs text-subtle">{spec.formato}</p>
          {spec.formatosSoportados && (
            <p className="border-t border-edge px-3 py-2 text-xs text-subtle">
              SISCOM: {spec.formatosSoportados.siscom}
            </p>
          )}
        </div>
      )}

      <div className="card space-y-4">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary text-sm" onClick={() => api.downloadPlantilla()}>
            Descargar plantilla.csv
          </button>
          <label className="btn-secondary cursor-pointer text-sm">
            Elegir CSV / Excel
            <input
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={onFile}
            />
          </label>
          {fileName && <span className="self-center text-sm text-muted">{fileName}</span>}
        </div>

        <div>
          <label className="text-label">Modo al aplicar</label>
          <select className="input-field" value={modo} onChange={(e) => setModo(e.target.value)}>
            <option value="agregar">Agregar / sumar al inventario actual</option>
            {spec?.demoMode && (
              <option value="reemplazar">Reemplazar todo (solo demo local)</option>
            )}
          </select>
        </div>

        <div>
          <label className="text-label">Contenido (tabla CSV)</label>
          <textarea
            className="input-field min-h-[160px] font-mono text-sm"
            value={csv}
            onChange={(e) => {
              setCsv(e.target.value);
              setPreview(null);
              setResult(null);
            }}
            placeholder="SISCOM: IDARTICULO,CODART,DESCRIPCIO,DEPOSITO,EXISTENCIA&#10;o plantilla: nombre,marca,...,armario,estante,contenedor,cantidad"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary flex-1"
            disabled={loading || !csv.trim()}
            onClick={analizar}
          >
            {loading && !result ? 'Analizando…' : 'Analizar'}
          </button>
          <button
            type="button"
            className="btn-primary flex-1"
            disabled={loading || !csv.trim() || (preview && preview.validas === 0)}
            onClick={aplicar}
          >
            {loading && preview ? 'Aplicando…' : 'Aplicar cambios'}
          </button>
        </div>
      </div>

      {preview && (
        <div className={`card ${preview.invalidas ? 'border-amber-400' : 'border-emerald-400'}`}>
          <p className="mb-1 font-medium">
            Análisis: {preview.validas} válidas · {preview.invalidas} con error · {preview.filas}{' '}
            filas
          </p>
          <p className="mb-2 text-sm text-muted">
            Formato: <strong>{preview.formato || 'nativo'}</strong>
            {preview.ubicacionDestino ? (
              <>
                {' '}
                · Destino: <span className="font-mono text-accent">{preview.ubicacionDestino}</span>
              </>
            ) : null}
          </p>
          {preview.nota && <p className="mb-3 text-sm text-amber-800 dark:text-amber-200">{preview.nota}</p>}
          <div className="max-h-72 overflow-auto rounded border border-edge">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-surface-2">
                <tr>
                  <th className="px-2 py-1">Línea</th>
                  <th className="px-2 py-1">Estado</th>
                  <th className="px-2 py-1">Código</th>
                  <th className="px-2 py-1">Nombre</th>
                  <th className="px-2 py-1">Dep. origen</th>
                  <th className="px-2 py-1">Ubicación destino</th>
                  <th className="px-2 py-1">Cant.</th>
                  <th className="px-2 py-1">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {(preview.preview || []).slice(0, 200).map((r) => (
                  <tr key={r.linea} className="border-t border-edge">
                    <td className="px-2 py-1 font-mono">{r.linea}</td>
                    <td className="px-2 py-1">{r.ok ? 'OK' : 'Error'}</td>
                    <td className="px-2 py-1 font-mono">{r.codigoFabricante || '—'}</td>
                    <td className="px-2 py-1">{r.nombre || '—'}</td>
                    <td className="px-2 py-1 font-mono">{r.depositoOrigen || '—'}</td>
                    <td className="px-2 py-1 font-mono">
                      {r.ok
                        ? `${r.armario}-${r.estante}${r.contenedor ? `-${r.contenedor}` : ''}`
                        : '—'}
                    </td>
                    <td className="px-2 py-1">{r.ok ? r.cantidad : '—'}</td>
                    <td className="px-2 py-1 text-red-600 dark:text-red-300">{r.error || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(preview.preview || []).length > 200 && (
            <p className="mt-2 text-xs text-muted">Mostrando las primeras 200 filas del análisis.</p>
          )}
        </div>
      )}

      {result && (
        <div className={result.errores?.length ? 'alert-warning' : 'alert-success'}>
          <p>
            Importadas <strong>{result.ok}</strong> de {result.filas} filas (modo: {result.modo}
            {result.formato ? `, formato: ${result.formato}` : ''}).
          </p>
          {result.ubicacionDestino && (
            <p className="mt-1 text-sm">
              Ubicación destino: <span className="font-mono">{result.ubicacionDestino}</span>
            </p>
          )}
          {result.formato === 'siscom' && (
            <p className="mt-2 text-sm">
              Para mover a otra ubicación: Editor de Stock → Editar existente → cambiá almacén /
              armario / estante / contenedor y guardá.
            </p>
          )}
          {result.errores?.length > 0 && (
            <ul className="mt-2 max-h-40 list-inside list-disc overflow-y-auto text-sm">
              {result.errores.slice(0, 20).map((err) => (
                <li key={err.linea}>
                  Línea {err.linea}: {err.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
