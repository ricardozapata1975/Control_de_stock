import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { buildQrPayload, qrTypeLabel, QR_TYPES } from '../utils/qrPayload';

export default function QrLabel({
  type = QR_TYPES.CONTENEDOR,
  codigo,
  itemId,
  titulo,
  subtitulo,
  size = 160,
}) {
  const canvasRef = useRef(null);
  const payload = buildQrPayload({ type, codigo, itemId });
  const linea1 = titulo ?? (type === QR_TYPES.ITEM ? itemId : codigo);
  const linea2 = subtitulo ?? qrTypeLabel(type);

  useEffect(() => {
    if (!payload || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, payload, {
      width: size,
      margin: 1,
    });
  }, [payload, size]);

  if (!payload) return null;

  return (
    <div className="flex flex-col items-center rounded-lg border border-slate-700 bg-white p-3 text-center print:break-inside-avoid">
      <span className="mb-1 rounded bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-700">
        {qrTypeLabel(type)}
      </span>
      <canvas ref={canvasRef} />
      <p className="mt-2 font-mono text-base font-bold leading-tight text-slate-900">{linea1}</p>
      {type === QR_TYPES.ITEM && itemId && linea1 !== itemId && (
        <p className="font-mono text-xs text-slate-500">item_id: {itemId}</p>
      )}
      <p className="mt-1 text-sm text-slate-600">{linea2}</p>
    </div>
  );
}
