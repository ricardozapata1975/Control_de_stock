import { create } from 'zustand';
import { api } from '../api/client';

export const useStore = create((set, get) => ({
  inventario: [],
  lowStock: [],
  lowStockThreshold: 2,
  loading: false,
  error: null,
  filters: { q: '', almacen: '', armario: '', tipo: '', codigo: '', scanType: '' },

  setFilters: (f) => set({ filters: { ...get().filters, ...f } }),

  fetchInventario: async () => {
    set({ loading: true, error: null });
    try {
      const { q, almacen, armario, tipo, codigo } = get().filters;
      const data = await api.inventario({ q, almacen, armario, tipo, codigo });
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
