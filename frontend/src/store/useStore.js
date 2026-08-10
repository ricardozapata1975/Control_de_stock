import { create } from 'zustand';
import { api } from '../api/client';

export const DEFAULT_FILTERS = {
  q: '',
  almacen: '',
  armario: '',
  estante: '',
  contenedor: '',
  tipo: '',
  familia: '',
  tema: '',
  codigo: '',
  scanType: '',
  sede: '',
};

const LEGACY_FILTER_KEYS = [
  'inventario-filters',
  'px-inventario-filters',
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

export function hasActiveInventoryFilters(filters = DEFAULT_FILTERS) {
  return !!(
    filters.q?.trim() ||
    filters.almacen ||
    filters.armario ||
    filters.estante ||
    filters.contenedor ||
    filters.tipo ||
    filters.familia?.trim() ||
    filters.tema?.trim() ||
    filters.codigo
  );
}

function buildInventarioParams(filters) {
  const params = {};
  const q = filters.q?.trim();
  if (q) params.q = q;
  if (filters.almacen) params.almacen = filters.almacen;
  if (filters.armario) params.armario = filters.armario;
  if (filters.estante) params.estante = filters.estante;
  if (filters.contenedor) params.contenedor = filters.contenedor;
  if (filters.tipo) params.tipo = filters.tipo;
  if (filters.familia?.trim()) params.familia = filters.familia.trim();
  if (filters.tema?.trim()) params.tema = filters.tema.trim();
  if (filters.codigo) params.codigo = filters.codigo;
  if (filters.sede) params.sede = filters.sede;
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

  resetFilters: () => {
    const sede = get().filters.sede || '';
    set({ filters: { ...DEFAULT_FILTERS, sede } });
  },

  /** Aplica la sucursal de sesión como filtro fijo de inventario. */
  setSessionSede: (sede) => {
    const code = String(sede || '').trim().toUpperCase();
    set({
      filters: {
        ...get().filters,
        sede: code,
        // al cambiar sucursal, limpiar almacén/armario que podrían no pertenecer
        almacen: '',
        armario: '',
        contenedor: '',
      },
    });
  },

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
      return { ok: true, offline: result.offline, data: result.result || null };
    } catch (e) {
      set({ error: e.message, loading: false });
      return { ok: false };
    }
  },

  registrarEgresoContenedor: async (payload, executeOrQueue) => {
    set({ loading: true, error: null });
    try {
      const result = await executeOrQueue('egreso_contenedor', payload);
      if (!result.offline) await get().fetchInventario();
      set({ loading: false });
      return { ok: true, offline: result.offline, data: result.result || null };
    } catch (e) {
      set({ error: e.message, loading: false });
      return { ok: false };
    }
  },

  registrarIngresoLote: async (payload, executeOrQueue) => {
    set({ loading: true, error: null });
    try {
      const result = await executeOrQueue('ingreso_lote', payload);
      if (!result.offline) await get().fetchInventario();
      set({ loading: false });
      return { ok: true, offline: result.offline, data: result.result || null };
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
      return { ok: true, offline: result.offline, data: result.result || null };
    } catch (e) {
      set({ error: e.message, loading: false });
      return { ok: false };
    }
  },

  clearError: () => set({ error: null }),
}));
