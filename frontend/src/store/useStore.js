import { create } from 'zustand';
import { api } from '../api/client';

export const DEFAULT_FILTERS = {
  q: '',
  almacen: '',
  armario: '',
  tipo: '',
  codigo: '',
  scanType: '',
};

const LEGACY_FILTER_KEYS = [
  'inventario_filters',
  'px_inventario_filters',
  'dashboard_filters',
  'inventario_filters_v1',
];

/** Limpia claves viejas de localStorage que podían dejar filtros bloqueados. */
export function cleanupLegacyFilterStorage() {
  if (typeof localStorage === 'undefined') return;
  for (const key of LEGACY_FILTER_KEYS) {
    localStorage.removeItem(key);
  }
}

export function hasActiveInventoryFilters(filters) {
  return Boolean(
    filters.q?.trim() ||
      filters.almacen ||
      filters.armario ||
      filters.tipo ||
      filters.codigo
  );
}

function buildInventarioParams(filters) {
  const params = {};
  const q = filters.q?.trim();
  if (q) params.q = q;
  if (filters.almacen) params.almacen = filters.almacen;
  if (filters.armario) params.armario = filters.armario;
  if (filters.tipo) params.tipo = filters.tipo;
  if (filters.codigo) params.codigo = filters.codigo;
  return params;
}

cleanupLegacyFilterStorage();

export const useStore = create((set, get) => ({
  inventario: [],
  lowStock: [],
  lowStockThreshold: 2,
  loading: false,
  error: null,
  filters: { ...DEFAULT_FILTERS },

  setFilters: (f) => set({ filters: { ...get().filters, ...f } }),

  resetFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),

  fetchInventario: async () => {
    set({ loading: true, error: null });
    try {
      const data = await api.inventario(buildInventarioParams(get().filters));
      set({
        inventario: data.items,
        lowStock: data.lowStock,
        lowStockThreshold: data.lowStockThreshold,
        loading: false,
      });
    } catch (e) {
      set({ error: e.message, loading: false });
    }
  },

  registrarEgreso: async (payload, executeOrQueue) => {
    set({ loading: true, error: null });
    try {
      const result = await executeOrQueue('egreso', payload);
      if (!result.offline) await get().fetchInventario();
      set({ loading: false });
      return { ok: true, offline: result.offline };
    } catch (e) {
      set({ error: e.message, loading: false });
      return { ok: false };
    }
  },

  registrarIngreso: async (payload, executeOrQueue) => {
    set({ loading: true, error: null });
    try {
      const result = await executeOrQueue('ingreso', payload);
      if (!result.offline) await get().fetchInventario();
      set({ loading: false });
      return { ok: true, offline: result.offline };
    } catch (e) {
      set({ error: e.message, loading: false });
      return { ok: false };
    }
  },

  clearError: () => set({ error: null }),
}));
