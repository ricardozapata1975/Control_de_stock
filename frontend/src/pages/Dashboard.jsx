import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useAuth } from '../auth/AuthProvider';
import { api } from '../api/client';
import LowStockAlert from '../components/LowStockAlert';
import SearchFilters from '../components/SearchFilters';
import InventoryTable from '../components/InventoryTable';
import PaginationBar from '../components/PaginationBar';
import ItemEditModal from '../components/ItemEditModal';
import { getUbicacionScanLabel, parsedFromCodigoParam } from '../utils/scanMatch';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 25;

export default function Dashboard() {
  const { isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    inventario,
    lowStock,
    loading,
    error,
    filters,
    setFilters,
    fetchInventario,
    clearError,
  } = useStore();

  const [editItem, setEditItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [catalogoAlmacenes, setCatalogoAlmacenes] = useState([]);

  useEffect(() => {
    api.catalogoUbicacion().then((cat) => setCatalogoAlmacenes(cat.almacenes || []));
  }, []);

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

  const armarios = useMemo(
    () => [...new Set(inventario.map((i) => i.armario).filter(Boolean))].sort(),
    [inventario]
  );
  const tipos = useMemo(
    () => [...new Set(inventario.map((i) => i.tipo).filter(Boolean))].sort(),
    [inventario]
  );

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
        onChange={(f) => {
          if ((f.armario !== undefined && f.armario) || (f.almacen !== undefined && f.almacen)) {
            setFilters({ ...f, codigo: '', scanType: '' });
            setSearchParams({});
          } else {
            setFilters(f);
          }
        }}
        almacenes={catalogoAlmacenes}
        armarios={armarios}
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
      <InventoryTable
        items={paginatedItems}
        isAdmin={isAdmin}
        onEdit={setEditItem}
        onDelete={handleDelete}
      />
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

      {editItem && (
        <ItemEditModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  );
}
