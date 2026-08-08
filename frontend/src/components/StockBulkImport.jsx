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
  const first = lines[0].toLowerCase();
  const hasTitle =
    !first.includes('nombre') && !first.includes('descripcio') && !first.includes('existencia');
  return Math.max(0, lines.length - (hasTitle ? 2 : 1));
}

/**
 * Carga masiva: análisis, aplicación lote a lote (manual) y vaciado de almacén.
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

  const [loteActual, setLoteActual] = useState(0);
  const [loteLog, setLoteLog] = useState([]);
  const [acumulado, setAcumulado] = useState({ ok: 0, errores: 0 });

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

  const totalFilas = preview?.filas || countDataRows(csv);
  const totalLotes = Math.max(1, Math.ceil(totalFilas / IMPORT_BATCH));
  const loteOffset = loteActual * IMPORT_BATCH;
  const lotePendiente = loteActual < totalLotes;
  const loteDesde = loteOffset + 1;
  const loteHasta = Math.min(loteOffset + IMPORT_BATCH, totalFilas);

  const almacenLabel = useMemo(() => {
    const a = almacenes.find((x) => x.codigo === almacen);
    return a ? `${a.codigo} — ${a.nombre}` : almacen || '—';
  }, [almacenes, almacen]);

  const resetLotes = () => {
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
    resetLotes();
    try {
      const data = await api.importPreview({
        csv,
        sede,
        forzarAduana,
        almacen: forzarAduana ? undefined : almacen,
      });
      setPreview(data);
      setLoteActual(0);
    } catch (err) {
      setError(err.message);
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  const aplicarLote = async () => {
    if (!csv.trim()) return;
    if (!forzarAduana && !almacen) {
      setError('Elegí un almacén destino');
      return;
    }
    if (!lotePendiente) {
      setError('No hay más lotes pendientes. Analizá de nuevo o cargá otro archivo.');
      return;
    }

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
      const entry = {
        lote: loteActual + 1,
        offset: loteOffset,
        ok,
        errores: errN,
        almacen: data.almacen,
        frecuentes: data.erroresFrecuentes || [],
      };
      setLoteLog((prev) => [...prev, entry]);
      setAcumulado((prev) => ({
        ok: prev.ok + ok,
        errores: prev.errores + errN,
      }));

      const next = loteActual + 1;
      setLoteActual(next);

      if (next >= totalLotes) {
        setResult({
          ok: acumulado.ok + ok,
          erroresCount: acumulado.errores + errN,
          filasTotales: data.filasTotales || totalFilas,
          lotes: next,
          almacen: data.almacen || almacen,
          formato: data.formato,
        });
        onImported?.(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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
      ? `¿Borrar TODO el stock de ${almacen}?`
      : `¿Borrar ${ids.length} fila(s) de ${almacen}?`;
    if (!window.confirm(msg)) return;

    setPurgeLoading(true);
    setError('');
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
            Analizá el archivo y aplicá <strong>un lote por vez</strong> ({IMPORT_BATCH} filas).
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
          <label className="text-label">Contenido CSV</label>
          <textarea
            className="input-field min-h-[120px] font-mono text-sm"
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
            onClick={analizar}
          >
            {loading && !loteLog.length ? 'Analizando…' : '1. Analizar'}
          </button>
          <button
            type="button"
            className="btn-primary flex-1"
            disabled={loading || !csv.trim() || !preview || !lotePendiente}
            onClick={aplicarLote}
          >
            {loading
              ? `Aplicando lote ${loteActual + 1}…`
              : lotePendiente
                ? `2. Aplicar lote ${loteActual + 1}/${totalLotes} (filas ${loteDesde}–${loteHasta})`
                : 'Todos los lotes aplicados'}
          </button>
        </div>

        {(preview || loteLog.length > 0) && (
          <div className="rounded border border-edge bg-surface-muted p-3 text-sm">
            <p>
              Progreso: lote <strong>{Math.min(loteActual + (lotePendiente ? 0 : 0), totalLotes)}</strong> /{' '}
              {totalLotes} · OK acumulados: <strong>{acumulado.ok}</strong> · Errores:{' '}
              <strong>{acumulado.errores}</strong>
            </p>
            {preview && (
              <p className="mt-1 text-muted">
                Análisis: {preview.validas} válidas · {preview.invalidas} con error · destino{' '}
                <span className="font-mono">{preview.almacen || almacen}</span>
              </p>
            )}
          </div>
        )}

        {loteLog.length > 0 && (
          <div className="max-h-48 overflow-auto rounded border border-edge text-xs">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-surface-2">
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
        )}
      </div>

      <div className="card space-y-3">
        <h4 className="font-medium">Borrar stock del almacén</h4>
        <p className="text-sm text-muted">
          Vaciar {almacen || 'ALMxx'} antes de reimportar (desaparece también en otras sedes).
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary text-sm"
            disabled={purgeLoading || !almacen}
            onClick={loadPurgeList}
          >
            Listar stock del almacén
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
          </div>
        )}
      </div>

      {preview?.erroresFrecuentes?.length > 0 && loteLog.length === 0 && (
        <div className="card border-amber-400 text-sm">
          <p className="mb-1 font-medium">Errores del análisis (no bloquean aplicar lote a lote)</p>
          <ul className="list-inside list-disc">
            {preview.erroresFrecuentes.map((e) => (
              <li key={e.error}>
                {e.error} — {e.count}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result && (
        <div className="alert-success">
          Terminado: <strong>{result.ok}</strong> OK de {result.filasTotales} filas en {result.lotes}{' '}
          lote(s) → {result.almacen}. Errores acumulados: {result.erroresCount}.
        </div>
      )}
    </div>
  );
}
