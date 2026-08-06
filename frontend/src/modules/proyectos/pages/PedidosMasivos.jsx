import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthProvider';
import { parsePedidoCsv } from '../constants';

export default function PedidosMasivos() {
  const { sede } = useAuth();
  const [params] = useSearchParams();
  const [proyectos, setProyectos] = useState([]);
  const [proyectoId, setProyectoId] = useState(params.get('proyectoId') || '');
  const [tableroId, setTableroId] = useState('');
  const [tableros, setTableros] = useState([]);
  const [raw, setRaw] = useState('codigo,cantidad\n');
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

  const preview = useMemo(() => parsePedidoCsv(raw).slice(0, 20), [raw]);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    setRaw(text);
  };

  const submit = async () => {
    setError('');
    setResult(null);
    const lineas = parsePedidoCsv(raw);
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
      });
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="section-title">Pedidos masivos</h2>
      <p className="text-sm text-muted">
        Importá CSV/texto con columnas <strong>codigo,cantidad</strong>. El sistema valida
        artículos, reserva stock disponible (limbo) y genera faltantes — sin descontar el stock
        físico del inventario.
      </p>

      {error && <div className="alert-error">{error}</div>}

      <div className="card grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-label">Proyecto *</label>
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
          <label className="text-label">Tablero (opcional)</label>
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
          <label className="text-label">Archivo CSV</label>
          <input type="file" accept=".csv,.txt,.tsv" className="input-field" onChange={onFile} />
        </div>
        <div className="sm:col-span-2">
          <label className="text-label">Contenido</label>
          <textarea
            className="input-field font-mono text-sm"
            rows={8}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
          />
        </div>
      </div>

      {preview.length > 0 && (
        <div className="card text-sm">
          <p className="mb-2 text-muted">Vista previa ({preview.length} líneas)</p>
          <ul className="max-h-40 overflow-y-auto font-mono">
            {preview.map((l, i) => (
              <li key={`${l.codigo}-${i}`}>
                {l.codigo} → {l.cantidad}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button type="button" className="btn-primary" disabled={loading} onClick={submit}>
        {loading ? 'Procesando…' : 'Procesar pedido'}
      </button>

      {result && (
        <div className="card border-emerald-500/40">
          <h3 className="section-title mb-2">Resultado</h3>
          <p className="text-sm">
            Válidas: {result.pedido?.resumen?.validas} · Inválidas:{' '}
            {result.pedido?.resumen?.invalidas} · Reservado:{' '}
            {result.pedido?.resumen?.totalReservado} · Faltante:{' '}
            {result.pedido?.resumen?.totalFaltante}
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
