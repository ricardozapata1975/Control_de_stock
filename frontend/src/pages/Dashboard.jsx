import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStore, hasActiveInventoryFilters, cleanupLegacyFilterStorage, DEFAULT_FILTERS } from '../store/useStore';
import { useAuth } from '../auth/AuthProvider';
import { api } from '../api/client';
import LowStockAlert from '../components/LowStockAlert';
import SearchFilters from '../components/SearchFilters';
import InventoryTable from '../components/InventoryTable';
import PaginationBar from '../components/PaginationBar';
import ItemEditModal from '../components/ItemEditModal';
import ItemDetailModal from '../components/ItemDetailModal';
import AssignBarcodeModal from '../components/AssignBarcodeModal';
import CaptureItemPhotoModal from '../components/CaptureItemPhotoModal';
import ContenedorPanel from '../components/ContenedorPanel';
import { buildEgresoUrlForItem, getUbicacionScanLabel, parsedFromCodigoParam } from '../utils/scanMatch';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 25;

function resolveCodigoContenedorFiltrado({ filters, inventario, contenedoresCatalogo }) {
  const short = String(filters.contenedor || '').trim().toUpperCase();
  if (!short || short === 'SC') return null;
  const fromInv = (inventario || []).find(
    (i) => String(i.contenedor || '').toUpperCase() === short
  );
  const fromCat = (contenedoresCatalogo || []).find(
    (c) =>
      String(c.contenedor || '').toUpperCase() === short &&
      (!filters.almacen || c.almacen === filters.almacen) &&
      (!filters.armario || c.armario === filters.armario)
  );
  return fromInv?.contenedorCodigo || fromInv?.codigo || fromCat?.codigo || null;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { isAdmin, sede, sedeNombre } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    inventario,
    lowStock,
    loading,
    error,
    filters,
    setFilters,
    resetFilters,
    setSessionSede,
    fetchInventario,
    clearError,
  } = useStore();

  const [detailItem, setDetailItem] = useState(null);
  const [barcodeItem, setBarcodeItem] = useState(null);
  const [photoItem, setPhotoItem] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [catalogoAlmacenes, setCatalogoAlmacenes] = useState([]);
  const [armariosPorAlmacen, setArmariosPorAlmacen] = useState({});
  const [contenedoresCatalogo, setContenedoresCatalogo] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [kitData, setKitData] = useState(null);
  const [kitLoading, setKitLoading] = useState(false);
  const [kitError, setKitError] = useState('');

  useEffect(() => {
    cleanupLegacyFilterStorage();
    const codigo = searchParams.get('codigo');
    const tipoUbicacion = searchParams.get('tipoUbicacion') || '';
    if (codigo) {
      setFilters({
        ...DEFAULT_FILTERS,
        sede: sede || '',
        codigo,
        scanType: tipoUbicacion,
        armario: '',
        contenedor: '',
      });
    } else {
      resetFilters();
      if (sede) setSessionSede(sede);
    }
    // Solo al montar Inventario: no restaurar filtros de otra pantalla en la misma sesión.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (sede) setSessionSede(sede);
  }, [sede, setSessionSede]);

  useEffect(() => {
    Promise.all([
      api.catalogoUbicacion(sede ? { sede } : {}),
      api.tipos(),
      api.contenedores().catch(() => ({ contenedores: [] })),
    ]).then(([cat, tiposData, cnt]) => {
      setCatalogoAlmacenes(cat.almacenes || []);
      setArmariosPorAlmacen(cat.armariosPorAlmacen || {});
      setTipos(tiposData.tipos || []);
      setContenedoresCatalogo(cnt.contenedores || []);
    });
  }, [sede]);

  useEffect(() => {
    if (!catalogoAlmacenes.length && !tipos.length) return;

    const validAlmacenes = new Set(catalogoAlmacenes.map((a) => a.codigo));
    const patch = {};

    if (filters.almacen && !validAlmacenes.has(filters.almacen)) {
      patch.almacen = '';
      patch.armario = '';
      patch.contenedor = '';
    }

    if (filters.armario && filters.almacen) {
      const armarios = armariosPorAlmacen[filters.almacen] || [];
      const validArmarios = new Set(armarios.map((a) => a.codigo));
      if (!validArmarios.has(filters.armario)) {
        patch.armario = '';
        patch.contenedor = '';
      }
    }

    if (filters.tipo && tipos.length && !tipos.includes(filters.tipo)) {
      patch.tipo = '';
    }

    if (Object.keys(patch).length) {
      setFilters(patch);
    }
  }, [catalogoAlmacenes, armariosPorAlmacen, tipos, filters.almacen, filters.armario, filters.tipo, setFilters]);

  useEffect(() => {
    setPage(1);
  }, [filters.q, filters.almacen, filters.armario, filters.contenedor, filters.tipo, filters.familia, filters.tema, filters.codigo, filters.scanType, pageSize]);

  useEffect(() => {
    const codigo = searchParams.get('codigo');
    const tipoUbicacion = searchParams.get('tipoUbicacion') || '';
    if (codigo) {
      setFilters({ codigo, scanType: tipoUbicacion, armario: '', contenedor: '' });
    }
  }, [searchParams, setFilters]);

  useEffect(() => {
    fetchInventario();
  }, [filters.q, filters.almacen, filters.armario, filters.contenedor, filters.tipo, filters.familia, filters.tema, filters.codigo, filters.sede]);

  useEffect(() => {
    const codigo = resolveCodigoContenedorFiltrado({
      filters,
      inventario,
      contenedoresCatalogo,
    });
    if (!codigo) {
      setKitData(null);
      setKitError('');
      setKitLoading(false);
      return undefined;
    }

    let cancelled = false;
    setKitLoading(true);
    setKitError('');
    api
      .contenedor(codigo)
      .then((data) => {
        if (!cancelled) setKitData(data);
      })
      .catch((e) => {
        if (!cancelled) {
          setKitData(null);
          setKitError(e.message || 'No se pudo cargar el contenedor');
        }
      })
      .finally(() => {
        if (!cancelled) setKitLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    filters.contenedor,
    filters.almacen,
    filters.armario,
    inventario,
    contenedoresCatalogo,
  ]);

  const scanLabel = useMemo(() => {
    if (!filters.codigo) return null;
    const parsed = parsedFromCodigoParam(filters.codigo, filters.scanType);
    return getUbicacionScanLabel(parsed);
  }, [filters.codigo, filters.scanType]);

  const totalPages = Math.ceil(inventario.length / pageSize) || 1;

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return inventario.slice(start, start + pageSize);
  }, [inventario, page, pageSize]);

  const clearScanFilter = () => {
    setFilters({ codigo: '', scanType: '' });
    setSearchParams({});
  };

  const clearAllFilters = () => {
    resetFilters();
    setSearchParams({});
    setPage(1);
  };

  const activeFilters = hasActiveInventoryFilters(filters);

  const handleSave = async (form) => {
    if (!editItem?.itemId) return;
    setSaving(true);
    setActionError('');
    try {
      await api.adminUpdateItem(editItem.itemId, form);
      setEditItem(null);
      await fetchInventario();
    } catch (e) {
      setActionError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEgreso = (item) => {
    if (item.cantidad <= 0) return;
    setDetailItem(null);
    navigate(buildEgresoUrlForItem(item));
  };

  const handleEditFromDetail = (item) => {
    setDetailItem(null);
    setEditItem(item);
  };

  const handleDelete = async (item) => {
    if (
      !window.confirm(
        `¿Eliminar "${item.nombre}" del inventario?\nSe ocultará en todas sus ubicaciones.`
      )
    ) {
      return;
    }
    setActionError('');
    try {
      await api.adminBajaItem(item.itemId);
      setDetailItem(null);
      await fetchInventario();
    } catch (e) {
      setActionError(e.message);
    }
  };

  return (
    <div className="w-full min-w-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="page-title">Inventario</h2>
          {(sedeNombre || sede) && (
            <p className="text-sm text-muted">
              Sucursal: <strong className="text-content">{sedeNombre || sede}</strong>
            </p>
          )}
        </div>
        <button
          type="button"
          className="btn-secondary py-2 text-base"
          onClick={() => fetchInventario()}
          disabled={loading}
        >
          {loading ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      {(error || actionError) && (
        <div className="alert-error mb-4">
          {error || actionError}
          {error && (
            <button type="button" className="ml-2 underline hover:text-content" onClick={clearError}>
              Cerrar
            </button>
          )}
        </div>
      )}

      {filters.codigo && (
        <div className="alert-warning mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>
            <strong>Filtro QR:</strong> {scanLabel || filters.codigo}
            {' · '}
            {inventario.length} resultado{inventario.length !== 1 ? 's' : ''}
          </span>
          <button type="button" className="underline hover:text-content" onClick={clearScanFilter}>
            Quitar filtro
          </button>
        </div>
      )}

      <LowStockAlert items={lowStock} />
      <SearchFilters
        filters={filters}
        showClear={activeFilters}
        onClear={clearAllFilters}
        onChange={(f) => {
          if (
            (f.armario !== undefined && f.armario) ||
            (f.almacen !== undefined && f.almacen) ||
            (f.contenedor !== undefined && f.contenedor)
          ) {
            setFilters({ ...f, codigo: '', scanType: '' });
            setSearchParams({});
          } else {
            setFilters(f);
          }
        }}
        almacenes={catalogoAlmacenes}
        armariosPorAlmacen={armariosPorAlmacen}
        contenedores={contenedoresCatalogo}
        tipos={tipos}
      />

      {filters.contenedor && filters.contenedor !== 'SC' && (
        <div className="mb-4 space-y-3">
          <div className="card border-2 border-accent bg-accent/10">
            <p className="text-lg font-bold text-content">
              Retiro de kit · Contenedor{' '}
              <span className="font-mono text-accent">{filters.contenedor}</span>
            </p>
            <p className="mt-1 text-sm text-muted">
              Usá el botón de abajo para retirar todo el contenido (genera remito interno + QR de
              devolución). No uses la sección Remito de venta para esto.
            </p>
            {kitLoading && <p className="mt-2 text-sm text-muted">Cargando contenedor…</p>}
            {kitError && <div className="alert-error mt-2">{kitError}</div>}
          </div>
          {kitData && (
            <ContenedorPanel
              data={kitData}
              onRefresh={() => {
                fetchInventario();
                const codigo = resolveCodigoContenedorFiltrado({
                  filters,
                  inventario,
                  contenedoresCatalogo,
                });
                if (codigo) {
                  api.contenedor(codigo).then(setKitData).catch(() => {});
                }
              }}
            />
          )}
        </div>
      )}

      {inventario.length > 0 && (
        <PaginationBar
          page={page}
          totalPages={totalPages}
          totalItems={inventario.length}
          pageSize={pageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageSizeChange={setPageSize}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
        />
      )}
      <InventoryTable items={paginatedItems} onRowClick={setDetailItem} loading={loading} />
      {!loading && inventario.length === 0 && activeFilters && (
        <p className="mt-3 text-center text-sm text-content-muted">
          No hay resultados con los filtros actuales.{' '}
          <button type="button" className="underline hover:text-content" onClick={clearAllFilters}>
            Limpiar filtros
          </button>
        </p>
      )}
      {inventario.length > 0 && (
        <PaginationBar
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageSizeChange={setPageSize}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
        />
      )}

      {detailItem && (
        <ItemDetailModal
          item={detailItem}
          isAdmin={isAdmin}
          onClose={() => setDetailItem(null)}
          onEgreso={handleEgreso}
          onEdit={handleEditFromDetail}
          onDelete={handleDelete}
          onAssignBarcode={(item) => {
            setDetailItem(null);
            setBarcodeItem(item);
          }}
          onAssignPhoto={(item) => {
            setDetailItem(null);
            setPhotoItem(item);
          }}
        />
      )}

      {barcodeItem && (
        <AssignBarcodeModal
          item={barcodeItem}
          onClose={() => setBarcodeItem(null)}
          onSaved={() => {
            setBarcodeItem(null);
            fetchInventario();
          }}
        />
      )}

      {photoItem && (
        <CaptureItemPhotoModal
          item={photoItem}
          onClose={() => setPhotoItem(null)}
          onSaved={() => {
            setPhotoItem(null);
            fetchInventario();
          }}
        />
      )}

      {editItem && (
        <ItemEditModal
          item={editItem}
          tipos={tipos}
          onClose={() => setEditItem(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  );
}
