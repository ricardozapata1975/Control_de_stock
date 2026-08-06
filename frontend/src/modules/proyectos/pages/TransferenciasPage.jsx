import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthProvider';
import QrScanner from '../../../components/QrScanner';
import { parseQrScan, QR_TYPES } from '../../../utils/qrPayload';
import { ALMACEN_DEFAULT, resolveAduanaUbicacion, SEDE_DEFAULT } from '../../../utils/ubicacion';

function extractRemitoId(rawOrParsed) {
  if (!rawOrParsed) return null;
  if (typeof rawOrParsed === 'object') {
    if (rawOrParsed.type === QR_TYPES.REMITO && rawOrParsed.remitoId) return rawOrParsed.remitoId;
    if (rawOrParsed.remitoId) return rawOrParsed.remitoId;
    return extractRemitoId(rawOrParsed.raw || rawOrParsed.codigo || '');
  }
  const s = String(rawOrParsed || '').trim();
  if (!s) return null;
  const parsed = parseQrScan(s);
  if (parsed?.type === QR_TYPES.REMITO && parsed.remitoId) return parsed.remitoId;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)) {
    return s.toLowerCase();
  }
  if (s.startsWith('demo-remito-')) return s;
  return null;
}

export default function TransferenciasPage() {
  const { sede, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [catalogo, setCatalogo] = useState(null);
  const [scanRemito, setScanRemito] = useState(false);
  const [manualRemito, setManualRemito] = useState('');
  const [remito, setRemito] = useState(null);
  const [eventos, setEventos] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanItem, setScanItem] = useState(false);
  const [manualItem, setManualItem] = useState('');
  const [closing, setClosing] = useState(false);
  const [notasCierre, setNotasCierre] = useState('');

  const [destSede, setDestSede] = useState(sede || SEDE_DEFAULT);
  const [destAlmacen, setDestAlmacen] = useState(ALMACEN_DEFAULT);
  const [destArmario, setDestArmario] = useState('');
  const [destEstante, setDestEstante] = useState('');
  const [destContenedor, setDestContenedor] = useState('');

  useEffect(() => {
    api.catalogoUbicacion().then(setCatalogo).catch(() => setCatalogo(null));
  }, []);

  const pendientes = useMemo(
    () => (remito?.items || []).filter((i) => i.cantidadPendiente > 0),
    [remito]
  );
  const completados = useMemo(
    () => (remito?.items || []).filter((i) => i.cantidadPendiente <= 0),
    [remito]
  );

  const applyAduana = useCallback(() => {
    const aduana = resolveAduanaUbicacion(catalogo, destSede || sede || SEDE_DEFAULT);
    if (!aduana) return;
    setDestAlmacen(aduana.almacen || destAlmacen);
    setDestArmario(aduana.armario || '');
    setDestEstante(aduana.estante || '');
    setDestContenedor(aduana.contenedor || '');
  }, [catalogo, destSede, sede, destAlmacen]);

  const loadRemito = async (id) => {
    if (!id) return;
    setLoading(true);
    setError('');
    setMsg('');
    try {
      const data = await api.proyectoTransferencia(id);
      setRemito(data.remito);
      setEventos(data.eventos || []);
      const u = data.remito?.ubicacionDestino || {};
      const sedeDest = u.sede || sede || SEDE_DEFAULT;
      setDestSede(sedeDest);
      setDestAlmacen(u.almacen || data.remito?.almacenDestino || ALMACEN_DEFAULT);
      setDestArmario(u.armario || '');
      setDestEstante(u.estante || '');
      setDestContenedor(u.contenedor || '');
      if (!u.armario || !u.estante) {
        const cat = catalogo || (await api.catalogoUbicacion().catch(() => null));
        const aduana = resolveAduanaUbicacion(cat, sedeDest);
        if (aduana) {
          setDestAlmacen(aduana.almacen || data.remito?.almacenDestino);
          setDestArmario(aduana.armario);
          setDestEstante(aduana.estante);
          setDestContenedor(aduana.contenedor || '');
        }
      }
      setSearchParams({ remito: id }, { replace: true });
    } catch (e) {
      setError(e.message);
      setRemito(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const id = searchParams.get('remito');
    if (id) loadRemito(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRemitoScan = (rawOrParsed) => {
    const id = extractRemitoId(rawOrParsed);
    setScanRemito(false);
    if (!id) {
      setError('QR no reconocido como remito de transferencia');
      return;
    }
    loadRemito(id);
  };

  const ubicacionDestino = () => ({
    sede: destSede,
    almacen: destAlmacen,
    armario: destArmario,
    estante: destEstante,
    contenedor: destContenedor || null,
  });

  const validarScan = async (rawOrParsed) => {
    if (!remito?.id) return;
    setError('');
    setMsg('');
    const raw =
      typeof rawOrParsed === 'string'
        ? rawOrParsed
        : rawOrParsed?.raw || rawOrParsed?.itemId || rawOrParsed?.codigo || '';
    const parsed = typeof rawOrParsed === 'object' ? rawOrParsed : parseQrScan(raw);
    const body = {
      scan: raw,
      cantidad: 1,
      ubicacionDestino: ubicacionDestino(),
      usuario: user?.name || user?.email,
    };
    if (parsed?.type === QR_TYPES.ITEM && parsed.itemId) {
      body.itemId = parsed.itemId;
    }
    try {
      const result = await api.validarItemTransferencia(remito.id, body);
      if (result.ok) {
        setMsg(
          result.cerradoCompleto
            ? 'Remito recibido completo.'
            : `Ítem validado (+${result.cantidadAplicada}).`
        );
      } else {
        setError(result.mensaje || 'Discrepancia registrada');
      }
      const refreshed = await api.proyectoTransferencia(remito.id);
      setEventos(refreshed.eventos || []);
      setRemito(refreshed.remito);
    } catch (e) {
      setError(e.message);
    }
  };

  const onItemScan = (rawOrParsed) => {
    setScanItem(false);
    validarScan(rawOrParsed);
  };

  const cerrarParcial = async () => {
    if (!remito?.id) return;
    setClosing(true);
    setError('');
    try {
      const data = await api.cerrarRecepcionParcialTransferencia(remito.id, {
        notas: notasCierre,
        usuario: user?.name || user?.email,
      });
      setRemito(data.remito);
      setEventos(data.eventos || []);
      setMsg(
        data.remito?.completo
          ? 'Remito cerrado completo.'
          : 'Recepción parcial registrada. Quedó en pendientes de cierre.'
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="page-title">Transferencias entre depósitos</h2>
          <p className="text-muted">
            Primero escaneá el QR del remito (inverso a la emisión). Luego validá cada ítem hasta
            completar el listado.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/proyectos/pendientes-cierre" className="btn btn-secondary">
            Remitos pendientes de cierre
          </Link>
          <Link to="/remito" className="btn btn-secondary">
            Emitir remito
          </Link>
        </div>
      </div>

      {!remito && (
        <div className="card space-y-3">
          <p className="font-medium">Abrir remito de transferencia</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" onClick={() => setScanRemito(true)}>
              Escanear QR del remito
            </button>
            <input
              className="input min-w-[240px] flex-1 font-mono text-sm"
              placeholder="ID remito o inv://r/…"
              value={manualRemito}
              onChange={(e) => setManualRemito(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-secondary"
              disabled={loading}
              onClick={() => {
                const id = extractRemitoId(manualRemito) || manualRemito.trim();
                loadRemito(id);
              }}
            >
              Cargar
            </button>
          </div>
        </div>
      )}

      {loading && <p className="text-muted">Cargando remito…</p>}
      {error && <p className="text-red-600 dark:text-red-300">{error}</p>}
      {msg && <p className="text-emerald-700 dark:text-emerald-300">{msg}</p>}

      {remito && (
        <div className="space-y-4">
          <div className="card flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold">
                Remito #{remito.numero}{' '}
                <span className="rounded bg-surface-2 px-2 py-0.5 text-sm font-normal">
                  {remito.estado}
                </span>
              </p>
              <p className="text-sm text-content-muted">
                {remito.almacenOrigen} → {remito.almacenDestino} · pendiente{' '}
                {remito.cantidadPendienteTotal} u. · recibido {remito.cantidadRecibidaTotal} u.
              </p>
              <p className="mt-1 font-mono text-xs text-content-muted">{remito.id}</p>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setRemito(null);
                setEventos([]);
                setSearchParams({}, { replace: true });
              }}
            >
              Otro remito
            </button>
          </div>

          {['en_transito', 'parcial'].includes(remito.estado) && (
            <>
              <div className="card space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">Ubicación destino (ingreso a stock)</p>
                  <button type="button" className="btn btn-secondary text-sm" onClick={applyAduana}>
                    Usar aduana de sede
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <input
                    className="input"
                    placeholder="Sede"
                    value={destSede}
                    onChange={(e) => setDestSede(e.target.value)}
                  />
                  <input
                    className="input"
                    placeholder="Almacén"
                    value={destAlmacen}
                    onChange={(e) => setDestAlmacen(e.target.value)}
                  />
                  <input
                    className="input"
                    placeholder="Armario"
                    value={destArmario}
                    onChange={(e) => setDestArmario(e.target.value)}
                  />
                  <input
                    className="input"
                    placeholder="Estante"
                    value={destEstante}
                    onChange={(e) => setDestEstante(e.target.value)}
                  />
                  <input
                    className="input sm:col-span-2"
                    placeholder="Contenedor (opcional)"
                    value={destContenedor}
                    onChange={(e) => setDestContenedor(e.target.value)}
                  />
                </div>
              </div>

              <div className="card space-y-3">
                <p className="font-medium">Validar ítems recibidos</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setScanItem(true)}
                    disabled={!destArmario || !destEstante}
                  >
                    Escanear ítem
                  </button>
                  <input
                    className="input min-w-[200px] flex-1"
                    placeholder="Código / ítem / QR"
                    value={manualItem}
                    onChange={(e) => setManualItem(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={!destArmario || !destEstante}
                    onClick={() => {
                      if (!manualItem.trim()) return;
                      validarScan(manualItem.trim());
                      setManualItem('');
                    }}
                  >
                    Validar
                  </button>
                </div>
                {(!destArmario || !destEstante) && (
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Indicá armario y estante destino (o usá aduana) antes de validar.
                  </p>
                )}
              </div>
            </>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="overflow-x-auto rounded-xl border border-edge">
              <div className="bg-surface-2 px-3 py-2 text-xs font-semibold uppercase text-content-muted">
                Pendientes ({pendientes.length})
              </div>
              <table className="w-full text-left text-sm">
                <tbody>
                  {pendientes.map((i) => (
                    <tr key={i.id} className="border-t border-edge">
                      <td className="px-3 py-2">
                        <div className="font-medium">{i.nombre || i.itemId}</div>
                        <div className="text-xs text-content-muted">
                          {i.cantidadRecibida}/{i.cantidad} · faltan {i.cantidadPendiente}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!pendientes.length && (
                    <tr>
                      <td className="px-3 py-3 text-muted">Ningún ítem pendiente</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="overflow-x-auto rounded-xl border border-edge">
              <div className="bg-surface-2 px-3 py-2 text-xs font-semibold uppercase text-content-muted">
                Validados ({completados.length})
              </div>
              <table className="w-full text-left text-sm">
                <tbody>
                  {completados.map((i) => (
                    <tr key={i.id} className="border-t border-edge">
                      <td className="px-3 py-2">
                        <div className="font-medium">{i.nombre || i.itemId}</div>
                        <div className="text-xs text-emerald-700 dark:text-emerald-300">
                          Completo {i.cantidadRecibida}/{i.cantidad}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!completados.length && (
                    <tr>
                      <td className="px-3 py-3 text-muted">Aún sin validaciones</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {['en_transito', 'parcial'].includes(remito.estado) && pendientes.length > 0 && (
            <div className="card space-y-2">
              <p className="font-medium">Cerrar con discrepancias</p>
              <p className="text-sm text-muted">
                Si no hay más ítems físicos pero faltan en el remito (o hubo extras), generá el
                informe y dejá el remito pendiente de cierre.
              </p>
              <textarea
                className="input min-h-[72px]"
                placeholder="Notas del informe…"
                value={notasCierre}
                onChange={(e) => setNotasCierre(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-secondary"
                disabled={closing}
                onClick={cerrarParcial}
              >
                {closing ? 'Guardando…' : 'Registrar recepción parcial'}
              </button>
            </div>
          )}

          {remito.recepcionInforme && (
            <div className="card space-y-2">
              <p className="font-medium">Informe de recepción</p>
              <pre className="overflow-x-auto rounded bg-surface-2 p-3 text-xs">
                {JSON.stringify(remito.recepcionInforme, null, 2)}
              </pre>
            </div>
          )}

          {eventos.length > 0 && (
            <div className="card">
              <p className="mb-2 font-medium">Eventos recientes</p>
              <ul className="space-y-1 text-sm">
                {eventos.slice(0, 20).map((e) => (
                  <li key={e.id} className="border-t border-edge py-1 first:border-0">
                    <span className="font-mono text-xs">{e.tipo}</span>
                    {e.codigo ? ` · ${e.codigo}` : ''}
                    {e.cantidad != null ? ` · x${e.cantidad}` : ''}
                    {e.notas ? ` — ${e.notas}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {scanRemito && (
        <QrScanner
          onScan={onRemitoScan}
          onClose={() => setScanRemito(false)}
          title="QR del remito de transferencia"
        />
      )}
      {scanItem && (
        <QrScanner
          onScan={onItemScan}
          onClose={() => setScanItem(false)}
          title="Escanear ítem recibido"
        />
      )}
    </div>
  );
}
