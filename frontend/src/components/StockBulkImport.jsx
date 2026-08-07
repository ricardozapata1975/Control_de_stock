import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { api, getDocsUrl } from '../api/client';
import { useAuth } from '../auth/AuthProvider';

const IMPORT_BATCH = 150;

function sheetToCsv(workbook) {
  const name = workbook.SheetNames?.[0];
  if (!name) throw new Error('El Excel no tiene hojas');
  return XLSX.utils.sheet_to_csv(workbook.Sheets[name]);
}

function countDataRows(csvText) {
  const lines = String(csvText || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim());
  if (lines.length < 2) return 0;
  // título + header (SISCOM) o solo header
  const first = lines[0].toLowerCase();
  const hasTitle = !first.includes('nombre') && !first.includes('descripcio') && !first.includes('existencia');
  return Math.max(0, lines.length - (hasTitle ? 2 : 1));
}

/**
 * Carga masiva CSV/XLS con análisis previo, import por lotes y vaciado de almacén.
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
  const [progress, setProgress] = useState('');
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const [purgeRows, setPurgeRows] = useState([]);
  const [purgeSelected, setPurgeSelected] = useState(() => new Set());
  const [purgeLoading, setPurgeLoading] = useState(false);
  const [purgeInfo, setPurgeInfo] = useState('');

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
    if (!forzarAduana && !almacen) {
      setError('Elegí un almacén destino');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    setProgress('');
    try {
      const data = await api.importPreview({
        csv,
        sede,
        forzarAduana,
        almacen: forzarAduana ? undefined : almacen,
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
    if (!forzarAduana && !almacen) {
      setError('Elegí un almacén destino');
      return;
    }
    if (preview && preview.invalidas > 0 && preview.validas === 0) {
      setError('No hay filas válidas para importar.');
      return;
    }
    const totalApprox = preview?.filas || countDataRows(csv);
    if (
      !window.confirm(
        `¿Importar ~${totalApprox} filas a ${forzarAduana ? 'aduana' : almacen} en lotes de ${IMPORT_BATCH}?`
      )
    ) {
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    const aggregated = {
      ok: 0,
      errores: [],
      filas: 0,
      filasTotales: totalApprox,
      modo,
      formato: preview?.formato || 'siscom',
      almacen: forzarAduana ? null : almacen,
      armariosCreados: [],
      lotes: 0,
    };

    try {
      let offset = 0;
      let done = false;
      while (!done) {
        setProgress(`Importando lote ${aggregated.lotes + 1} (filas ${offset + 1}–${offset + IMPORT_BATCH})…`);
        const data = await api.importCsv({
          csv,
          modo: offset === 0 ? modo : 'agregar',
          sede,
          forzarAduana,
          almacen: forzarAduana ? undefined : almacen,
          offset,
          limit: IMPORT_BATCH,
        });
        aggregated.lotes += 1;
        aggregated.ok += data.ok || 0;
        aggregated.filas += data.filas || 0;
        aggregated.filasTotales = data.filasTotales ?? aggregated.filasTotales;
        aggregated.formato = data.formato || aggregated.formato;
        aggregated.almacen = data.almacen || aggregated.almacen;
        if (data.armariosCreados?.length) {
          aggregated.armariosCreados = [
            ...new Set([...aggregated.armariosCreados, ...data.armariosCreados]),
          ];
        }
        if (data.errores?.length) aggregated.errores.push(...data.errores);

        const batchSize = data.filas || 0;
        offset += IMPORT_BATCH;
        if (batchSize < IMPORT_BATCH || offset >= (data.filasTotales || 0)) {
          done = true;
        }
      }

      const counts = {};
      for (const e of aggregated.errores) {
        counts[e.error] = (counts[e.error] || 0) + 1;
      }
      aggregated.erroresFrecuentes = Object.entries(counts)
        .map(([error, count]) => ({ error, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      setResult(aggregated);
      setPreview(null);
      onImported?.(aggregated);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  const loadPurgeList = async () => {
    if (!almacen) {
      setError('Elegí un almacén para listar/borrar stock');
      return;
    }
    setPurgeLoading(true);
    setPurgeInfo('');
    setError('');
    try {
      const data = await api.adminStockByAlmacen(almacen);
      setPurgeRows(data.rows || []);
      setPurgeSelected(new Set((data.rows || []).map((r) => r.stockId)));
      setPurgeInfo(`${data.total || 0} fila(s) de stock en ${almacen}`);
    } catch (err) {
      setError(err.message);
      setPurgeRows([]);
      setPurgeSelected(new Set());
    } finally {
      setPurgeLoading(false);
    }
  };

  const togglePurge = (id) => {
    setPurgeSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllPurge = (checked) => {
    if (checked) setPurgeSelected(new Set(purgeRows.map((r) => r.stockId)));
    else setPurgeSelected(new Set());
  };

  const aplicarPurge = async (todoElAlmacen) => {
    if (!almacen) return;
    const ids = todoElAlmacen ? null : [...purgeSelected];
    if (!todoElAlmacen && !ids.length) {
      setError('Seleccioná al menos una fila, o usá “Vaciar almacén completo”');
      return;
    }
    const msg = todoElAlmacen
      ? `¿Borrar TODO el stock de ${almacen}? Esta acción no se puede deshacer.`
      : `¿Borrar ${ids.length} fila(s) seleccionada(s) de ${almacen}?`;
    if (!window.confirm(msg)) return;

    setPurgeLoading(true);
    setError('');
    setPurgeInfo('');
    try {
      const r = await api.adminPurgeAlmacenStock({
        almacen,
        stockIds: todoElAlmacen ? null : ids,
        deactivateOrphanItems: true,
        deleteEmptyContenedores: true,
      });
      setPurgeInfo(
        `Borrado: ${r.stockDeleted} stock · ${r.itemsDeactivated} ítems desactivados · ${r.contenedoresDeleted} contenedores`
      );
      setPurgeRows([]);
      setPurgeSelected(new Set());
      onImported?.(r);
    } catch (err) {
      setError(err.message);
    } finally {
      setPurgeLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="section-title">Carga masiva (CSV / Excel)</h3>
          <p className="text-sm text-muted">
            SISCOM <code className="text-xs">11.41</code> → <code className="text-xs">A11-E41</code>. Importa
            en lotes de {IMPORT_BATCH} filas.
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
          <> — aduana de recepción.</>
        ) : (
          <>
            {' '}
            — almacén: <strong className="font-mono text-accent">{almacenLabel}</strong>
          </>
        )}
      </div>

      {error && <div className="alert-error">{error}</div>}
      {progress && <div className="rounded border border-edge bg-surface-muted px-3 py-2 text-sm">{progress}</div>}

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
          <label className="text-label">Almacén destino</label>
          <select
            className="input-field"
            value={almacen}
            onChange={(e) => {
              setAlmacen(e.target.value);
              setPreview(null);
              setPurgeRows([]);
            }}
            disabled={!almacenes.length || forzarAduana}
          >
            {almacenes.map((a) => (
              <option key={a.codigo} value={a.codigo}>
                {a.codigo} — {a.nombre}
              </option>
            ))}
          </select>
        </div>

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
            <strong>Forzar ingreso a aduana</strong> — ignora DEPOSITO del archivo.
          </span>
        </label>

        <div>
          <label className="text-label">Contenido (tabla CSV)</label>
          <textarea
            className="input-field min-h-[140px] font-mono text-sm"
            value={csv}
            onChange={(e) => {
              setCsv(e.target.value);
              setPreview(null);
              setResult(null);
            }}
            placeholder="IDARTICULO,CODART,DESCRIPCIO,DEPOSITO,EXISTENCIA"
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
            {loading && preview ? 'Aplicando…' : `Aplicar por lotes (${IMPORT_BATCH})`}
          </button>
        </div>
      </div>

      {/* Vaciar stock */}
      <div className="card space-y-3">
        <h4 className="font-medium">Borrar stock del almacén</h4>
        <p className="text-sm text-muted">
          Para empezar de cero antes de reimportar (ej. Ballester / {almacen || 'ALMxx'}). También
          desaparece del inventario de otras sedes.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary text-sm"
            disabled={purgeLoading || !almacen}
            onClick={loadPurgeList}
          >
            {purgeLoading ? 'Cargando…' : 'Listar stock del almacén'}
          </button>
          <button
            type="button"
            className="btn-secondary text-sm text-red-700 dark:text-red-300"
            disabled={purgeLoading || !almacen}
            onClick={() => aplicarPurge(true)}
          >
            Vaciar almacén completo
          </button>
          <button
            type="button"
            className="btn-secondary text-sm"
            disabled={purgeLoading || !purgeSelected.size}
            onClick={() => aplicarPurge(false)}
          >
            Borrar seleccionados ({purgeSelected.size})
          </button>
        </div>
        {purgeInfo && <p className="text-sm text-muted">{purgeInfo}</p>}
        {purgeRows.length > 0 && (
          <div className="max-h-64 overflow-auto rounded border border-edge">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-surface-2">
                <tr>
                  <th className="px-2 py-1">
                    <input
                      type="checkbox"
                      checked={purgeSelected.size === purgeRows.length && purgeRows.length > 0}
                      onChange={(e) => toggleAllPurge(e.target.checked)}
                    />
                  </th>
                  <th className="px-2 py-1">Código</th>
                  <th className="px-2 py-1">Nombre</th>
                  <th className="px-2 py-1">Ubicación</th>
                  <th className="px-2 py-1">Cant.</th>
                </tr>
              </thead>
              <tbody>
                {purgeRows.slice(0, 500).map((r) => (
                  <tr key={r.stockId} className="border-t border-edge">
                    <td className="px-2 py-1">
                      <input
                        type="checkbox"
                        checked={purgeSelected.has(r.stockId)}
                        onChange={() => togglePurge(r.stockId)}
                      />
                    </td>
                    <td className="px-2 py-1 font-mono">{r.codigoFabricante || '—'}</td>
                    <td className="px-2 py-1">{r.nombre}</td>
                    <td className="px-2 py-1 font-mono">
                      {r.contenedorCodigo || `${r.almacen}-${r.armario}-${r.estante}`}
                    </td>
                    <td className="px-2 py-1">{r.cantidad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {purgeRows.length > 500 && (
              <p className="p-2 text-xs text-muted">Mostrando 500 de {purgeRows.length}. “Vaciar completo” borra todas.</p>
            )}
          </div>
        )}
      </div>

      {preview && (
        <div className={`card ${preview.invalidas ? 'border-amber-400' : 'border-emerald-400'}`}>
          <p className="mb-1 font-medium">
            Análisis: {preview.validas} válidas · {preview.invalidas} con error · {preview.filas} filas
          </p>
          <p className="mb-2 text-sm text-muted">
            Formato: <strong>{preview.formato}</strong>
            {preview.almacen ? (
              <>
                {' '}
                · Almacén: <span className="font-mono text-accent">{preview.almacen}</span>
              </>
            ) : null}
          </p>
          {preview.nota && (
            <p className="mb-3 text-sm text-amber-800 dark:text-amber-200">{preview.nota}</p>
          )}
          {preview.mapeosFrecuentes?.length > 0 && (
            <div className="mb-3 rounded border border-edge bg-surface-muted p-3 text-sm">
              <p className="mb-1 font-medium">Mapeo DEPOSITO → ubicación</p>
              <ul className="list-inside list-disc font-mono text-xs">
                {preview.mapeosFrecuentes.map((m) => (
                  <li key={m.mapeo}>
                    {m.mapeo} <span className="font-sans text-muted">({m.count})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {preview.erroresFrecuentes?.length > 0 && (
            <div className="mb-3 rounded border border-edge bg-surface-muted p-3 text-sm">
              <p className="mb-1 font-medium">Errores frecuentes</p>
              <ul className="list-inside list-disc">
                {preview.erroresFrecuentes.map((e) => (
                  <li key={e.error}>
                    <span className="text-red-700 dark:text-red-300">{e.error}</span> — {e.count}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {result && (
        <div className={result.errores?.length ? 'alert-warning' : 'alert-success'}>
          <p>
            Importadas <strong>{result.ok}</strong> de {result.filasTotales || result.filas} filas
            {result.lotes ? ` en ${result.lotes} lote(s)` : ''}
            {result.almacen ? ` → ${result.almacen}` : ''}.
          </p>
          {result.armariosCreados?.length > 0 && (
            <p className="mt-1 text-sm font-mono">Gabinetes: {result.armariosCreados.join(', ')}</p>
          )}
          {result.erroresFrecuentes?.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-sm">
              {result.erroresFrecuentes.map((e) => (
                <li key={e.error}>
                  {e.error} — {e.count}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
