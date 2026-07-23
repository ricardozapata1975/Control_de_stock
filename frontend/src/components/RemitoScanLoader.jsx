import { useState } from 'react';
import QrScanner from './QrScanner';
import { LaserBarcodeCapture } from './AssignBarcodeModal';
import { formatUbicacionLabel } from '../utils/contenedor';
import { resolveScanToInventario } from '../utils/resolveScan';

/**
 * Carga múltiple de ítems al remito por cámara o lector láser.
 * En cada lectura: confirma ítem → pide cantidad → "Leer otro" / "Finalizar".
 */
export default function RemitoScanLoader({ mode, onAddItem, onClose }) {
  const [phase, setPhase] = useState(mode === 'laser' ? 'laser' : 'camera'); // camera | laser | pick | qty | done-msg
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [cantidad, setCantidad] = useState(1);
  const [error, setError] = useState('');
  const [looking, setLooking] = useState(false);
  const [addedCount, setAddedCount] = useState(0);
  const [lastRaw, setLastRaw] = useState('');

  const resetToScan = () => {
    setCandidates([]);
    setSelected(null);
    setCantidad(1);
    setError('');
    setPhase(mode === 'laser' ? 'laser' : 'camera');
  };

  const handleResolved = (result) => {
    setLooking(false);
    setLastRaw(result.raw || '');
    if (!result.ok) {
      setError(result.error || 'No encontrado');
      setPhase('error');
      return;
    }
    const items = result.items || [];
    if (items.length === 1) {
      setSelected(items[0]);
      setCantidad(1);
      setCandidates([]);
      setPhase('qty');
      return;
    }
    setCandidates(items);
    setSelected(null);
    setPhase('pick');
  };

  const onScan = async (scan) => {
    setError('');
    setLooking(true);
    setPhase('looking');
    const result = await resolveScanToInventario(scan);
    handleResolved(result);
  };

  const confirmAdd = () => {
    if (!selected) return;
    const max = Number(selected.cantidad) || 0;
    const n = Math.max(1, Math.min(cantidad, max > 0 ? max : cantidad));
    onAddItem(selected, n);
    setAddedCount((c) => c + 1);
    setPhase('after');
  };

  return (
    <>
      {(phase === 'pick' || phase === 'qty' || phase === 'after' || phase === 'looking' || phase === 'error') && (
          <div className="fixed inset-0 z-[55] flex items-end justify-center bg-black/70 p-4 sm:items-center">
            <div className="card w-full max-w-md overflow-y-auto">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="section-title">Carga por escaneo</h3>
                <button type="button" className="text-2xl leading-none" onClick={onClose} aria-label="Cerrar">
                  ×
                </button>
              </div>

              {error && <p className="mb-3 text-sm text-amber-200">{error}</p>}

              {phase === 'looking' && (
                <p className="text-sm text-muted">Buscando ítem…</p>
              )}

              {phase === 'error' && (
                <div className="space-y-3">
                  <p className="text-sm text-amber-200">{error || 'No encontrado'}</p>
                  {lastRaw && (
                    <p className="font-mono text-xs text-subtle">Leído: {lastRaw}</p>
                  )}
                  <button type="button" className="btn-primary w-full min-h-[48px]" onClick={resetToScan}>
                    Reintentar
                  </button>
                  <button type="button" className="btn-secondary w-full" onClick={onClose}>
                    Finalizar carga
                  </button>
                </div>
              )}

              {phase === 'pick' && (
                <div className="space-y-3">
                  <p className="text-sm text-muted">
                    Varias ubicaciones para <span className="font-mono">{lastRaw}</span>. Elegí una:
                  </p>
                  <ul className="max-h-64 space-y-2 overflow-y-auto">
                    {candidates.map((item) => (
                      <li key={item.stockId || item.id}>
                        <button
                          type="button"
                          className="w-full rounded-lg border border-border p-3 text-left hover:bg-surface-hover"
                          onClick={() => {
                            setSelected(item);
                            setCantidad(1);
                            setPhase('qty');
                          }}
                        >
                          <span className="block font-semibold">{item.nombre}</span>
                          <span className="block text-xs text-muted">{formatUbicacionLabel(item)}</span>
                          <span className="text-xs font-bold">Stock: {item.cantidad}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button type="button" className="btn-secondary w-full" onClick={resetToScan}>
                    Reintentar lectura
                  </button>
                </div>
              )}

              {phase === 'qty' && selected && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-border bg-surface-muted p-3">
                    <p className="font-semibold text-content">{selected.nombre}</p>
                    <p className="text-xs text-muted">{formatUbicacionLabel(selected)}</p>
                    <p className="mt-1 text-xs">Stock disponible: {selected.cantidad}</p>
                  </div>
                  <div>
                    <label className="text-label">Cantidad</label>
                    <input
                      type="number"
                      min={1}
                      max={Math.max(1, Number(selected.cantidad) || 1)}
                      className="input-field mt-1"
                      value={cantidad}
                      onChange={(e) => setCantidad(parseInt(e.target.value, 10) || 1)}
                    />
                  </div>
                  <button type="button" className="btn-primary w-full min-h-[48px]" onClick={confirmAdd}>
                    Agregar al remito
                  </button>
                  <button type="button" className="btn-secondary w-full" onClick={resetToScan}>
                    Reintentar lectura
                  </button>
                </div>
              )}

              {phase === 'after' && (
                <div className="space-y-4">
                  <p className="text-sm text-emerald-200">
                    Ítem agregado. Llevás {addedCount} lectura{addedCount === 1 ? '' : 's'} en esta sesión.
                  </p>
                  <button
                    type="button"
                    className="btn-primary w-full min-h-[48px]"
                    onClick={resetToScan}
                  >
                    Leer otro ítem
                  </button>
                  <button type="button" className="btn-secondary w-full min-h-[48px]" onClick={onClose}>
                    Finalizar carga
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      {phase === 'camera' && (
        <QrScanner
          mode="raw"
          title={looking ? 'Buscando…' : 'Escanear ítem (QR / código)'}
          manualPlaceholder="Código de fabricante o QR"
          onClose={onClose}
          onScan={onScan}
        />
      )}

      {phase === 'laser' && (
        <LaserBarcodeCapture active onScan={onScan} onCancel={onClose} />
      )}
    </>
  );
}
