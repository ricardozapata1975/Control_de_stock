import { useMemo, useState } from 'react';
import { api } from '../api/client';
import {
  filterRowsToStock,
  parseCatalogWorkbook,
} from '../utils/catalogEnrichParse';

/**
 * Importa listas Siemens / Sivacon y rellena campos de catálogo en ítems existentes
 * (match por codigo_fabricante / MLFB).
 */
export default function CatalogEnrichImport({ items = [], onApplied }) {
  const [tip, setTip] = useState('auto');
  const [modo, setModo] = useState('rellenar');
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const stockCodes = useMemo(() => {
    const set = new Set();
    for (const it of items) {
      const c = String(it.codigoFabricante || '')
        .trim()
        .toUpperCase();
      if (c) set.add(c);
    }
    return set;
  }, [items]);

  const localMatch = useMemo(() => {
    if (!parsed?.rows?.length) return null;
    return filterRowsToStock(parsed.rows, stockCodes);
  }, [parsed, stockCodes]);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setPreview(null);
    setResult(null);
    setParsed(null);
    setFileName(file.name);
    setLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const data = parseCatalogWorkbook(buf, tip);
      if (!data.rows?.length) {
        throw new Error('No se leyeron filas de catálogo. Probá el tipo Siemens o Sivacon manualmente.');
      }
      setParsed(data);
    } catch (err) {
      setError(err.message || 'No se pudo leer el archivo');
      setFileName('');
    } finally {
      setLoading(false);
    }
  };

  const rowsForApi = localMatch?.matched || [];

  const analizar = async () => {
    if (!rowsForApi.length) {
      setError('No hay códigos del catálogo que coincidan con ítems en stock (codigo_fabricante).');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await api.catalogEnrichPreview({
        fuente: parsed.fuente,
        vigencia: parsed.vigencia,
        modo,
        rows: rowsForApi,
      });
      setPreview(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const aplicar = async () => {
    if (!rowsForApi.length) return;
    if (
      !window.confirm(
        `¿Aplicar catálogo (${modo}) a ${rowsForApi.length} ítems con match? Esto actualiza campos de catálogo en la base.`
      )
    ) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      const CHUNK = 400;
      let actualizados = 0;
      let erroresCount = 0;
      const errores = [];
      for (let i = 0; i < rowsForApi.length; i += CHUNK) {
        const slice = rowsForApi.slice(i, i + CHUNK);
        const data = await api.catalogEnrichApply({
          fuente: parsed.fuente,
          vigencia: parsed.vigencia,
          modo,
          rows: slice,
        });
        actualizados += data.actualizados || 0;
        erroresCount += data.erroresCount || 0;
        if (data.errores?.length) errores.push(...data.errores);
      }
      const data = { actualizados, erroresCount, errores: errores.slice(0, 40), fuente: parsed.fuente, modo };
      setResult(data);
      onApplied?.(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="section-title text-base">Enriquecer catálogo (Siemens / Sivacon)</h3>
        <p className="text-sm text-muted">
          Subí la lista de precios Siemens AR o el pricelist Sivacon S8. Se cruzan por{' '}
          <strong>código fabricante (MLFB)</strong> con los ítems ya cargados y se completan
          familia, precio, packing, peso, etc. No crea ítems nuevos ni mueve stock.
        </p>
      </div>

      {error && <div className="alert-error">{error}</div>}

      <div className="card grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-label">Tipo de archivo</label>
          <select className="input-field" value={tip} onChange={(e) => setTip(e.target.value)}>
            <option value="auto">Detectar automáticamente</option>
            <option value="siemens_ar">Lista Siemens AR</option>
            <option value="sivacon_s8">Pricelist Sivacon S8</option>
          </select>
        </div>
        <div>
          <label className="text-label">Modo de actualización</label>
          <select className="input-field" value={modo} onChange={(e) => setModo(e.target.value)}>
            <option value="rellenar">Solo rellenar vacíos</option>
            <option value="sobrescribir">Sobrescribir campos de catálogo</option>
            <option value="forzar">Forzar todo (incluye nombre)</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="text-label">Archivo Excel (.xlsx / .xls)</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            className="input-field"
            disabled={loading}
            onChange={onFile}
          />
          {fileName && <p className="mt-1 text-xs text-muted">{fileName}</p>}
        </div>
      </div>

      {parsed && localMatch && (
        <div className="card text-sm space-y-2">
          <p>
            Catálogo: <strong>{parsed.fuente}</strong>
            {parsed.vigencia ? ` · vigencia ${parsed.vigencia}` : ''} ·{' '}
            <strong>{parsed.rows.length}</strong> filas leídas
          </p>
          <p>
            Match con stock: <strong className="text-emerald-600 dark:text-emerald-300">{localMatch.matched.length}</strong>
            {' · '}
            Sin ítem en stock: <strong>{localMatch.unmatched}</strong>
            {' · '}
            Ítems con código fab.: <strong>{stockCodes.size}</strong>
          </p>
          <p className="text-xs text-muted">
            Tip: usá “Solo rellenar vacíos” la primera vez. “Sobrescribir” actualiza precios/familia
            sin tocar el nombre SISCOM. “Forzar” también puede reemplazar el nombre.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-secondary"
          disabled={loading || !rowsForApi.length}
          onClick={analizar}
        >
          {loading && !result ? 'Analizando…' : '1. Analizar cambios'}
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={loading || !rowsForApi.length}
          onClick={aplicar}
        >
          {loading ? 'Aplicando…' : `2. Aplicar a ${rowsForApi.length || 0} ítems`}
        </button>
      </div>

      {preview && (
        <div className="card space-y-2">
          <h4 className="font-medium">Preview servidor</h4>
          <p className="text-sm">
            Con cambios: <strong>{preview.conCambios}</strong> · Sin cambios:{' '}
            <strong>{preview.sinCambios}</strong> · Sin match: <strong>{preview.unmatched}</strong>
          </p>
          {preview.sample?.length > 0 && (
            <div className="max-h-56 overflow-auto rounded border border-edge">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-2 sticky top-0">
                  <tr>
                    <th className="px-2 py-1">Código</th>
                    <th className="px-2 py-1">Nombre actual</th>
                    <th className="px-2 py-1">Campos a actualizar</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.sample.map((s) => (
                    <tr key={s.itemId} className="border-t border-edge">
                      <td className="px-2 py-1 font-mono">{s.codigo}</td>
                      <td className="px-2 py-1">{s.nombreActual}</td>
                      <td className="px-2 py-1 font-mono">{s.campos.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {result && (
        <div className="card border-emerald-500/40 text-sm">
          <p>
            Actualizados: <strong>{result.actualizados}</strong>
            {result.erroresCount ? ` · Errores: ${result.erroresCount}` : ''}
          </p>
          {result.errores?.length > 0 && (
            <ul className="mt-2 max-h-32 overflow-auto font-mono text-xs text-red-600 dark:text-red-300">
              {result.errores.map((e) => (
                <li key={e.codigo}>
                  {e.codigo}: {e.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
