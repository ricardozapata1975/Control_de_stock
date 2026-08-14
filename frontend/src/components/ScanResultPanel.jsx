import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useSync } from '../context/SyncContext';
import { useStore } from '../store/useStore';
import { QR_TYPES, buildQrPayload, qrTypeLabel } from '../utils/qrPayload';
import {
  buildEgresoUrlForItem,
  buildIngresoUrlForItem,
  buildInventarioScanUrl,
  getUbicacionScanLabel,
} from '../utils/scanMatch';
import { fieldLabel } from '../utils/fieldLabels';
import CodigoCatalogoLink from './CodigoCatalogoLink';
import ScanItemActionModal from './ScanItemActionModal';
import ScanLocationList from './ScanLocationList';
import RemitoEgresoLotePrintModal from './RemitoEgresoLotePrintModal';

function newClientLoteId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `lote-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildEgresoUrl(parsed, items) {
  const p = new URLSearchParams();
  if (parsed.type === QR_TYPES.ITEM && parsed.itemId) {
    p.set('itemId', parsed.itemId);
    if (items?.length === 1) p.set('stockId', items[0].id);
    return `/egreso?${p.toString()}`;
  }
  return '/egreso';
}

function buildIngresoUrl(parsed) {
  const p = new URLSearchParams();
  if (parsed.type === QR_TYPES.ITEM && parsed.itemId) {
    p.set('itemId', parsed.itemId);
    return `/ingreso?${p.toString()}`;
  }
  return '/ingreso';
}

function canRetirarCompleto(parsed, items) {
  if (parsed?.type !== QR_TYPES.CONTENEDOR) return false;
  const conStock = (items || []).filter((i) => Number(i.cantidad) > 0);
  if (!conStock.length) return false;
  const ids = new Set(conStock.map((i) => i.contenedorId).filter(Boolean));
  return ids.size === 1;
}

export default function ScanResultPanel({ parsed, contenedor, items = [], onScanAgain, onRefresh }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { executeOrQueue } = useSync();
  const { registrarEgresoContenedor, loading } = useStore();
  const [selectedItem, setSelectedItem] = useState(null);
  const [confirmCompleto, setConfirmCompleto] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [printLote, setPrintLote] = useState(null);
  const [showPrint, setShowPrint] = useState(false);

  const isItem = parsed.type === QR_TYPES.ITEM;
  const isUbicacion =
    parsed.type === QR_TYPES.ARMARIO ||
    parsed.type === QR_TYPES.ESTANTE ||
    parsed.type === QR_TYPES.CONTENEDOR;

  const title = isItem
    ? items[0]?.nombre || parsed.itemId
    : parsed.codigo || contenedor?.codigo;

  const ubicacionLabel = isUbicacion ? getUbicacionScanLabel(parsed, contenedor) : null;
  const puedeCompleto = useMemo(() => canRetirarCompleto(parsed, items), [parsed, items]);
  const itemsConStock = useMemo(
    () => items.filter((i) => Number(i.cantidad) > 0),
    [items]
  );

  const submitCompleto = async () => {
    const contenedorId = itemsConStock[0]?.contenedorId;
    if (!contenedorId) return;
    setErr('');
    setMsg('');
    const egresoLoteId = newClientLoteId();
    const codigo = parsed.codigo || contenedor?.codigo;
    const snapshotLineas = itemsConStock.map((i) => ({
      itemId: i.itemId,
      nombre: i.nombre,
      marca: i.marca,
      modelo: i.modelo,
      tipo: i.tipo,
      cantidad: Number(i.cantidad),
    }));
    const totalUnidades = snapshotLineas.reduce((s, l) => s + l.cantidad, 0);
    const result = await registrarEgresoContenedor(
      {
        contenedorId,
        codigo,
        usuario: user?.name || 'Operario',
        egresoLoteId,
      },
      executeOrQueue
    );
    if (result?.ok) {
      setConfirmCompleto(false);
      const data = result.data;
      const lote = data?.egresoLoteId
        ? data
        : {
            egresoLoteId,
            id: egresoLoteId,
            contenedorCodigo: codigo,
            contenedorId,
            usuario: user?.name || 'Operario',
            fecha: new Date().toISOString(),
            totalItems: snapshotLineas.length,
            totalUnidades,
            egresos: snapshotLineas,
            qrPayload: buildQrPayload({ type: QR_TYPES.DEVOLUCION, loteId: egresoLoteId }),
          };
      setPrintLote(lote);
      setShowPrint(true);
      setMsg(
        result.offline
          ? 'Retiro guardado offline — imprimí el remito con el QR'
          : `Contenedor retirado (${itemsConStock.length} ítems)`
      );
      onRefresh?.();
    } else {
      setErr('No se pudo retirar el contenedor');
    }
  };

  return (
    <div className="card mt-6 space-y-4 border-accent/40">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-400">
          {qrTypeLabel(parsed.type)} escaneado
        </p>
        <h3 className="font-mono text-xl font-bold text-accent">{title}</h3>
        {ubicacionLabel && <p className="mt-1 text-muted">{ubicacionLabel}</p>}
        {isItem && (
          <p className="font-mono text-sm text-subtle">item_id: {parsed.itemId}</p>
        )}
        {parsed.codigoFabricante && (
          <p className="font-mono text-sm text-subtle">
            {fieldLabel('codigoFabricante')}:{' '}
            <CodigoCatalogoLink codigo={parsed.codigoFabricante} />
          </p>
        )}
        {isUbicacion && (
          <p className="mt-2 text-sm text-content-muted">
            {items.length} herramienta{items.length !== 1 ? 's' : ''} en esta ubicación
          </p>
        )}
      </div>

      {err && <div className="alert-error">{err}</div>}
      {msg && (
        <div className="alert-success">
          {msg}
          {printLote && (
            <button type="button" className="ml-2 underline" onClick={() => setShowPrint(true)}>
              Ver remito / QR
            </button>
          )}
        </div>
      )}

      {isUbicacion && (
        <ScanLocationList
          parsed={parsed}
          items={items}
          selectable
          onSelectItem={setSelectedItem}
        />
      )}

      {isItem && items.length > 0 && (
        <ScanLocationList parsed={parsed} items={items} />
      )}

      {puedeCompleto && (
        <button
          type="button"
          className="btn-primary w-full"
          disabled={loading}
          onClick={() => setConfirmCompleto(true)}
        >
          Retirar contenedor completo ({itemsConStock.length})
        </button>
      )}

      {isUbicacion && items.length > 0 && (
        <button
          type="button"
          className="btn-secondary w-full border-sky-700 text-sky-100"
          onClick={() => navigate(buildInventarioScanUrl(parsed))}
        >
          Ver inventario filtrado
        </button>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          className="btn-primary w-full"
          onClick={() => navigate(buildEgresoUrl(parsed, items))}
        >
          Registrar egreso
        </button>
        <button
          type="button"
          className="btn-secondary w-full border-accent text-accent"
          onClick={() => navigate(buildIngresoUrl(parsed))}
        >
          Registrar ingreso
        </button>
      </div>

      {isUbicacion && (
        <p className="text-center text-xs text-subtle">
          Sin elegir herramienta, egreso e ingreso abren el formulario vacío.
          {puedeCompleto ? ' Podés retirar el contenedor completo con el botón de arriba.' : ''}
        </p>
      )}

      <button
        type="button"
        className="text-sm text-content-muted underline hover:text-content"
        onClick={onScanAgain}
      >
        Escanear otro código
      </button>

      {selectedItem && (
        <ScanItemActionModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onEgreso={() => {
            setSelectedItem(null);
            navigate(buildEgresoUrlForItem(selectedItem));
          }}
          onIngreso={() => {
            setSelectedItem(null);
            navigate(buildIngresoUrlForItem(selectedItem));
          }}
        />
      )}

      {confirmCompleto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="card w-full max-w-md">
            <h3 className="section-title mb-2">Retirar contenedor completo</h3>
            <p className="mb-3 font-mono text-sm text-accent">
              {parsed.codigo || contenedor?.codigo}
            </p>
            <ul className="mb-4 max-h-48 space-y-1 overflow-y-auto text-sm">
              {itemsConStock.map((i) => (
                <li key={i.id} className="flex justify-between gap-2 border-b border-border py-1">
                  <span>{i.nombre}</span>
                  <span className="font-semibold text-accent">{i.cantidad}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn-primary mb-2 w-full"
              disabled={loading}
              onClick={submitCompleto}
            >
              {loading ? 'Retirando…' : 'Confirmar retiro completo'}
            </button>
            <button
              type="button"
              className="btn-secondary w-full"
              onClick={() => setConfirmCompleto(false)}
            >
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
