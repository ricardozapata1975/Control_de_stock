import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthProvider';
import QrScanner from '../../../components/QrScanner';
import { formatUbicacionLabel } from '../../../utils/ubicacion';
import { resolveScanToInventario } from '../../../utils/resolveScan';

/**
 * Armado / Producción: elegir tablero, escanear piezas (consume reserva → ALM producción)
 * y ver checklist BOM. Al entregar el tablero se limpia el stock de producción.
 */
export default function ProduccionPage() {
  const { sede } = useAuth();
  const [proyectos, setProyectos] = useState([]);
  const [proyectoId, setProyectoId] = useState('');
  const [tableros, setTableros] = useState([]);
  const [tableroId, setTableroId] = useState('');
  const [checklist, setChecklist] = useState(null);
  const [catalogo, setCatalogo] = useState(null);
  const [stockProd, setStockProd] = useState([]);
  const [manualCode, setManualCode] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [scanOpen, setScanOpen] = useState(false);
  const [lastOk, setLastOk] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingCheck, setLoadingCheck] = useState(false);

  const produccionAlm = useMemo(() => {
    const list = catalogo?.almacenes || [];
    return list.find((a) => a.esProduccion) || null;
  }, [catalogo]);

  useEffect(() => {
    api.proyectos(sede ? { sede } : {}).then((d) => setProyectos(d.proyectos || []));
    api
      .catalogoUbicacion(sede ? { sede } : {})
      .then(setCatalogo)
      .catch(() => {});
  }, [sede]);

  useEffect(() => {
    if (!proyectoId) {
      setTableros([]);
      setTableroId('');
      return;
    }
    api.proyecto(proyectoId).then((d) => {
      setTableros(d.tableros || []);
      setTableroId('');
    });
  }, [proyectoId]);

  const loadChecklist = useCallback(() => {
    if (!tableroId) {
      setChecklist(null);
      return;
    }
    setLoadingCheck(true);
    api
      .checklistTablero(tableroId)
      .then((d) => {
        setChecklist(d);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoadingCheck(false));
  }, [tableroId]);

  useEffect(() => {
    loadChecklist();
  }, [loadChecklist]);

  const loadStockProd = useCallback(() => {
    if (!produccionAlm?.codigo) {
      setStockProd([]);
      return;
    }
    api
      .inventario({
        ...(sede ? { sede } : {}),
        almacen: produccionAlm.codigo,
      })
      .then((d) => setStockProd(d.items || []))
      .catch(() => setStockProd([]));
  }, [sede, produccionAlm?.codigo]);

  useEffect(() => {
    loadStockProd();
  }, [loadStockProd]);

  const entregar = async ({ itemId, codigo, scan }) => {
    if (!tableroId) {
      setError('Seleccioná un tablero');
      return;
    }
    setBusy(true);
    setError('');
    setLastOk(null);
    try {
      const data = await api.escanearProduccionTablero(tableroId, {
        itemId,
        codigo,
        scan,
        cantidad: Number(cantidad) || 1,
      });
      setLastOk(data);
      setChecklist(data.checklist || null);
      setManualCode('');
      loadStockProd();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const onScan = async (parsedOrRaw) => {
    setScanOpen(false);
    if (!tableroId) {
      setError('Seleccioná un tablero antes de escanear');
      return;
    }
    setError('');
    try {
      const resolved = await resolveScanToInventario(parsedOrRaw, { sede });
      if (!resolved.ok || !resolved.items?.length) {
        const raw =
          typeof parsedOrRaw === 'string'
            ? parsedOrRaw
            : parsedOrRaw?.raw || parsedOrRaw?.codigo || '';
        await entregar({ scan: raw, codigo: raw });
        return;
      }
      const row = resolved.items[0];
      await entregar({
        itemId: row.itemId,
        codigo: row.codigoFabricante || resolved.raw,
        scan: resolved.raw,
      });
    } catch (e) {
      setError(e.message);
    }
  };

  const onManual = async (e) => {
    e.preventDefault();
    const code = manualCode.trim();
    if (!code) return;
    await entregar({ codigo: code, scan: code });
  };

  const completar = async () => {
    if (!tableroId) return;
    if (
      !window.confirm(
        '¿Entregar el tablero al cliente? Se bajará el material del almacén de producción y el tablero quedará completado.'
      )
    ) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      const data = await api.completarProduccionTablero(tableroId);
      setLastOk({ tipo: 'completado', ...data });
      loadChecklist();
      loadStockProd();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const resumen = checklist?.resumen;
  const lineas = checklist?.lineas || [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="page-title">Armado / Producción</h2>
        <p className="text-muted">
          Escaneá cada pieza del pedido: se consume la reserva (limbo), sale del depósito general y
          entra al almacén de producción del tablero
          {produccionAlm ? ` (${produccionAlm.codigo})` : ''}.
        </p>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {lastOk?.ok && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm">
          Entregado x{lastOk.cantidad}:{' '}
          <strong>{lastOk.item?.codigoFabricante || lastOk.item?.nombre || lastOk.item?.id}</strong>
          {lastOk.destino?.codigo ? ` → ${lastOk.destino.codigo}` : ''}
        </div>
      )}
      {lastOk?.tipo === 'completado' && (
        <div className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-sm">
          Tablero completado. Bajas de producción:{' '}
          {(lastOk.bajadas || []).reduce((a, b) => a + Number(b.cantidad || 0), 0)} u.
        </div>
      )}

      <div className="card grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-label">Proyecto *</label>
          <select
            className="input-field"
            value={proyectoId}
            onChange={(e) => setProyectoId(e.target.value)}
          >
            <option value="">Elegí…</option>
            {proyectos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-label">Tablero *</label>
          <select
            className="input-field"
            value={tableroId}
            onChange={(e) => setTableroId(e.target.value)}
            disabled={!tableros.length}
          >
            <option value="">Elegí…</option>
            {tableros.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre} ({t.estado})
              </option>
            ))}
          </select>
        </div>
      </div>

      {tableroId && (
        <div className="card space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <form className="flex flex-wrap items-end gap-2 flex-1" onSubmit={onManual}>
              <div className="min-w-[160px] flex-1">
                <label className="text-label">MLFB / código</label>
                <input
                  className="input-field"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Pegá o escribí el código"
                  disabled={busy}
                />
              </div>
              <div className="w-24">
                <label className="text-label">Cant.</label>
                <input
                  type="number"
                  min={1}
                  className="input-field"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  disabled={busy}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={busy || !manualCode.trim()}>
                Entregar
              </button>
            </form>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => setScanOpen(true)}
            >
              Escanear QR
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy || loadingCheck}
              onClick={loadChecklist}
            >
              Actualizar
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy || checklist?.tablero?.estado === 'completado'}
              onClick={completar}
            >
              Completar / entregar tablero
            </button>
          </div>

          {resumen && (
            <p className="text-sm text-muted">
              BOM: {resumen.completas}/{resumen.lineas} líneas completas · pendientes de entrega{' '}
              {resumen.pendientesEntrega} · en producción {resumen.enProduccion}
            </p>
          )}

          {loadingCheck && <p className="text-muted">Cargando checklist…</p>}

          {lineas.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-edge">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-2 text-xs uppercase text-content-muted">
                  <tr>
                    <th className="px-3 py-2">Código</th>
                    <th className="px-3 py-2">Descripción</th>
                    <th className="px-3 py-2 text-right">Pedido</th>
                    <th className="px-3 py-2 text-right">Reservado</th>
                    <th className="px-3 py-2 text-right">Entregado</th>
                    <th className="px-3 py-2 text-right">Pendiente</th>
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((l) => (
                    <tr
                      key={l.materialId}
                      className={`border-t border-edge ${
                        l.pendienteEntrega <= 0 ? 'bg-emerald-500/5' : ''
                      }`}
                    >
                      <td className="px-3 py-2 font-mono text-xs">{l.codigoArticulo || '—'}</td>
                      <td className="px-3 py-2">{l.descripcion || '—'}</td>
                      <td className="px-3 py-2 text-right">{l.cantidadRequerida}</td>
                      <td className="px-3 py-2 text-right">{l.pendienteReserva}</td>
                      <td className="px-3 py-2 text-right font-semibold">{l.cantidadEntregada}</td>
                      <td className="px-3 py-2 text-right">{l.pendienteEntrega}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loadingCheck && tableroId && !lineas.length && (
            <p className="text-muted">
              Este tablero no tiene materiales. Importá un pedido masivo ligado al tablero.
            </p>
          )}
        </div>
      )}

      <div>
        <h3 className="section-title">Stock físico en producción</h3>
        <p className="text-sm text-muted mb-2">
          Vista del almacén de taller (todas las líneas). Al completar un tablero se bajan sus
          unidades.
        </p>
        {!produccionAlm && (
          <p className="text-muted">Sin almacén de producción en el catálogo.</p>
        )}
        {produccionAlm && !stockProd.length && (
          <p className="text-muted">Sin materiales en producción en esta sede.</p>
        )}
        {stockProd.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-edge">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2 text-xs uppercase text-content-muted">
                <tr>
                  <th className="px-3 py-2">Artículo</th>
                  <th className="px-3 py-2">Código</th>
                  <th className="px-3 py-2">Ubicación</th>
                  <th className="px-3 py-2 text-right">Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {stockProd.map((it) => (
                  <tr key={it.stockId || it.id} className="border-t border-edge">
                    <td className="px-3 py-2">
                      <div className="font-medium">{it.nombre || it.itemId}</div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{it.codigoFabricante || '—'}</td>
                    <td className="px-3 py-2 text-xs">{formatUbicacionLabel(it)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{it.cantidad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {scanOpen && (
        <QrScanner
          onScan={onScan}
          onClose={() => setScanOpen(false)}
          title="Escanear pieza para el tablero"
        />
      )}
    </div>
  );
}
