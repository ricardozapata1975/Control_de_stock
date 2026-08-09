import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { api, getDocsUrl } from '../api/client';
import { useAuth } from '../auth/AuthProvider';

const IMPORT_BATCH = 150;
const AUTO_NEXT_SECONDS = 30;

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
  const first = lines[0].toLowerCase();
  const hasTitle =
    !first.includes('nombre') && !first.includes('descripcio') && !first.includes('existencia');
  return Math.max(0, lines.length - (hasTitle ? 2 : 1));
}

/**
 * Carga masiva: analizar → revisar lote (150) con errores → aplicar → siguiente lote.
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
  const [soloErrores, setSoloErrores] = useState(false);

  const [loteActual, setLoteActual] = useState(0);
  const [loteLog, setLoteLog] = useState([]);
  const [acumulado, setAcumulado] = useState({ ok: 0, errores: 0 });
  const [autoSecs, setAutoSecs] = useState(null);
  const autoCancelledRef = useRef(false);
  const aplicarLoteRef = useRef(null);

  const [purgeRows, setPurgeRows] = useState([]);
  const [purgeSelected, setPurgeSelected] = useState(() => new Set());
  const [purgeLoading, setPurgeLoading] = useState(false);
  const [purgeInfo, setPurgeInfo] = useState('');

  const cancelAutoNext = useCallback(() => {
    autoCancelledRef.current = true;
    setAutoSecs(null);
  }, []);

  const startAutoNext = useCallback(() => {
    autoCancelledRef.current = false;
    setAutoSecs(AUTO_NEXT_SECONDS);
  }, []);

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
        const especiales = new Set(
          list.filter((a) => a.esAduana || a.esReservados || a.esProduccion).map((a) => a.codigo)
        );
        const prefer =
          list.find((a) => !especiales.has(a.codigo))?.codigo || list[0]?.codigo || '';
        setAlmacen((prev) => (prev && list.some((a) => a.codigo === prev) ? prev : prefer));
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sede]);

  const totalFilas = preview?.filas || countDataRows(csv);
  const totalLotes = Math.max(1, Math.ceil((totalFilas || 1) / IMPORT_BATCH));
  const loteOffset = loteActual * IMPORT_BATCH;
  const lotePendiente = Boolean(preview) && loteActual < totalLotes;
  const loteDesde = Math.min(loteOffset + 1, totalFilas || 1);
  const loteHasta = Math.min(loteOffset + IMPORT_BATCH, totalFilas || 0);

  const loteRows = useMemo(() => {
    const all = preview?.preview || [];
    return all.slice(loteOffset, loteOffset + IMPORT_BATCH);
  }, [preview, loteOffset]);

  const loteStats = useMemo(() => {
    const ok = loteRows.filter((r) => r.ok).length;
    const bad = loteRows.length - ok;
    return { ok, bad, total: loteRows.length };
  }, [loteRows]);

  const loteRowsVisible = useMemo(() => {
    if (!soloErrores) return loteRows;
    return loteRows.filter((r) => !r.ok);
  }, [loteRows, soloErrores]);

  const almacenLabel = useMemo(() => {
    const a = almacenes.find((x) => x.codigo === almacen);
    return a ? `${a.codigo} — ${a.nombre}` : almacen || '—';
  }, [almacenes, almacen]);

  const resetLotes = () => {
    cancelAutoNext();
    setLoteActual(0);
    setLoteLog([]);
    setAcumulado({ ok: 0, errores: 0 });
    setResult(null);
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setPreview(null);
    resetLotes();
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
    const keepLote = loteActual;
    resetLotes();
    try {
      const data = await api.importPreview({
        csv,
        sede,
        forzarAduana,
        almacen: forzarAduana ? undefined : almacen,
      });
      setPreview(data);
      // Si re-analizás a mitad de camino, volvé al lote en curso (acotado)
      const maxLote = Math.max(0, Math.ceil((data.filas || 1) / IMPORT_BATCH) - 1);
      setLoteActual(Math.min(keepLote, maxLote));
    } catch (err) {
      setError(err.message);
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  const aplicarLote = async ({ auto = false } = {}) => {
    if (!csv.trim() || !preview) return;
    if (!forzarAduana && !almacen) {
      setError('Elegí un almacén destino');
      return;
    }
    if (!lotePendiente) {
      setError('No hay más lotes. Analizá de nuevo si hace falta.');
      return;
    }
    if (loteStats.ok === 0) {
      cancelAutoNext();
      setError(
        'Este lote no tiene filas OK. Corregí el CSV (o el depósito), pulsá Analizar otra vez y reintentá.'
      );
      return;
    }
    if (
      !auto &&
      loteStats.bad > 0 &&
      !window.confirm(
        `Este lote tiene ${loteStats.ok} OK y ${loteStats.bad} con error. ¿Aplicar solo las OK?`
      )
    ) {
      return;
    }

    cancelAutoNext();
    setLoading(true);
    setError('');
    try {
      const data = await api.importCsv({
        csv,
        modo: loteActual === 0 ? modo : 'agregar',
        sede,
        forzarAduana,
        almacen: forzarAduana ? undefined : almacen,
        offset: loteOffset,
        limit: IMPORT_BATCH,
      });

      const ok = data.ok || 0;
      const errN = data.errores?.length || 0;
      setLoteLog((prev) => [
        ...prev,
        {
          lote: loteActual + 1,
          ok,
          errores: errN,
          frecuentes: data.erroresFrecuentes || [],
          almacen: data.almacen,
        },
      ]);
      const nextOk = acumulado.ok + ok;
      const nextErr = acumulado.errores + errN;
      setAcumulado({ ok: nextOk, errores: nextErr });

      const next = loteActual + 1;
      setLoteActual(next);
      onImported?.(data);

      if (next >= totalLotes) {
        setResult({
          ok: nextOk,
          erroresCount: nextErr,
          filasTotales: data.filasTotales || totalFilas,
          lotes: next,
          almacen: data.almacen || almacen,
        });
      } else {
        // Mantener el backend despierto: auto-aplicar el siguiente lote en 30s.
        startAutoNext();
      }
    } catch (err) {
      setError(
        err.message ||
          'Falló el lote (¿backend dormido?). Esperá ~50s, reintentá o dejá que el conteo reintente.'
      );
      // Si falló por cold start, reabrir countdown para reintentar solo.
      startAutoNext();
    } finally {
      setLoading(false);
    }
  };

  aplicarLoteRef.current = aplicarLote;

  useEffect(() => {
    if (autoSecs == null) return undefined;
    if (autoSecs <= 0) {
      if (!autoCancelledRef.current && !loading) {
        aplicarLoteRef.current?.({ auto: true });
      }
      return undefined;
    }
    const t = setTimeout(() => {
      if (autoCancelledRef.current) return;
      setAutoSecs((s) => (s == null ? null : s - 1));
    }, 1000);
    return () => clearTimeout(t);
  }, [autoSecs, loading]);

  const loadPurgeList = async () => {
    if (!almacen) return;
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
    } finally {
      setPurgeLoading(false);
    }
  };

  const aplicarPurge = async (todoElAlmacen) => {
    if (!almacen) return;
    const ids = todoElAlmacen ? null : [...purgeSelected];
    if (!todoElAlmacen && !ids.length) {
      setError('Seleccioná filas o usá Vaciar almacén completo');
      return;
    }
    if (
      !window.confirm(
        todoElAlmacen ? `¿Vaciar todo ${almacen}?` : `¿Borrar ${ids.length} seleccionados?`
      )
    ) {
      return;
    }
    setPurgeLoading(true);
    try {
      const r = await api.adminPurgeAlmacenStock({
        almacen,
        stockIds: todoElAlmacen ? null : ids,
        deactivateOrphanItems: true,
        deleteEmptyContenedores: true,
      });
      setPurgeInfo(
        `Borrado: ${r.stockDeleted} stock · ${r.itemsDeactivated} ítems · ${r.contenedoresDeleted} contenedores`
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
            Analizá → revisá el lote ({IMPORT_BATCH} filas) → aplicá solo si está OK → siguiente.
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
        {' · '}
        Almacén: <strong className="font-mono text-accent">{almacenLabel}</strong>
      </div>

      {error && <div className="alert-error">{error}</div>}

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
          <label className="text-label">Almacén destino</label>
          <select
            className="input-field"
            value={almacen}
            onChange={(e) => {
              setAlmacen(e.target.value);
              setPreview(null);
              resetLotes();
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

        <div>
          <label className="text-label">Modo (solo primer lote)</label>
          <select className="input-field" value={modo} onChange={(e) => setModo(e.target.value)}>
            <option value="agregar">Agregar / sumar</option>
            {spec?.demoMode && <option value="reemplazar">Reemplazar (demo)</option>}
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
              resetLotes();
            }}
          />
          <span>
            <strong>Forzar ingreso a aduana</strong> — ignora DEPOSITO del archivo.
          </span>
        </label>

        <div>
          <label className="text-label">Contenido CSV (editá acá si hay que corregir depósitos)</label>
          <textarea
            className="input-field min-h-[100px] font-mono text-sm"
            value={csv}
            onChange={(e) => {
              setCsv(e.target.value);
              setPreview(null);
              resetLotes();
            }}
            placeholder="IDARTICULO,CODART,DESCRIPCIO,DEPOSITO,EXISTENCIA"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary flex-1"
            disabled={loading || !csv.trim()}
            onClick={() => {
              cancelAutoNext();
              analizar();
            }}
          >
            {loading && !preview ? 'Analizando…' : '1. Analizar archivo'}
          </button>
          <button
            type="button"
            className="btn-primary flex-1"
            disabled={loading || !preview || !lotePendiente || loteStats.ok === 0}
            onClick={() => aplicarLote({ auto: false })}
          >
            {loading
              ? `Aplicando lote ${loteActual + 1}…`
              : autoSecs != null && lotePendiente
                ? `2. Siguiente lote en ${autoSecs}s (${loteStats.ok} OK)`
                : lotePendiente
                  ? `2. Aplicar lote ${loteActual + 1}/${totalLotes} (${loteStats.ok} OK)`
                  : 'Todos los lotes aplicados'}
          </button>
          {autoSecs != null && lotePendiente && !loading && (
            <button type="button" className="btn-secondary" onClick={cancelAutoNext}>
              Cancelar auto ({autoSecs}s)
            </button>
          )}
        </div>
        {autoSecs != null && lotePendiente && (
          <p className="text-sm text-muted">
            Auto-avance en {autoSecs}s para que el backend no se duerma entre lotes. Podés cancelar o
            pulsar el botón para aplicar ya.
          </p>
        )}
      </div>

      {preview && (
        <div className="card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="font-medium">
                Lote {loteActual + 1}/{totalLotes} — filas {loteDesde}–{loteHasta}
              </h4>
              <p className="text-sm text-muted">
                En este lote: <strong className="text-emerald-700 dark:text-emerald-300">{loteStats.ok} OK</strong>
                {' · '}
                <strong className="text-red-700 dark:text-red-300">{loteStats.bad} error</strong>
                {' · '}
                Acumulado: {acumulado.ok} OK / {acumulado.errores} errores
              </p>
              <p className="text-xs text-muted">
                Archivo: {preview.validas} válidas · {preview.invalidas} con error · destino{' '}
                <span className="font-mono">{preview.almacen || almacen}</span>
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={soloErrores}
                onChange={(e) => setSoloErrores(e.target.checked)}
              />
              Solo ver errores del lote
            </label>
          </div>

          {loteStats.bad > 0 && (
            <p className="rounded border border-amber-400/60 bg-amber-500/10 px-3 py-2 text-sm">
              Corregí en el CSV los depósitos/filas en rojo (ej. <code>RACK 21</code> →{' '}
              <code>21.00</code>), pulsá <strong>Analizar</strong> otra vez y recién ahí aplicá el lote.
            </p>
          )}

          <div className="max-h-80 overflow-auto rounded border border-edge">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-surface-2">
                <tr>
                  <th className="px-2 py-1">Línea</th>
                  <th className="px-2 py-1">Estado</th>
                  <th className="px-2 py-1">Código</th>
                  <th className="px-2 py-1">Nombre</th>
                  <th className="px-2 py-1">Depósito</th>
                  <th className="px-2 py-1">Destino</th>
                  <th className="px-2 py-1">Cant.</th>
                  <th className="px-2 py-1">Error</th>
                </tr>
              </thead>
              <tbody>
                {loteRowsVisible.map((r) => (
                  <tr
                    key={r.linea}
                    className={`border-t border-edge ${r.ok ? '' : 'bg-red-500/10'}`}
                  >
                    <td className="px-2 py-1 font-mono">{r.linea}</td>
                    <td className="px-2 py-1">{r.ok ? 'OK' : 'Error'}</td>
                    <td className="px-2 py-1 font-mono">{r.codigoFabricante || '—'}</td>
                    <td className="px-2 py-1">{r.nombre || '—'}</td>
                    <td className="px-2 py-1 font-mono">{r.depositoOrigen || '—'}</td>
                    <td className="px-2 py-1 font-mono">
                      {r.ok
                        ? r.ubicacion ||
                          `${r.almacen || ''}-${r.armario}-${r.estante}`
                        : '—'}
                    </td>
                    <td className="px-2 py-1">{r.ok ? r.cantidad : '—'}</td>
                    <td className="px-2 py-1 text-red-700 dark:text-red-300">{r.error || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loteLog.length > 0 && (
        <div className="card">
          <p className="mb-2 text-sm font-medium">Lotes ya aplicados</p>
          <div className="max-h-40 overflow-auto text-xs">
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className="px-2 py-1">Lote</th>
                  <th className="px-2 py-1">OK</th>
                  <th className="px-2 py-1">Errores</th>
                  <th className="px-2 py-1">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {loteLog.map((l) => (
                  <tr key={l.lote} className="border-t border-edge">
                    <td className="px-2 py-1">{l.lote}</td>
                    <td className="px-2 py-1">{l.ok}</td>
                    <td className="px-2 py-1">{l.errores}</td>
                    <td className="px-2 py-1 text-muted">
                      {l.frecuentes?.[0]
                        ? `${l.frecuentes[0].error} (${l.frecuentes[0].count})`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card space-y-3">
        <h4 className="font-medium">Borrar stock del almacén</h4>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary text-sm"
            disabled={purgeLoading || !almacen}
            onClick={loadPurgeList}
          >
            Listar stock
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
          <div className="max-h-48 overflow-auto rounded border border-edge text-xs">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-surface-2">
                <tr>
                  <th className="px-2 py-1">
                    <input
                      type="checkbox"
                      checked={purgeSelected.size === purgeRows.length}
                      onChange={(e) =>
                        setPurgeSelected(
                          e.target.checked ? new Set(purgeRows.map((r) => r.stockId)) : new Set()
                        )
                      }
                    />
                  </th>
                  <th className="px-2 py-1">Código</th>
                  <th className="px-2 py-1">Nombre</th>
                  <th className="px-2 py-1">Ubicación</th>
                  <th className="px-2 py-1">Cant.</th>
                </tr>
              </thead>
              <tbody>
                {purgeRows.slice(0, 300).map((r) => (
                  <tr key={r.stockId} className="border-t border-edge">
                    <td className="px-2 py-1">
                      <input
                        type="checkbox"
                        checked={purgeSelected.has(r.stockId)}
                        onChange={() => {
                          setPurgeSelected((prev) => {
                            const n = new Set(prev);
                            if (n.has(r.stockId)) n.delete(r.stockId);
                            else n.add(r.stockId);
                            return n;
                          });
                        }}
                      />
                    </td>
                    <td className="px-2 py-1 font-mono">{r.codigoFabricante || '—'}</td>
                    <td className="px-2 py-1">{r.nombre}</td>
                    <td className="px-2 py-1 font-mono">{r.contenedorCodigo || '—'}</td>
                    <td className="px-2 py-1">{r.cantidad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {result && (
        <div className="alert-success">
          Terminado: <strong>{result.ok}</strong> OK de {result.filasTotales} en {result.lotes} lote(s)
          → {result.almacen}. Errores: {result.erroresCount}.
        </div>
      )}
    </div>
  );
}
