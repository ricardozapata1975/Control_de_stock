import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { formatRemitoFecha } from '../utils/remitoStorage';
import { buildQrPayload, QR_TYPES } from '../utils/qrPayload';

function formatFechaHora(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return formatRemitoFecha(String(iso).slice(0, 10)) || iso;
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Remito interno de retiro de contenedor completo (impresión + QR de devolución).
 */
export default function RemitoEgresoLoteDocument({ lote }) {
  const canvasRef = useRef(null);
  const qrPayload =
    lote?.qrPayload ||
    (lote?.egresoLoteId || lote?.id
      ? buildQrPayload({ type: QR_TYPES.DEVOLUCION, loteId: lote.egresoLoteId || lote.id })
      : '');

  const lineas = lote?.egresos || lote?.lineas || [];

  useEffect(() => {
    if (!qrPayload || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, qrPayload, { width: 120, margin: 1 });
  }, [qrPayload]);

  if (!lote) return null;

  return (
    <div className="remito-doc mx-auto w-full max-w-[210mm] bg-white px-4 pb-4 font-serif text-[11px] leading-tight text-black print:px-4 print:pb-4">
      <div className="mb-2 flex border-2 border-black">
        <div className="flex-1 border-r border-black p-3">
          <p className="text-base font-bold uppercase tracking-wide">Retiro de contenedor</p>
          <p className="mt-1 text-[10px]">Documento interno de préstamo / kit</p>
          <p className="mt-3">
            <span className="font-bold">Contenedor:</span>{' '}
            <span className="font-mono">{lote.contenedorCodigo || '—'}</span>
          </p>
          <p>
            <span className="font-bold">Retirado por:</span> {lote.usuario || '—'}
          </p>
          <p>
            <span className="font-bold">Fecha de retiro:</span> {formatFechaHora(lote.fecha)}
          </p>
          <p>
            <span className="font-bold">Ítems:</span> {lote.totalItems ?? lineas.length} ·{' '}
            <span className="font-bold">Unidades:</span>{' '}
            {lote.totalUnidades ??
              lineas.reduce((s, l) => s + Number(l.cantidad || 0), 0)}
          </p>
        </div>
        <div className="flex w-[38%] flex-col items-center justify-center p-2 text-center">
          <p className="mb-1 text-[9px] font-bold uppercase">QR devolución</p>
          {qrPayload ? (
            <canvas ref={canvasRef} className="border border-black/20" />
          ) : (
            <div className="flex h-[120px] w-[120px] items-center justify-center border border-dashed border-black/40 text-[9px] text-black/50">
              Sin QR
            </div>
          )}
          <p className="mt-1 break-all font-mono text-[7px] text-black/60">
            {lote.egresoLoteId || lote.id}
          </p>
        </div>
      </div>

      <div className="mb-2 border border-black">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-black bg-black/5">
              <th className="border-r border-black/30 px-2 py-1.5">#</th>
              <th className="border-r border-black/30 px-2 py-1.5">Herramienta</th>
              <th className="border-r border-black/30 px-2 py-1.5">Detalle</th>
              <th className="px-2 py-1.5 text-right">Cant.</th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l, idx) => {
              const nombre = l.nombre || l.nombreHerramienta || '—';
              const detalle = [l.tipo, l.marca, l.modelo].filter(Boolean).join(' · ');
              return (
                <tr key={l.movimientoId || l.id || idx} className="border-b border-black/20">
                  <td className="border-r border-black/20 px-2 py-1.5">{idx + 1}</td>
                  <td className="border-r border-black/20 px-2 py-1.5 font-semibold">{nombre}</td>
                  <td className="border-r border-black/20 px-2 py-1.5">{detalle || '—'}</td>
                  <td className="px-2 py-1.5 text-right font-bold">{l.cantidad}</td>
                </tr>
              );
            })}
            {!lineas.length && (
              <tr>
                <td colSpan={4} className="px-2 py-6 text-center text-black/50">
                  Sin ítems
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid border border-black text-[10px] sm:grid-cols-2">
        <div className="border-b border-black p-3 sm:border-b-0 sm:border-r">
          <p className="mb-8 font-bold">Entregado conforme</p>
          <div className="border-t border-black pt-1 text-center">Firma quien retira</div>
        </div>
        <div className="p-3">
          <p className="mb-2 font-bold">Devolución</p>
          <p className="text-[9px] leading-snug">
            Al devolver, escaneá el QR de este remito y confirmá la devolución del contenedor
            completo en la app.
          </p>
        </div>
      </div>
    </div>
  );
}
