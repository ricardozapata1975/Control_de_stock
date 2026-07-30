import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { useSync } from '../context/SyncContext';
import { useStore } from '../store/useStore';
import { formatRemitoFecha } from '../utils/remitoStorage';

function formatFecha(iso) {
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
 * Popup de confirmación al escanear QR de devolución de contenedor completo.
 */
export default function DevolucionLoteModal({ loteId, onClose, onDone }) {
  const { user } = useAuth();
  const { executeOrQueue } = useSync();
  const { registrarIngresoLote, loading } = useStore();
  const [lote, setLote] = useState(null);
  const [error, setError] = useState('');
  const [loadingLote, setLoadingLote] = useState(true);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingLote(true);
      setError('');
      try {
        const data = await api.egresoLote(loteId);
        if (!cancelled) setLote(data.lote);
      } catch (e) {
        if (!cancelled) setError(e.message || 'No se pudo cargar el lote');
      } finally {
        if (!cancelled) setLoadingLote(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loteId]);

  const confirmar = async () => {
    setError('');
    setSuccess('');
    const result = await registrarIngresoLote(
      {
        egresoLoteId: loteId,
        usuario: user?.name || 'Operario',
      },
      executeOrQueue
    );
    if (result?.ok) {
      setSuccess(
        result.offline
          ? 'Devolución guardada offline'
          : `Devolución confirmada (${result.data?.totalDevueltos || lote?.pendientesCount || ''} ítems)`
      );
      onDone?.(result);
      setTimeout(() => onClose?.(), 1200);
    } else {
      setError('No se pudo confirmar la devolución');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="devolucion-lote-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="devolucion-lote-title" className="section-title mb-2">
          Devolver contenedor completo
        </h3>

        {loadingLote && <p className="text-muted">Cargando lote…</p>}
        {error && <div className="alert-error mb-3">{error}</div>}
        {success && <div className="alert-success mb-3">{success}</div>}

        {lote && !success && (
          <>
            <p className="font-mono text-sm text-accent">{lote.contenedorCodigo || lote.id}</p>
            <p className="mt-1 text-sm text-muted">
              Retirado por <strong className="text-content">{lote.usuario}</strong> el{' '}
              {formatFecha(lote.fecha)}
            </p>
            {lote.completoDevuelto ? (
              <p className="mt-3 text-sm text-emerald-500">Este lote ya fue devuelto por completo.</p>
            ) : (
              <>
                <p className="mt-3 text-sm text-content">
                  Pendientes: <strong>{lote.pendientesCount}</strong> ítem(s) ·{' '}
                  {lote.pendientes?.reduce((s, l) => s + Number(l.cantidad || 0), 0) || 0} u.
                </p>
                <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm">
                  {(lote.pendientes || []).map((l) => (
                    <li key={l.id} className="flex justify-between gap-2 border-b border-border py-1">
                      <span>{l.nombreHerramienta || l.nombre}</span>
                      <span className="font-semibold text-accent">{l.cantidad}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {lote && !lote.completoDevuelto && !success && (
            <button
              type="button"
              className="btn-primary flex-1"
              disabled={loading || loadingLote}
              onClick={confirmar}
            >
              {loading ? 'Confirmando…' : 'Confirmar devolución'}
            </button>
          )}
          <button type="button" className="btn-secondary flex-1" onClick={onClose} disabled={loading}>
            {success ? 'Cerrar' : 'Cancelar'}
          </button>
        </div>
      </div>
    </div>
  );
}
