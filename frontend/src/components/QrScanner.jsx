import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { parseQrScan } from '../utils/qrPayload';

const SCANNER_ID = 'qr-reader';

function isLocalHost() {
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
}

function needsHttpsHint() {
  return !window.isSecureContext && !isLocalHost();
}

function pickPreferredCamera(cameras) {
  if (!cameras?.length) return null;
  const back = cameras.find((c) =>
    /back|rear|environment|trasera|trás|wide/i.test(c.label || '')
  );
  if (back) return back.id;

  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  if (isMobile && cameras.length > 1) return cameras[cameras.length - 1].id;
  return cameras[0].id;
}

function qrBoxConfig() {
  const el = document.getElementById(SCANNER_ID);
  const w = el?.clientWidth || 280;
  const size = Math.min(280, Math.max(180, Math.floor(w * 0.82)));
  return { fps: 10, qrbox: { width: size, height: size } };
}

function mapCameraError(err) {
  const name = err?.name || '';
  const msg = String(err?.message || err || '');

  if (needsHttpsHint()) {
    return 'La cámara en el celular requiere HTTPS. Reiniciá el frontend (npm run dev) y abrí la URL que empiece con https://. Mientras tanto, usá el código manual.';
  }
  if (name === 'NotAllowedError' || /permission/i.test(msg)) {
    return 'Permiso de cámara denegado. Permití el acceso en el navegador y recargá la página.';
  }
  if (name === 'NotFoundError' || /NotFound/i.test(msg)) {
    return 'No se detectó ninguna cámara en este dispositivo. Usá el código manual.';
  }
  if (name === 'NotReadableError' || /in use|busy/i.test(msg)) {
    return 'La cámara está en uso por otra aplicación. Cerrala e intentá de nuevo.';
  }
  if (/secure|https|insecure/i.test(msg)) {
    return 'El navegador exige HTTPS para la cámara. Abrí la app con https:// desde el celular.';
  }
  return `No se pudo iniciar la cámara. ${msg ? `(${msg})` : 'Probá el código manual.'}`;
}

export default function QrScanner({ onScan, onClose }) {
  const scannerRef = useRef(null);
  const onScanRef = useRef(onScan);
  const [error, setError] = useState(null);
  const [manual, setManual] = useState('');
  const [starting, setStarting] = useState(true);

  onScanRef.current = onScan;

  useEffect(() => {
    if (needsHttpsHint()) {
      setError(mapCameraError({}));
      setStarting(false);
      return undefined;
    }

    let cancelled = false;
    let html5 = null;

    const onDecode = (decoded) => {
      const parsed = parseQrScan(decoded);
      if (!parsed || !html5) return;
      html5
        .stop()
        .catch(() => {})
        .finally(() => onScanRef.current(parsed));
    };

    const start = async () => {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (cancelled || !document.getElementById(SCANNER_ID)) return;

      html5 = new Html5Qrcode(SCANNER_ID);
      scannerRef.current = html5;

      const config = qrBoxConfig();
      const scanConfig = { ...config };

      try {
        const cameras = await Html5Qrcode.getCameras();
        if (cancelled) return;

        if (!cameras?.length) {
          await html5.start({ facingMode: 'user' }, scanConfig, onDecode, () => {});
          if (!cancelled) setStarting(false);
          return;
        }

        const orderedIds = [
          pickPreferredCamera(cameras),
          ...cameras.map((c) => c.id),
        ].filter((id, i, arr) => id && arr.indexOf(id) === i);

        let lastErr = null;
        for (const cameraId of orderedIds) {
          if (cancelled) return;
          try {
            if (html5.isScanning) await html5.stop().catch(() => {});
            await html5.start(cameraId, scanConfig, onDecode, () => {});
            if (!cancelled) {
              setError(null);
              setStarting(false);
            }
            return;
          } catch (e) {
            lastErr = e;
          }
        }

        for (const facingMode of ['user', 'environment']) {
          if (cancelled) return;
          try {
            if (html5.isScanning) await html5.stop().catch(() => {});
            await html5.start({ facingMode }, scanConfig, onDecode, () => {});
            if (!cancelled) {
              setError(null);
              setStarting(false);
            }
            return;
          } catch (e) {
            lastErr = e;
          }
        }

        if (!cancelled) {
          setError(mapCameraError(lastErr));
          setStarting(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(mapCameraError(err));
          setStarting(false);
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      const instance = scannerRef.current;
      scannerRef.current = null;
      if (instance?.isScanning) {
        instance.stop().then(() => instance.clear()).catch(() => {});
      } else {
        instance?.clear?.();
      }
    };
  }, []);

  const submitManual = () => {
    const parsed = parseQrScan(manual);
    if (parsed) onScan(parsed);
    else setError('Código inválido. Ej: A01-E03, A01 o item_id');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="card max-h-[90vh] w-full max-w-md overflow-y-auto">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="section-title">Escanear QR</h3>
          <button type="button" onClick={onClose} className="text-2xl leading-none text-slate-100 hover:text-white">
            ×
          </button>
        </div>

        {needsHttpsHint() && (
          <p className="alert-warning mb-3 text-sm">
            En el celular abrí la app con <strong className="text-amber-200">https://</strong> (no http). Tras{' '}
            <code className="text-amber-200">npm run dev</code> usá la URL segura que muestra Vite.
          </p>
        )}

        {error && <p className="mb-2 text-sm text-amber-200">{error}</p>}
        {starting && !error && <p className="mb-2 text-sm text-muted">Iniciando cámara…</p>}

        <div id={SCANNER_ID} className="min-h-[200px] overflow-hidden rounded-lg bg-slate-950" />

        <div className="mt-4">
          <label className="text-label">Código manual</label>
          <div className="flex gap-2">
            <input
              className="input-field"
              placeholder="A01-E01-C01 o item_id"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitManual()}
            />
            <button type="button" className="btn-primary shrink-0" onClick={submitManual}>
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
