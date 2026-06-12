import { useState } from 'react';
import { useStore } from '../store/useStore';
import { useSync } from '../context/SyncContext';
import { useAuth } from '../auth/AuthProvider';
import { api } from '../api/client';
import { formatUbicacionLabel } from '../utils/contenedor';

export default function ContenedorPanel({ data, onRefresh }) {
  const { user } = useAuth();
  const { registrarEgreso, registrarIngreso, loading, error, clearError } = useStore();
  const { executeOrQueue } = useSync();
  const [modal, setModal] = useState(null);
  const [cantidad, setCantidad] = useState(1);

  const { contenedor, items } = data;

  const submitEgreso = async (item) => {
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
      onRefresh?.();
    }
  };

  const submitIngreso = async (item) => {
    const { movimientos } = await api.pendientes();
    const mov = movimientos.find(
      (m) => m.itemId === item.itemId && m.contenedorId === item.contenedorId
    );
    if (!mov) return alert('Sin egreso pendiente');
    const result = await registrarIngreso(
      { movimientoId: mov.id, usuario: user?.name },
      executeOrQueue
    );
    if (result?.ok) onRefresh?.();
  };

  return (
    <div>
      <div className="card mb-4 border-accent/40">
        <h2 className="font-mono text-2xl font-bold text-accent">{contenedor.codigo}</h2>
        <p className="text-muted">{formatUbicacionLabel(contenedor)}</p>
        <p className="mt-2 text-sm text-subtle">
          {items.length} ítems · Stock total: <strong className="text-content">{contenedor.totalStock}</strong>
        </p>
      </div>

      {error && (
        <div className="alert-error mb-4">
          {error}
          <button type="button" className="ml-2 underline" onClick={clearError}>Cerrar</button>
        </div>
      )}

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="card flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-content">{item.nombre}</p>
              <p className="text-sm text-muted">{item.marca} · Stock: <span className="font-bold text-accent">{item.cantidad}</span></p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-primary py-2 text-base"
                disabled={item.cantidad < 1}
                onClick={() => {
                  setModal({ item });
                  setCantidad(1);
                }}
              >
                Retirar
              </button>
              <button type="button" className="btn-secondary py-2 text-base" onClick={() => submitIngreso(item)}>
                Devolver
              </button>
            </div>
          </li>
        ))}
      </ul>

      {modal && (
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
            <button type="button" className="btn-primary mb-2 w-full" disabled={loading} onClick={() => submitEgreso(modal.item)}>
              Confirmar
            </button>
            <button type="button" className="btn-secondary w-full" onClick={() => setModal(null)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
