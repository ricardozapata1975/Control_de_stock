import { useEffect, useState } from 'react';
import { api } from '../../../api/client';
import { useAuth } from '../../../auth/AuthProvider';
import ItemDetailModal from '../../../components/ItemDetailModal';
import { fieldLabel } from '../../../utils/fieldLabels';
import CodigoCatalogoLink from '../../../components/CodigoCatalogoLink';

export default function DisponiblesPage() {
  const { sede } = useAuth();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailItem, setDetailItem] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = (term = q) => {
    setLoading(true);
    api
      .proyectosDisponiblesNetos({
        ...(sede ? { sede } : {}),
        ...(term ? { q: term } : {}),
      })
      .then((d) => {
        setItems(d.items || []);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sede]);

  const openDetail = async (it) => {
    setDetailLoading(true);
    setError('');
    try {
      let enriched = { ...it, cantidad: it.cantidadFisica };
      if (it.itemId) {
        const data = await api.inventario({
          itemId: it.itemId,
          ...(sede ? { sede } : {}),
        });
        const rows = data.items || [];
        if (rows.length) {
          const first = rows[0];
          enriched = {
            ...first,
            ...it,
            itemId: it.itemId,
            nombre: it.nombre || first.nombre,
            marca: it.marca || first.marca,
            modelo: it.modelo || first.modelo,
            tipo: it.tipo || first.tipo,
            detalle: it.detalle || first.detalle,
            codigoFabricante: it.codigoFabricante || first.codigoFabricante,
            imagenUrl: it.imagenUrl || first.imagenUrl,
            cantidad: it.cantidadFisica,
            ubicaciones: it.ubicaciones?.length
              ? it.ubicaciones
              : rows.map((r) => ({
                  stockId: r.stockId || r.id,
                  contenedorCodigo: r.contenedorCodigo || r.codigo,
                  almacen: r.almacen,
                  armario: r.armario,
                  estante: r.estante,
                  contenedor: r.contenedor,
                  cantidad: Number(r.cantidad || 0),
                })),
          };
        }
      }
      setDetailItem(enriched);
    } catch (e) {
      setError(e.message);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="page-title">Materiales disponibles (netos)</h2>
        <p className="text-muted">
          Stock del almacén general de la sede menos reservas activas (limbo). No incluye aduana,
          reservados ni producción{sede ? ` · sede ${sede}` : ''}. Tocá un renglón para ver el
          detalle.
        </p>
      </div>

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          load(q);
        }}
      >
        <input
          className="input min-w-[200px] flex-1"
          placeholder="Buscar nombre / código…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="submit" className="btn btn-secondary">
          Buscar
        </button>
      </form>

      {error && <p className="text-red-600 dark:text-red-300">{error}</p>}
      {(loading || detailLoading) && <p className="text-muted">Cargando…</p>}

      {!loading && !items.length && (
        <p className="text-muted">Sin stock neto para mostrar en esta sede.</p>
      )}

      {items.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-edge">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 text-xs uppercase text-content-muted">
              <tr>
                <th className="px-3 py-2">{fieldLabel('nombre')}</th>
                <th className="px-3 py-2">{fieldLabel('codigoFabricante')}</th>
                <th className="px-3 py-2 text-right">{fieldLabel('fisico')}</th>
                <th className="px-3 py-2 text-right">{fieldLabel('reservado')}</th>
                <th className="px-3 py-2 text-right">{fieldLabel('neto')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr
                  key={it.itemId}
                  className="cursor-pointer border-t border-edge transition hover:bg-surface-hover/60"
                  onClick={() => openDetail(it)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openDetail(it);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                >
                  <td className="px-3 py-2">
                    <div className="font-medium">{it.nombre || it.itemId}</div>
                    <div className="text-xs text-content-muted">
                      {[it.marca, it.modelo, it.tipo].filter(Boolean).join(' · ')}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <CodigoCatalogoLink codigo={it.codigoFabricante} className="text-xs" />
                  </td>
                  <td className="px-3 py-2 text-right">{it.cantidadFisica}</td>
                  <td className="px-3 py-2 text-right">{it.cantidadReservada}</td>
                  <td
                    className={`px-3 py-2 text-right font-semibold ${
                      it.cantidadDisponibleNeta < 0
                        ? 'text-red-600 dark:text-red-300'
                        : it.cantidadDisponibleNeta === 0
                          ? 'text-content-muted'
                          : 'text-emerald-700 dark:text-emerald-300'
                    }`}
                  >
                    {it.cantidadDisponibleNeta}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detailItem && (
        <ItemDetailModal
          item={detailItem}
          viewOnly
          onClose={() => setDetailItem(null)}
          stockBreakdown={{
            fisico: detailItem.cantidadFisica,
            reservado: detailItem.cantidadReservada,
            neto: detailItem.cantidadDisponibleNeta,
          }}
        />
      )}
    </div>
  );
}
