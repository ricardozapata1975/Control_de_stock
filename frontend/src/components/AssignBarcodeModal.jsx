import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import QrScanner from './QrScanner';

/**
 * Flujo: agregar código de barras/QR del fabricante a un ítem.
 * Pasos: menú → cámara → confirmar / reintentar → guardar.
 */
export default function AssignBarcodeModal({ item, onClose, onSaved }) {
  const [step, setStep] = useState('menu'); // menu | scan | confirm | saving
  const [pendingCode, setPendingCode] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && step !== 'scan') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, step]);

  if (!item) return null;

  const handleScan = (result) => {
    const code = String(result?.raw || result?.codigo || result?.itemId || '').trim();
    if (!code) {
      setError('No se pudo leer el código. Reintentá.');
      setStep('menu');
      return;
    }
    setPendingCode(code);
    setError('');
    setStep('confirm');
  };

  const handleConfirm = async () => {
    setSaving(true);
    setError('');
    try {
      await api.adminUpdateItem(item.itemId, { codigoFabricante: pendingCode });
      onSaved?.({ ...item, codigoFabricante: pendingCode });
      onClose();
    } catch (err) {
      setError(err.message || 'No se pudo guardar el código');
      setStep('confirm');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
      onClick={step === 'scan' ? undefined : onClose}
      role="presentation"
    >
      <div
        className="card max-h-[90vh] w-full max-w-md overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-barcode-title"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 id="assign-barcode-title" className="section-title">
              Código del fabricante
            </h3>
            <p className="mt-1 text-sm text-muted">{item.nombre}</p>
            {item.codigoFabricante && (
              <p className="mt-1 text-xs text-subtle">
                Actual: <span className="font-mono">{item.codigoFabricante}</span>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1 text-2xl leading-none text-content-muted transition hover:bg-surface-hover"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        {error && <p className="mb-3 text-sm text-amber-800 dark:text-amber-200">{error}</p>}

        {step === 'menu' && (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              className="btn-primary min-h-[48px]"
              onClick={() => {
                setError('');
                setStep('scan');
              }}
            >
              Agregar un código
            </button>
            <button type="button" className="btn-secondary min-h-[44px]" onClick={onClose}>
              Cancelar
            </button>
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-700/50 bg-emerald-950/40 p-4">
              <p className="text-sm font-semibold text-emerald-200">Código encontrado</p>
              <p className="mt-2 break-all font-mono text-lg text-content">{pendingCode}</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className="btn-primary min-h-[48px] flex-1"
                disabled={saving}
                onClick={handleConfirm}
              >
                {saving ? 'Guardando…' : 'Confirmar'}
              </button>
              <button
                type="button"
                className="btn-secondary min-h-[48px] flex-1"
                disabled={saving}
                onClick={() => {
                  setPendingCode('');
                  setError('');
                  setStep('scan');
                }}
              >
                Reintentar
              </button>
            </div>
          </div>
        )}
      </div>

      {step === 'scan' && (
        <QrScanner
          mode="raw"
          title="Leer código del fabricante"
          manualPlaceholder="Pegá o escribí el código"
          onClose={() => setStep('menu')}
          onScan={handleScan}
        />
      )}
    </div>
  );
}

/**
 * Input oculto/foco para pistola láser (keyboard wedge).
 * Dispara onScan cuando llega Enter.
 */
export function LaserBarcodeCapture({ active, onScan, onCancel }) {
  const ref = useRef(null);
  const [buffer, setBuffer] = useState('');
  const [last, setLast] = useState('');

  useEffect(() => {
    if (!active) return undefined;
    const t = setTimeout(() => ref.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [active]);

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="card w-full max-w-md">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="section-title">Lector láser</h3>
          <button type="button" className="text-2xl leading-none" onClick={onCancel} aria-label="Cerrar">
            ×
          </button>
        </div>
        <p className="mb-3 text-sm text-muted">
          Apuntá el lector al código y dispará. El foco debe quedar en este campo.
        </p>
        <input
          ref={ref}
          className="input-field font-mono"
          value={buffer}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Esperando lectura…"
          onChange={(e) => setBuffer(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              const code = buffer.trim();
              if (code) {
                setLast(code);
                setBuffer('');
                onScan({ type: 'raw', raw: code, codigo: code });
              }
            }
          }}
          onBlur={() => {
            // Re-enfocar para no perder lecturas seguidas
            setTimeout(() => ref.current?.focus(), 30);
          }}
        />
        {last && (
          <p className="mt-2 text-xs text-subtle">
            Última lectura: <span className="font-mono">{last}</span>
          </p>
        )}
        <button type="button" className="btn-secondary mt-4 w-full" onClick={onCancel}>
          Cerrar lector
        </button>
      </div>
    </div>
  );
}
