import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { api } from '../api/client';
import InventoryTable from '../components/InventoryTable';
import ItemThumb from '../components/ItemThumb';
import { formatUbicacionLabel } from '../utils/contenedor';

export default function ConsultaSucursales() {
  const { sede, sedeNombre, user } = useAuth();
  const [sedes, setSedes] = useState([]);
  const [sedeConsulta, setSedeConsulta] = useState('');
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selected, setSelected] = useState(null);
  const [cantidad, setCantidad] = useState(1);
  const [mensaje, setMensaje] = useState('');
  const [sending, setSending] = useState(false);

  const otrasSedes = useMemo(
    () => (sedes || []).filter((s) => s.codigo !== sede),
    [sedes, sede]
  );

  const sedeConsultaInfo = otrasSedes.find((s) => s.codigo === sedeConsulta);

  useEffect(() => {
    api
      .catalogoUbicacion()
      .then((cat) => {
        const list = cat.sedes || [];
        setSedes(list);
        const firstOther = list.find((s) => s.codigo !== sede);
        if (firstOther) setSedeConsulta(firstOther.codigo);
      })
      .catch((e) => setError(e.message));
  }, [sede]);

  const load = async (opts = {}) => {
    const target = opts.sede || sedeConsulta;
    if (!target) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.inventario({
        sede: target,
        q: opts.q !== undefined ? opts.q : q,
        visiblesOtrasSedes: 1,
      });
      setItems(data.items || []);
    } catch (e) {
      setError(e.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sedeConsulta) load({ sede: sedeConsulta });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sedeConsulta]);

  const onSearch = (e) => {
    e.preventDefault();
    load();
  };

  const openSolicitud = (item) => {
    setSelected(item);
    setCantidad(1);
    setMensaje('');
    setSuccess('');
    setError('');
  };

  const closeSolicitud = () => {
    if (sending) return;
    setSelected(null);
  };

  const submitSolicitud = async (e) => {
    e.preventDefault();
    if (!selected || !sedeConsulta) return;
    setSending(true);
    setError('');
    setSuccess('');
    try {
      const result = await api.solicitarEnvio({
        itemId: selected.itemId,
        stockId: selected.stockId || selected.id,
        cantidad: Number(cantidad),
        sedeOrigen: sede,
        sedeDestino: sedeConsulta,
        mensaje: mensaje.trim(),
      });
      setSuccess(result.message || 'Solicitud enviada');
      setSelected(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="w-full min-w-0">
      <div className="mb-4">
        <h2 className="page-title">Consulta otras sucursales</h2>
        <p className="mt-1 text-sm text-muted">
          Solo lectura. Tu sucursal activa es{' '}
          <strong className="text-content">{sedeNombre || sede || '—'}</strong>. Se muestra el stock
          de depósitos habilitados para otras sucursales (no aduana, reservados, producción ni
          pañol, salvo que los actives en Locaciones). Podés pedir envío por correo; el stock no se
          mueve solo.
        </p>
      </div>

      {otrasSedes.length === 0 ? (
        <p className="card text-muted">
          No hay otras sucursales cargadas. Creá más sedes en Admin → Sedes y aduanas.
        </p>
      ) : (
        <>
          <form
            onSubmit={onSearch}
            className="card mb-4 flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="min-w-0 flex-1">
              <label className="text-label">Sucursal a consultar</label>
              <select
                className="input-field"
                value={sedeConsulta}
                onChange={(e) => setSedeConsulta(e.target.value)}
              >
                {otrasSedes.map((s) => (
                  <option key={s.codigo} value={s.codigo}>
                    {s.nombre || s.codigo}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0 flex-[2]">
              <label className="text-label">Buscar</label>
              <input
                className="input-field"
                placeholder="Nombre, marca, tipo…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-secondary" disabled={loading}>
              {loading ? 'Buscando…' : 'Buscar'}
            </button>
          </form>

          {error && <div className="alert-error mb-4">{error}</div>}
          {success && <div className="alert-success mb-4">{success}</div>}

          <p className="mb-2 text-sm text-muted">
            Inventario de{' '}
            <strong className="text-content">
              {sedeConsultaInfo?.nombre || sedeConsulta}
            </strong>
            : {items.length} resultado{items.length !== 1 ? 's' : ''}
          </p>

          <InventoryTable items={items} loading={loading} onRowClick={openSolicitud} />
        </>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
          onClick={closeSolicitud}
          role="presentation"
        >
          <div
            className="card max-h-[90vh] w-full max-w-lg overflow-y-auto p-4"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="solicitud-envio-title"
          >
            <div className="mb-3 flex items-start gap-3">
              <ItemThumb item={selected} />
              <div className="min-w-0 flex-1">
                <h3 id="solicitud-envio-title" className="text-lg font-bold text-content">
                  Solicitar envío
                </h3>
                <p className="break-words font-medium text-content">{selected.nombre}</p>
                <p className="text-xs text-muted">{formatUbicacionLabel(selected)}</p>
                <p className="mt-1 text-sm">
                  Stock en {sedeConsultaInfo?.nombre || sedeConsulta}:{' '}
                  <strong>{selected.cantidad}</strong>
                </p>
              </div>
            </div>

            <form onSubmit={submitSolicitud} className="space-y-3">
              <div>
                <label className="text-label">Cantidad a solicitar *</label>
                <input
                  type="number"
                  min={1}
                  max={selected.cantidad}
                  className="input-field"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-label">Mensaje (opcional)</label>
                <textarea
                  className="input-field min-h-[80px]"
                  placeholder={`Ej: Necesitamos para obra, retirar de ${sedeNombre || sede}`}
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                />
              </div>
              <p className="text-xs text-subtle">
                Se enviará un mail a los administradores. Solicitante: {user?.name || user?.username}.
                Destino del pedido: {sedeNombre || sede}.
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="submit" className="btn-primary" disabled={sending}>
                  {sending ? 'Enviando…' : 'Enviar solicitud'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={closeSolicitud}
                  disabled={sending}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
