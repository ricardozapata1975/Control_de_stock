import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { formatFechaDmy } from '../utils/fecha';
import UbicacionSelector from './UbicacionSelector';
import { ALMACEN_DEFAULT } from '../utils/ubicacion';

function RecibirModal({ remito, catalogo, onClose, onConfirmado }) {
  const ubi = remito.ubicacionDestino || {};
  const [almacen, setAlmacen] = useState(remito.almacenDestino || ALMACEN_DEFAULT);
  const [armario, setArmario] = useState(ubi.armario || 'A01');
  const [estante, setEstante] = useState(ubi.estante || 'E01');
  const [contenedor, setContenedor] = useState(ubi.contenedor || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleRecibir = async () => {
    setError('');
    if (!armario || !estante) {
      setError('Completá armario y estante destino.');
      return;
    }
    setSubmitting(true);
    try {
      await api.recibirTransferencia(remito.id, {
        ubicacionDestino: { almacen, armario, estante, contenedor: contenedor || null },
      });
      onConfirmado();
      onClose();
    } catch (err) {
      setError(err.message || 'Error al recibir transferencia');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="card max-h-[90vh] w-full max-w-lg overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="section-title">Recibir transferencia N° {remito.numero}</h3>
          <button type="button" className="btn-secondary text-sm" onClick={onClose}>
            Cerrar
          </button>
        </div>

        <div className="mb-4 space-y-1 text-sm">
          <p>
            <span className="font-semibold">Origen:</span> {remito.almacenOrigen}
          </p>
          <p>
            <span className="font-semibold">Destino:</span> {remito.almacenDestino}
          </p>
          <p className="text-muted">
            {remito.items?.length || remito.itemsCount || 0} ítem(s) — emitido{' '}
            {formatFechaDmy(remito.fecha || remito.createdAt?.slice?.(0, 10))}
          </p>
        </div>

        <div className="mb-4">
          <h4 className="mb-2 font-bold text-content">Ubicación destino</h4>
          <UbicacionSelector
            catalogo={catalogo}
            almacen={almacen}
            armario={armario}
            estante={estante}
            contenedor={contenedor}
            almacenDisabled
            onAlmacenChange={setAlmacen}
            onArmarioChange={setArmario}
            onEstanteChange={setEstante}
            onContenedorChange={setContenedor}
          />
        </div>

        {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="button"
          className="btn-primary w-full"
          disabled={submitting}
          onClick={handleRecibir}
        >
          {submitting ? 'Confirmando...' : 'Confirmar recepción'}
        </button>
      </div>
    </div>
  );
}

export default function RemitoRecibir() {
  const [remitos, setRemitos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroAlmacen, setFiltroAlmacen] = useState('');
  const [catalogo, setCatalogo] = useState({ almacenes: [], armariosPorAlmacen: {} });
  const [recibirRemito, setRecibirRemito] = useState(null);
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setSuccess('');
    try {
      const data = await api.transferenciasPendientes(
        filtroAlmacen ? { almacenDestino: filtroAlmacen } : {}
      );
      setRemitos(data.transferencias || []);
    } catch {
      setRemitos([]);
    } finally {
      setLoading(false);
    }
  }, [filtroAlmacen]);

  useEffect(() => {
    api.catalogoUbicacion().then((cat) => {
      setCatalogo({
        almacenes: cat.almacenes || [],
        armariosPorAlmacen: cat.armariosPorAlmacen || {},
      });
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="page-title">Transferencias pendientes</h2>
          <p className="text-muted">Remitos en tránsito pendientes de recepción en almacén destino.</p>
        </div>
        <button type="button" className="btn-secondary text-sm" onClick={load} disabled={loading}>
          Actualizar
        </button>
      </div>

      <div className="card mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[180px] flex-1">
          <label className="text-label">Filtrar por almacén destino</label>
          <select
            className="input-field"
            value={filtroAlmacen}
            onChange={(e) => setFiltroAlmacen(e.target.value)}
          >
            <option value="">Todos</option>
            {(catalogo.almacenes || []).map((a) => (
              <option key={a.codigo} value={a.codigo}>
                {a.codigo} — {a.nombre || a.codigo}
              </option>
            ))}
          </select>
        </div>
      </div>

      {success && (
        <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          {success}
        </div>
      )}

      {loading && <p className="text-muted">Cargando transferencias...</p>}

      {!loading && !remitos.length && (
        <p className="text-muted">No hay transferencias pendientes de recepción.</p>
      )}

      <div className="space-y-3">
        {remitos.map((r) => (
          <div key={r.id} className="card flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-bold text-content">
                Remito N° {r.numero}
                <span className="ml-2 rounded-full bg-amber-800 px-2 py-0.5 text-xs font-semibold text-amber-100">
                  En tránsito
                </span>
              </p>
              <p className="text-sm text-muted">
                {r.almacenOrigen} → {r.almacenDestino}
                {r.ubicacionDestino?.cede ? ` · ${r.ubicacionDestino.cede}` : ''}
                {' · '}
                {(r.items || []).length} ítem(s)
                {r.createdBy ? ` · Emitido por ${r.createdBy}` : ''}
              </p>
              <p className="text-xs text-muted">
                Fecha: {formatFechaDmy(r.fecha || r.createdAt?.slice?.(0, 10))}
              </p>
            </div>
            <button
              type="button"
              className="btn-primary text-sm"
              onClick={() => setRecibirRemito(r)}
            >
              Recibir
            </button>
          </div>
        ))}
      </div>

      {recibirRemito && (
        <RecibirModal
          remito={recibirRemito}
          catalogo={catalogo}
          onClose={() => setRecibirRemito(null)}
          onConfirmado={() => {
            setSuccess(`Transferencia N° ${recibirRemito.numero} recibida correctamente.`);
            load();
          }}
        />
      )}
    </div>
  );
}
