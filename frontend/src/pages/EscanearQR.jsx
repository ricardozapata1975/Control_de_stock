import { useState } from 'react';
import FocusedPage from '../components/FocusedPage';
import QrScanner from '../components/QrScanner';
import ScanResultPanel from '../components/ScanResultPanel';
import { resolveScanToInventario } from '../utils/resolveScan';
import { QR_TYPES } from '../utils/qrPayload';

export default function EscanearQR() {
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const handleScan = async (parsed) => {
    setScanning(false);
    setError('');
    setLoading(true);
    setResult(null);

    try {
      const resolved = await resolveScanToInventario(parsed);
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
  };

  return (
    <FocusedPage>
      <h2 className="page-title mb-2 text-center sm:text-left">ESCANEAR QR</h2>
      <p className="mb-6 text-center text-muted sm:text-left">
        Escaneá QR de ubicación, código de fabricante o el QR del ítem. Luego elegí{' '}
        <strong className="text-content">egreso</strong> o{' '}
        <strong className="text-content">ingreso</strong>.
      </p>

      {!result && (
        <button type="button" className="btn-primary mx-auto block w-full sm:mx-0" onClick={() => setScanning(true)}>
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

      {scanning && (
        <QrScanner
          mode="raw"
          title="Escanear QR / código"
          onClose={() => setScanning(false)}
          onScan={handleScan}
        />
      )}
    </FocusedPage>
  );
}
