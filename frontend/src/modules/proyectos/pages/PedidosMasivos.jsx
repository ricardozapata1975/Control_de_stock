import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthProvider';
import { parsePedidoCsv, parsePedidoRows, pedidoLineasToCsv } from '../constants';
import { fieldLabel } from '../../../utils/fieldLabels';
import CodigoCatalogoLink from '../../../components/CodigoCatalogoLink';

function sheetToPedidoRows(workbook) {
  const name = workbook.SheetNames?.[0];
  if (!name) throw new Error('El Excel no tiene hojas');
  return XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: '' });
}

export default function PedidosMasivos() {
  const { sede } = useAuth();
  const [params] = useSearchParams();
  const [proyectos, setProyectos] = useState([]);
  const [proyectoId, setProyectoId] = useState(params.get('proyectoId') || '');
  const [tableroId, setTableroId] = useState('');
  const [tableros, setTableros] = useState([]);
  const [raw, setRaw] = useState('codigo,cantidad\n');
  const [fileName, setFileName] = useState('');
  const [previewMatch, setPreviewMatch] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [crearItemsFaltantes, setCrearItemsFaltantes] = useState(false);

  useEffect(() => {
    api.proyectos(sede ? { sede } : {}).then((d) => setProyectos(d.proyectos || []));
  }, [sede]);

  useEffect(() => {
    if (!proyectoId) {
      setTableros([]);
      setTableroId('');
      return;
    }
    api.proyecto(proyectoId).then((d) => {
      setTableros(d.tableros || []);
    });
  }, [proyectoId]);

  const lineas = useMemo(() => parsePedidoCsv(raw), [raw]);
  const preview = useMemo(() => lineas.slice(0, 25), [lineas]);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setPreviewMatch(null);
    setResult(null);
    setFileName(file.name);
    const lower = file.name.toLowerCase();
    try {
      if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const parsed = parsePedidoRows(sheetToPedidoRows(wb));
        if (!parsed.length) {
          throw new Error('No se encontraron filas codigo/cantidad en la primera hoja');
        }
        setRaw(pedidoLineasToCsv(parsed));
      } else {
        setRaw(await file.text());
      }
    } catch (err) {
      setError(err.message || 'No se pudo leer el archivo');
      setFileName('');
    }
  };

  const analizar = async () => {
    setError('');
    setResult(null);
    setPreviewMatch(null);
    if (!proyectoId) {
      setError('Seleccioná un proyecto');
      return;
    }
    if (!lineas.length) {
      setError('No hay líneas válidas (codigo,cantidad)');
      return;
    }
    setPreviewing(true);
    try {
      const data = await api.pedidoMasivoPreview({
        proyectoId,
        lineas,
      });
      setPreviewMatch(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setPreviewing(false);
    }
  };

  const submit = async () => {
    setError('');
    setResult(null);
    if (!proyectoId) {
      setError('Seleccioná un proyecto');
      return;
    }
    if (!lineas.length) {
      setError('No hay líneas válidas (codigo,cantidad)');
      return;
    }
    setLoading(true);
    try {
      const data = await api.pedidoMasivoProyecto({
        proyectoId,
        tableroId: tableroId || undefined,
        lineas,
        archivoNombre: fileName || 'manual.csv',
        crearItemsFaltantes,
      });
      setResult(data);
      setPreviewMatch(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resumenPrev = previewMatch?.resumen;

  return (
    <div className="space-y-4">
      <h2 className="section-title">Pedidos masivos</h2>
      <p className="text-sm text-muted">
        Importá CSV o Excel (primera hoja: código MLFB + cantidad, con o sin encabezado). El sistema
        valida artículos, reserva stock disponible (limbo) y genera faltantes — sin descontar el
        stock físico del inventario.
      </p>

      {error && <div className="alert-error">{error}</div>}

      <div className="card grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-label">{fieldLabel('proyecto', { required: true })}</label>
          <select
            className="input-field"
            value={proyectoId}
            onChange={(e) => setProyectoId(e.target.value)}
          >
            <option value="">Elegí…</option>
            {proyectos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-label">{fieldLabel('tablero')}</label>
          <select
            className="input-field"
            value={tableroId}
            onChange={(e) => setTableroId(e.target.value)}
            disabled={!tableros.length}
          >
            <option value="">Sin tablero</option>
            {tableros.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="text-label">Archivo CSV / Excel</label>
          <input
            type="file"
            accept=".csv,.txt,.tsv,.xlsx,.xls"
            className="input-field"
            onChange={onFile}
          />
          {fileName && <p className="mt-1 text-xs text-muted">{fileName}</p>}
        </div>
        <div className="sm:col-span-2">
          <label className="text-label">Contenido (editable)</label>
          <textarea
            className="input-field font-mono text-sm"
            rows={8}
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              setPreviewMatch(null);
            }}
          />
          <p className="mt-1 text-xs text-muted">{lineas.length} líneas válidas detectadas</p>
        </div>
      </div>

      {preview.length > 0 && !previewMatch && (
        <div className="card text-sm">
          <p className="mb-2 text-muted">Vista previa rápida ({preview.length} de {lineas.length})</p>
          <ul className="max-h-40 overflow-y-auto font-mono">
            {preview.map((l, i) => (
              <li key={`${l.codigo}-${i}`}>
                {l.codigo} → {l.cantidad}
              </li>
            ))}
          </ul>
        </div>
      )}

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={crearItemsFaltantes}
          onChange={(e) => setCrearItemsFaltantes(e.target.checked)}
        />
        <span>
          Crear ítems nuevos si el MLFB no existe (sin stock; quedan como faltante de compra). Útil
          para los códigos del pedido que aún no están en el catálogo.
        </span>
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-secondary"
          disabled={previewing || loading || !lineas.length}
          onClick={analizar}
        >
          {previewing ? 'Analizando…' : '1. Analizar match / faltantes'}
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={loading || previewing || !lineas.length}
          onClick={submit}
        >
          {loading ? 'Procesando…' : '2. Procesar pedido (reservar)'}
        </button>
      </div>

      {previewMatch && (
        <div className="card space-y-3">
          <h3 className="section-title">Análisis (sin reservar)</h3>
          <p className="text-sm">
            OK: <strong className="text-emerald-600 dark:text-emerald-300">{resumenPrev?.ok || 0}</strong>
            {' · '}
            Parcial:{' '}
            <strong className="text-amber-600 dark:text-amber-300">{resumenPrev?.parcial || 0}</strong>
            {' · '}
            Sin ítem:{' '}
            <strong className="text-red-600 dark:text-red-300">{resumenPrev?.sinItem || 0}</strong>
            {' · '}
            Faltante total u.: <strong>{resumenPrev?.totalFaltante || 0}</strong>
            {' · '}
            Reservable u.: <strong>{resumenPrev?.totalReservable || 0}</strong>
          </p>
          <div className="max-h-72 overflow-auto rounded border border-edge">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-2 sticky top-0">
                <tr>
                  <th className="px-2 py-1">{fieldLabel('codigo')}</th>
                  <th className="px-2 py-1">{fieldLabel('nombre')}</th>
                  <th className="px-2 py-1 text-right">{fieldLabel('cantidad')}</th>
                  <th className="px-2 py-1 text-right">{fieldLabel('neto')}</th>
                  <th className="px-2 py-1 text-right">{fieldLabel('reservado')}</th>
                  <th className="px-2 py-1 text-right">{fieldLabel('faltante')}</th>
                  <th className="px-2 py-1">{fieldLabel('estado')}</th>
                </tr>
              </thead>
              <tbody>
                {(previewMatch.lineas || []).map((l, i) => (
                  <tr
                    key={`${l.codigo}-${i}`}
                    className={
                      l.estado === 'ok'
                        ? 'border-t border-edge'
                        : l.estado === 'parcial'
                          ? 'border-t border-edge bg-amber-500/10'
                          : 'border-t border-edge bg-red-500/10'
                    }
                  >
                    <td className="px-2 py-1">
                      <CodigoCatalogoLink codigo={l.codigo} className="text-xs" />
                    </td>
                    <td className="px-2 py-1">{l.nombre || '—'}</td>
                    <td className="px-2 py-1 text-right">{l.cantidad}</td>
                    <td className="px-2 py-1 text-right">{l.disponible}</td>
                    <td className="px-2 py-1 text-right">{l.reservable}</td>
                    <td className="px-2 py-1 text-right">{l.faltante}</td>
                    <td className="px-2 py-1">{l.estado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result && (
        <div className="card border-emerald-500/40">
          <h3 className="section-title mb-2">Resultado</h3>
          <p className="text-sm">
            Válidas: {result.pedido?.resumen?.validas} · Inválidas:{' '}
            {result.pedido?.resumen?.invalidas} · Reservado:{' '}
            {result.pedido?.resumen?.totalReservado} · Faltante:{' '}
            {result.pedido?.resumen?.totalFaltante}
            {result.pedido?.resumen?.itemsCreados
              ? ` · Ítems creados: ${result.pedido.resumen.itemsCreados}`
              : ''}
          </p>
          <ul className="mt-3 max-h-60 space-y-1 overflow-y-auto text-sm">
            {(result.lineas || []).map((l) => (
              <li key={l.id} className="flex justify-between border-b border-border py-1">
                <span>
                  {l.codigo}{' '}
                  {l.error ? (
                    <span className="text-red-500">({l.error})</span>
                  ) : (
                    <span className="text-muted">
                      res {l.reservado} / fal {l.faltante}
                    </span>
                  )}
                </span>
                <span>{l.cantidad}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
