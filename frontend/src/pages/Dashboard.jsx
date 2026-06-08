import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useAuth } from '../auth/AuthProvider';
import { api } from '../api/client';
import LowStockAlert from '../components/LowStockAlert';
import SearchFilters from '../components/SearchFilters';
import InventoryTable from '../components/InventoryTable';
import ItemEditModal from '../components/ItemEditModal';
import { getUbicacionScanLabel, parsedFromCodigoParam } from '../utils/scanMatch';

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

  useEffect(() => {
    const codigo = searchParams.get('codigo');
    const tipoUbicacion = searchParams.get('tipoUbicacion') || '';
    if (codigo) {
      setFilters({ codigo, scanType: tipoUbicacion, armario: '' });
    }
  }, [searchParams, setFilters]);

  useEffect(() => {
    fetchInventario();
  }, [filters.q, filters.armario, filters.tipo, filters.codigo]);

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
            <button type="button" className="ml-2 underline hover:text-white" onClick={clearError}>
              Cerrar
            </button>
          )}
        </div>
      )}

      {filters.codigo && (
        <div className="alert-warning mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>
            <strong className="text-amber-100">Filtro QR:</strong> {scanLabel || filters.codigo}
            {' · '}
            {inventario.length} resultado{inventario.length !== 1 ? 's' : ''}
          </span>
          <button type="button" className="text-amber-200 underline hover:text-white" onClick={clearScanFilter}>
            Quitar filtro
          </button>
        </div>
      )}

      <LowStockAlert items={lowStock} />
      <SearchFilters
        filters={filters}
        onChange={(f) => {
          if (f.armario !== undefined && f.armario) {
            setFilters({ ...f, codigo: '', scanType: '' });
            setSearchParams({});
          } else {
            setFilters(f);
          }
        }}
        armarios={armarios}
        tipos={tipos}
      />
      <InventoryTable
        items={inventario}
        isAdmin={isAdmin}
        onEdit={setEditItem}
        onDelete={handleDelete}
      />

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
