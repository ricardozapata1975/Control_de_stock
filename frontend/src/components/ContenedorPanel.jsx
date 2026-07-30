import { useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { useSync } from '../context/SyncContext';
import { useAuth } from '../auth/AuthProvider';
import { api } from '../api/client';
import { formatUbicacionLabel } from '../utils/contenedor';
import RemitoEgresoLotePrintModal from './RemitoEgresoLotePrintModal';

function canRetirarContenedorCompleto(contenedor, items) {
  const id = String(contenedor?.id || '');
  if (!id || id.startsWith('alm-') || id.startsWith('arm-')) return false;
  const conStock = (items || []).filter((i) => Number(i.cantidad) > 0);
  if (!conStock.length) return false;
  const ids = new Set(conStock.map((i) => i.contenedorId).filter(Boolean));
  return ids.size === 1 && ids.has(contenedor.id);
}

function newClientLoteId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `lote-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function ContenedorPanel({ data, onRefresh }) {
  const { user } = useAuth();
  const {
    registrarEgreso,
    registrarEgresoContenedor,
    registrarIngreso,
    loading,
    error,
    clearError,
  } = useStore();
  const { executeOrQueue } = useSync();
  const [modal, setModal] = useState(null);
  const [cantidad, setCantidad] = useState(1);
  const [success, setSuccess] = useState('');
  const [printLote, setPrintLote] = useState(null);
  const [showPrint, setShowPrint] = useState(false);

  const { contenedor, items } = data;
  const itemsConStock = useMemo(
    () => (items || []).filter((i) => Number(i.cantidad) > 0),
    [items]
  );
  const puedeCompleto = canRetirarContenedorCompleto(contenedor, items);
  const totalUnidades = itemsConStock.reduce((s, i) => s + Number(i.cantidad || 0), 0);

  const submitEgreso = async (item) => {
    setSuccess('');
    const result = await registrarEgreso(
      {
        itemId: item.itemId,
        contenedorId: item.contenedorId,
        cantidad: Number(cantidad),
        usuario: user?.name || 'Operario',
      },
      executeOrQueue
    );
    if (result?.ok) {
      setModal(null);
      setSuccess(result.offline ? 'Egreso guardado offline' : 'Egreso registrado');
      onRefresh?.();
    }
  };

  const submitEgresoCompleto = async () => {
    if (!puedeCompleto) return;
    setSuccess('');
    const egresoLoteId = newClientLoteId();
    const snapshotLineas = itemsConStock.map((i) => ({
      itemId: i.itemId,
      nombre: i.nombre,
      marca: i.marca,
      modelo: i.modelo,
      tipo: i.tipo,
      cantidad: Number(i.cantidad),
    }));
    const result = await registrarEgresoContenedor(
      {
        contenedorId: contenedor.id,
        codigo: contenedor.codigo,
        usuario: user?.name || 'Operario',
        egresoLoteId,
      },
      executeOrQueue
    );
    if (result?.ok) {
      setModal(null);
      const data = result.data;
      const lote = data?.egresoLoteId
        ? data
        : {
            egresoLoteId,
            id: egresoLoteId,
            contenedorCodigo: contenedor.codigo,
            contenedorId: contenedor.id,
            usuario: user?.name || 'Operario',
            fecha: new Date().toISOString(),
            totalItems: snapshotLineas.length,
            totalUnidades,
            egresos: snapshotLineas,
            qrPayload: `inventario://devolucion/${egresoLoteId}`,
          };
      setPrintLote(lote);
      setShowPrint(true);
      setSuccess(
        result.offline
          ? 'Retiro guardado offline — imprimí el remito con el QR'
          : `Contenedor retirado: ${lote.totalItems || snapshotLineas.length} ítem(s)`
      );
      onRefresh?.();
    }
  };

  const submitIngreso = async (item) => {
    setSuccess('');
    const { movimientos } = await api.pendientes();
    const mov = movimientos.find(
      (m) => m.itemId === item.itemId && m.contenedorId === item.contenedorId
    );
    if (!mov) return alert('Sin egreso pendiente');
    const result = await registrarIngreso(
      { movimientoId: mov.id, usuario: user?.name },
      executeOrQueue
    );
    if (result?.ok) {
      setSuccess('Devolución registrada');
      onRefresh?.();
    }
  };

  return (
    <div>
      <div className="card mb-4 border-accent/40">
        <h2 className="font-mono text-2xl font-bold text-accent">{contenedor.codigo}</h2>
        <p className="text-muted">{formatUbicacionLabel(contenedor)}</p>
        <p className="mt-2 text-sm text-subtle">
          {items.length} ítems · Stock total:{' '}
          <strong className="text-content">{contenedor.totalStock}</strong>
        </p>
        {puedeCompleto && (
          <button
            type="button"
            className="btn-primary mt-4 w-full sm:w-auto"
            disabled={loading}
            onClick={() => setModal({ completo: true })}
          >
            Retirar contenedor completo ({itemsConStock.length})
          </button>
        )}
      </div>

      {error && (
        <div className="alert-error mb-4">
          {error}
          <button type="button" className="ml-2 underline" onClick={clearError}>
            Cerrar
          </button>
        </div>
      )}
      {success && (
        <div className="alert-success mb-4">
          {success}
          {printLote && (
            <button type="button" className="ml-2 underline" onClick={() => setShowPrint(true)}>
              Ver remito / QR
            </button>
          )}
        </div>
      )}

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="card flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-content">{item.nombre}</p>
              <p className="text-sm text-muted">
                {item.marca} · Stock:{' '}
                <span className="font-bold text-accent">{item.cantidad}</span>
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-primary py-2 text-base"
                disabled={item.cantidad < 1}
                onClick={() => {
                  setModal({ item });
                  setCantidad(1);
                  setSuccess('');
                }}
              >
                Retirar
              </button>
              <button
                type="button"
                className="btn-secondary py-2 text-base"
                onClick={() => submitIngreso(item)}
              >
                Devolver
              </button>
            </div>
          </li>
        ))}
      </ul>

      {modal?.item && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="card w-full max-w-sm">
            <h3 className="section-title mb-4">Retirar: {modal.item.nombre}</h3>
            <input
              type="number"
              min={1}
              max={modal.item.cantidad}
              className="input-field mb-4"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
            />
            <button
              type="button"
              className="btn-primary mb-2 w-full"
              disabled={loading}
              onClick={() => submitEgreso(modal.item)}
            >
              Confirmar
            </button>
            <button type="button" className="btn-secondary w-full" onClick={() => setModal(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {modal?.completo && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="card w-full max-w-md">
            <h3 className="section-title mb-2">Retirar contenedor completo</h3>
            <p className="mb-3 font-mono text-sm text-accent">{contenedor.codigo}</p>
            <p className="mb-3 text-sm text-muted">
              Se llevan juntas {itemsConStock.length} herramienta(s) ({totalUnidades} u.).
            </p>
            <ul className="mb-4 max-h-48 space-y-1 overflow-y-auto text-sm">
              {itemsConStock.map((i) => (
                <li key={i.id} className="flex justify-between gap-2 border-b border-border py-1">
                  <span className="text-content">{i.nombre}</span>
                  <span className="font-semibold text-accent">{i.cantidad}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn-primary mb-2 w-full"
              disabled={loading}
              onClick={submitEgresoCompleto}
            >
              {loading ? 'Retirando…' : 'Confirmar retiro completo'}
            </button>
            <button type="button" className="btn-secondary w-full" onClick={() => setModal(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {showPrint && printLote && (
        <RemitoEgresoLotePrintModal lote={printLote} onClose={() => setShowPrint(false)} />
      )}
    </div>
  );
}
