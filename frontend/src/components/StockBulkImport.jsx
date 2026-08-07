import { useEffect, useMemo, useState } from 'react';
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
 * SISCOM: DEPOSITO 11.41 → A11-E41 en el almacén elegido.
 */
export default function StockBulkImport({ onImported }) {
  const { sede, sedeNombre } = useAuth();
  const [spec, setSpec] = useState(null);
  const [almacenes, setAlmacenes] = useState([]);
  const [almacen, setAlmacen] = useState('');
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState('');
  const [modo, setModo] = useState('agregar');
  const [forzarAduana, setForzarAduana] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.importEspecificacion().then(setSpec).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cat = await api.catalogoUbicacion(sede ? { sede } : {});
        if (cancelled) return;
        const list = cat.almacenes || [];
        setAlmacenes(list);
        const aduanaAlm = cat.aduanasPorSede?.[sede]?.almacen;
        const prefer =
          list.find((a) => a.codigo !== aduanaAlm)?.codigo || list[0]?.codigo || '';
        setAlmacen((prev) => (prev && list.some((a) => a.codigo === prev) ? prev : prefer));
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sede]);

  const almacenLabel = useMemo(() => {
    const a = almacenes.find((x) => x.codigo === almacen);
    return a ? `${a.codigo} — ${a.nombre}` : almacen || '—';
  }, [almacenes, almacen]);

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
      const data = await api.importPreview({
        csv,
        sede,
        forzarAduana,
        almacen: forzarAduana ? undefined : almacen || undefined,
      });
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
    if (preview && preview.invalidas > 0 && preview.validas === 0) {
      setError(
        'No hay filas válidas para importar. Revisá DEPOSITO (ej. 11.41) o activá “Forzar ingreso a aduana”.'
      );
      return;
    }
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
      const data = await api.importCsv({
        csv,
        modo,
        sede,
        forzarAduana,
        almacen: forzarAduana ? undefined : almacen || undefined,
      });
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
            Plantilla nativa o export SISCOM. <code className="text-xs">11.41</code> → gabinete{' '}
            <code className="text-xs">A11</code> + estante/gaveta <code className="text-xs">E41</code>.
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
        Sede: <strong className="text-accent">{sedeNombre || sede || '—'}</strong>
        {forzarAduana ? (
          <> — el stock entra en la <strong>aduana de recepción</strong>.</>
        ) : (
          <>
            {' '}
            — almacén destino: <strong className="font-mono text-accent">{almacenLabel}</strong>.
            DEPOSITO SISCOM se respeta como Axx-Exx (se crean gabinetes faltantes).
          </>
        )}
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

        {!forzarAduana && (
          <div>
            <label className="text-label">Almacén destino</label>
            <select
              className="input-field"
              value={almacen}
              onChange={(e) => {
                setAlmacen(e.target.value);
                setPreview(null);
              }}
              disabled={!almacenes.length}
            >
              {almacenes.map((a) => (
                <option key={a.codigo} value={a.codigo}>
                  {a.codigo} — {a.nombre}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted">
              Ahí se crean los gabinetes A11, A19, etc. según el DEPOSITO del archivo.
            </p>
          </div>
        )}

        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={forzarAduana}
            onChange={(e) => {
              setForzarAduana(e.target.checked);
              setPreview(null);
            }}
          />
          <span>
            <strong>Forzar ingreso a aduana</strong> — ignora DEPOSITO/armario/estante e ingresa
            todo en la recepción de {sedeNombre || sede || 'la sede'}. Solo si no querés respetar
            las ubicaciones SISCOM.
          </span>
        </label>

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
            {preview.almacen ? (
              <>
                {' '}
                · Almacén: <span className="font-mono text-accent">{preview.almacen}</span>
              </>
            ) : null}
            {preview.ubicacionDestino ? (
              <>
                {' '}
                · Destino: <span className="font-mono text-accent">{preview.ubicacionDestino}</span>
              </>
            ) : null}
          </p>
          {preview.armariosCreados?.length > 0 && (
            <p className="mb-2 text-sm text-muted">
              Gabinetes dados de alta:{" "}
              <span className="font-mono">{preview.armariosCreados.join(', ')}</span>
            </p>
          )}
          {preview.nota && (
            <p className="mb-3 text-sm text-amber-800 dark:text-amber-200">{preview.nota}</p>
          )}
          {preview.mapeosFrecuentes?.length > 0 && (
            <div className="mb-3 rounded border border-edge bg-surface-muted p-3 text-sm">
              <p className="mb-1 font-medium">Mapeo DEPOSITO → ubicación (muestra)</p>
              <ul className="list-inside list-disc space-y-0.5 font-mono text-xs">
                {preview.mapeosFrecuentes.map((m) => (
                  <li key={m.mapeo}>
                    {m.mapeo}
                    <span className="font-sans text-muted"> — {m.count} fila(s)</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {preview.erroresFrecuentes?.length > 0 && (
            <div className="mb-3 rounded border border-edge bg-surface-muted p-3 text-sm">
              <p className="mb-1 font-medium">Errores más frecuentes</p>
              <ul className="list-inside list-disc space-y-0.5">
                {preview.erroresFrecuentes.map((e) => (
                  <li key={e.error}>
                    <span className="text-red-700 dark:text-red-300">{e.error}</span>
                    <span className="text-muted"> — {e.count} fila(s)</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
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
                        ? r.ubicacion ||
                          `${r.almacen ? `${r.almacen}-` : ''}${r.armario}-${r.estante}${
                            r.contenedor ? `-${r.contenedor}` : ''
                          }`
                        : r.armarioArchivo || r.estanteArchivo
                          ? `${r.armarioArchivo || '?'}-${r.estanteArchivo || '?'}`
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
          {result.almacen && (
            <p className="mt-1 text-sm">
              Almacén: <span className="font-mono">{result.almacen}</span>
            </p>
          )}
          {result.armariosCreados?.length > 0 && (
            <p className="mt-1 text-sm">
              Gabinetes nuevos: <span className="font-mono">{result.armariosCreados.join(', ')}</span>
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
