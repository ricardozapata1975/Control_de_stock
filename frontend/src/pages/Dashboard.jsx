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
import { buildEgresoUrlForItem, getUbicacionScanLabel, parsedFromCodigoParam } from '../utils/scanMatch';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 25;

export default function Dashboard() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    inventario,
    lowStock,
    loading,
    error,
    filters,
    setFilters,
    resetFilters,
    fetchInventario,
    clearError,
  } = useStore();

  const [detailItem, setDetailItem] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [catalogoAlmacenes, setCatalogoAlmacenes] = useState([]);
  const [armariosPorAlmacen, setArmariosPorAlmacen] = useState({});
  const [tipos, setTipos] = useState([]);

  useEffect(() => {
    cleanupLegacyFilterStorage();
    const codigo = searchParams.get('codigo');
    const tipoUbicacion = searchParams.get('tipoUbicacion') || '';
    if (codigo) {
      setFilters({ ...DEFAULT_FILTERS, codigo, scanType: tipoUbicacion, armario: '' });
    } else {
      resetFilters();
    }
    // Solo al montar Inventario: no restaurar filtros de otra pantalla en la misma sesión.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    Promise.all([api.catalogoUbicacion(), api.tipos()]).then(([cat, tiposData]) => {
      setCatalogoAlmacenes(cat.almacenes || []);
      setArmariosPorAlmacen(cat.armariosPorAlmacen || {});
      setTipos(tiposData.tipos || []);
    });
  }, []);

  useEffect(() => {
    if (!catalogoAlmacenes.length && !tipos.length) return;

    const validAlmacenes = new Set(catalogoAlmacenes.map((a) => a.codigo));
    const patch = {};

    if (filters.almacen && !validAlmacenes.has(filters.almacen)) {
      patch.almacen = '';
      patch.armario = '';
    }

    if (filters.armario && filters.almacen) {
      const armarios = armariosPorAlmacen[filters.almacen] || [];
      const validArmarios = new Set(armarios.map((a) => a.codigo));
      if (!validArmarios.has(filters.armario)) {
        patch.armario = '';
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
  }, [filters.q, filters.almacen, filters.armario, filters.tipo, filters.codigo, filters.scanType, pageSize]);

  useEffect(() => {
    const codigo = searchParams.get('codigo');
    const tipoUbicacion = searchParams.get('tipoUbicacion') || '';
    if (codigo) {
      setFilters({ codigo, scanType: tipoUbicacion, armario: '' });
    }
  }, [searchParams, setFilters]);

  useEffect(() => {
    fetchInventario();
  }, [filters.q, filters.almacen, filters.armario, filters.tipo, filters.codigo]);

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
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="page-title">Inventario</h2>
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
          if ((f.armario !== undefined && f.armario) || (f.almacen !== undefined && f.almacen)) {
            setFilters({ ...f, codigo: '', scanType: '' });
            setSearchParams({});
          } else {
            setFilters(f);
          }
        }}
        almacenes={catalogoAlmacenes}
        armariosPorAlmacen={armariosPorAlmacen}
        tipos={tipos}
      />
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
