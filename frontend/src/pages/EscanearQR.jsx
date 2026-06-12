import { useState } from 'react';
import QrScanner from '../components/QrScanner';
import ScanResultPanel from '../components/ScanResultPanel';
import { api } from '../api/client';
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
      if (parsed.type === QR_TYPES.ITEM && parsed.itemId) {
        const data = await api.inventario();
        const items = (data.items || []).filter((i) => i.itemId === parsed.itemId);
        if (!items.length) throw new Error('Artículo no encontrado en inventario');
        setResult({ parsed, items, contenedor: null });
      } else if (parsed.codigo) {
        const data = await api.contenedor(parsed.codigo);
        setResult({
          parsed,
          items: data.items || [],
          contenedor: data.contenedor,
        });
      } else {
        throw new Error('Código QR no reconocido');
      }
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
    <div>
      <h2 className="page-title mb-2">ESCANEAR QR</h2>
      <p className="mb-6 text-muted">
        Escaneá y elegí <strong className="text-content">egreso</strong> o{' '}
        <strong className="text-content">ingreso</strong> sin salir del flujo.
      </p>

      {!result && (
        <button type="button" className="btn-primary w-full max-w-md" onClick={() => setScanning(true)}>
          📷 Escanear QR
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

      {!result && (
        <p className="mt-4 text-sm text-muted">
          Ubicación: A01 · A01-E03 · A01-E03-C05 / B12 / H01 / SC · o QR de artículo con item_id
        </p>
      )}

      {scanning && <QrScanner onScan={handleScan} onClose={() => setScanning(false)} />}
    </div>
  );
}
