import { useState } from 'react';
import FocusedPage from '../components/FocusedPage';
import QrScanner from '../components/QrScanner';
import ScanResultPanel from '../components/ScanResultPanel';
import DevolucionLoteModal from '../components/DevolucionLoteModal';
import { resolveScanToInventario } from '../utils/resolveScan';
import { QR_TYPES, parseQrScan } from '../utils/qrPayload';
import { useAuth } from '../auth/AuthProvider';

export default function EscanearQR() {
  const { sede } = useAuth();
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [devolucionLoteId, setDevolucionLoteId] = useState(null);

  const handleScan = async (rawOrParsed) => {
    setScanning(false);
    setError('');
    setLoading(true);
    setResult(null);
    setDevolucionLoteId(null);

    try {
      let parsed;
      if (typeof rawOrParsed === 'string') {
        parsed = parseQrScan(rawOrParsed) || rawOrParsed;
      } else if (rawOrParsed?.type === 'raw' && rawOrParsed.raw) {
        parsed = parseQrScan(rawOrParsed.raw) || rawOrParsed;
      } else {
        parsed = rawOrParsed;
      }

      if (parsed?.type === QR_TYPES.DEVOLUCION && parsed.loteId) {
        setDevolucionLoteId(parsed.loteId);
        return;
      }

      const resolved = await resolveScanToInventario(parsed, { sede });
      if (!resolved.ok) {
        throw new Error(resolved.error || 'Código no reconocido');
      }

      const displayParsed =
        resolved.matchType === 'fabricante'
          ? {
              type: QR_TYPES.ITEM,
              itemId: resolved.items[0]?.itemId,
              codigoFabricante: resolved.raw,
            }
          : resolved.parsed;

      setResult({
        parsed: displayParsed,
        items: resolved.items,
        contenedor: null,
        matchType: resolved.matchType,
      });
    } catch (e) {
      setError(e.message || 'No se pudo cargar el escaneo');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError('');
    setDevolucionLoteId(null);
  };

  return (
    <FocusedPage>
      <h2 className="page-title mb-2 text-center sm:text-left">ESCANEAR QR</h2>
      <p className="mb-6 text-center text-muted sm:text-left">
        Escaneá QR de ubicación, código de fabricante, ítem o el{' '}
        <strong className="text-content">QR de devolución</strong> del remito de kit. Si el celular
        no lee el QR desde la pantalla, pegá el UUID del remito en código manual.
      </p>

      {!result && !devolucionLoteId && (
        <button
          type="button"
          className="btn-primary mx-auto block w-full sm:mx-0"
          onClick={() => setScanning(true)}
        >
          Escanear QR / código de barras
        </button>
      )}

      {loading && <p className="mt-4 text-muted">Cargando datos del código…</p>}
      {error && (
        <div className="alert-error mt-4">
          {error}
          <button type="button" className="ml-2 underline" onClick={reset}>
            Reintentar
          </button>
        </div>
      )}

      {result && (
        <ScanResultPanel
          parsed={result.parsed}
          contenedor={result.contenedor}
          items={result.items}
          onScanAgain={() => {
            reset();
            setScanning(true);
          }}
        />
      )}

      {devolucionLoteId && (
        <DevolucionLoteModal
          loteId={devolucionLoteId}
          onClose={() => {
            setDevolucionLoteId(null);
            reset();
          }}
        />
      )}

      {scanning && (
        <QrScanner
          mode="raw"
          title="Escanear QR / código"
          manualPlaceholder="UUID del remito, inv://d/… o ubicación"
          onClose={() => setScanning(false)}
          onScan={handleScan}
        />
      )}
    </FocusedPage>
  );
}
