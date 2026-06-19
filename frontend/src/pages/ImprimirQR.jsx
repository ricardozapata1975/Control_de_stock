import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import QrLabel from '../components/QrLabel';
import SearchFilters from '../components/SearchFilters';
import {
  ALMACEN_DEFAULT,
  ESTANTES,
  buildUbicacionCodigo,
  getAlmacenNombre,
  getArmarioNombre,
  getArmariosForAlmacen,
} from '../utils/ubicacion';
import { QR_TYPES } from '../utils/qrPayload';

const TABS = [
  { id: QR_TYPES.ALMACEN, label: 'Almacén' },
  { id: QR_TYPES.ARMARIO, label: 'Armario' },
  { id: QR_TYPES.ESTANTE, label: 'Estante' },
  { id: QR_TYPES.CONTENEDOR, label: 'Contenedor' },
  { id: QR_TYPES.ITEM, label: 'Artículo' },
];

function itemLinea(item) {
  const tipo = item.tipo?.trim();
  return tipo ? `${item.nombre} - ${tipo}` : item.nombre;
}

function resolveContenedorCodigo(c) {
  const codigo = String(c.codigo || '').toUpperCase();
  if (/^ALM\d{2}/.test(codigo)) return codigo;
  const alm = String(c.almacen || ALMACEN_DEFAULT).toUpperCase();
  if (c.armario && c.estante) {
    return buildUbicacionCodigo(alm, c.armario, c.estante, c.contenedor);
  }
  return codigo;
}

function matchesAlmacenFilter(almacen, filter) {
  if (!filter) return true;
  return String(almacen || ALMACEN_DEFAULT).toUpperCase() === filter.toUpperCase();
}

export default function ImprimirQR() {
  const [tab, setTab] = useState(QR_TYPES.ALMACEN);
  const [inventario, setInventario] = useState([]);
  const [contenedores, setContenedores] = useState([]);
  const [catalogo, setCatalogo] = useState({
    almacenes: [],
    armariosPorAlmacen: {},
    estantes: ESTANTES,
  });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [filters, setFilters] = useState({ q: '', almacen: '', armario: '', tipo: '' });

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.inventario(filters),
      api.contenedores().catch(() => ({ contenedores: [] })),
      api.catalogoUbicacion().catch(() => ({
        almacenes: [],
        armariosPorAlmacen: {},
        estantes: ESTANTES,
      })),
    ])
      .then(([inv, cnt, cat]) => {
        setInventario(inv.items || []);
        setContenedores(cnt.contenedores || []);
        setCatalogo({
          almacenes: cat.almacenes || [],
          armariosPorAlmacen: cat.armariosPorAlmacen || {},
          estantes: cat.estantes?.length ? cat.estantes : ESTANTES,
        });
      })
      .finally(() => setLoading(false));
  }, [filters.q, filters.almacen, filters.armario, filters.tipo]);

  useEffect(() => {
    setSelected(new Set());
  }, [tab, filters.almacen, filters.armario]);

  const almacenes = useMemo(() => {
    if (catalogo.almacenes?.length) return catalogo.almacenes;
    return [{ codigo: ALMACEN_DEFAULT, nombre: getAlmacenNombre(ALMACEN_DEFAULT), tipo: 'Oficina' }];
  }, [catalogo.almacenes]);

  const tipos = useMemo(
    () => [...new Set(inventario.map((i) => i.tipo).filter(Boolean))].sort(),
    [inventario]
  );

  const articulos = useMemo(() => {
    const map = new Map();
    inventario.forEach((i) => {
      if (!i.itemId) return;
      if (!map.has(i.itemId)) map.set(i.itemId, i);
    });
    return [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [inventario]);

  const almacenesActivos = useMemo(() => {
    const almFilter = filters.almacen?.toUpperCase();
    if (almFilter) {
      return almacenes.filter((a) => a.codigo.toUpperCase() === almFilter);
    }
    return almacenes;
  }, [almacenes, filters.almacen]);

  const listaAlmacenes = useMemo(
    () =>
      almacenesActivos.map((a) => ({
        codigo: a.codigo,
        nombre: a.nombre || getAlmacenNombre(a.codigo),
        tipo: a.tipo,
      })),
    [almacenesActivos]
  );

  const listaArmarios = useMemo(() => {
    const map = new Map();
    const almFilter = filters.almacen?.toUpperCase();

    const almacenesTarget = almFilter
      ? almacenes.filter((a) => a.codigo.toUpperCase() === almFilter)
      : almacenes;

    almacenesTarget.forEach((alm) => {
      getArmariosForAlmacen(catalogo, alm.codigo).forEach((a) => {
        const codigo = buildUbicacionCodigo(alm.codigo, a.codigo);
        map.set(codigo, {
          codigo,
          almacen: alm.codigo,
          armario: a.codigo,
          nombre: a.nombre || getArmarioNombre(a.codigo, alm.codigo, catalogo.armariosPorAlmacen),
        });
      });
    });

    inventario.forEach((i) => {
      if (!i.armario) return;
      if (!matchesAlmacenFilter(i.almacen, filters.almacen)) return;
      const alm = String(i.almacen || ALMACEN_DEFAULT).toUpperCase();
      const codigo = buildUbicacionCodigo(alm, i.armario);
      if (!map.has(codigo)) {
        map.set(codigo, {
          codigo,
          almacen: alm,
          armario: i.armario,
          nombre: getArmarioNombre(i.armario, alm, catalogo.armariosPorAlmacen),
        });
      }
    });

    return [...map.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, [catalogo, almacenes, inventario, filters.almacen]);

  const listaEstantes = useMemo(() => {
    const map = new Map();
    const ests = catalogo.estantes?.length ? catalogo.estantes : ESTANTES;
    const almFilter = filters.almacen?.toUpperCase();
    const armFilter = filters.armario?.toUpperCase();

    const almacenesTarget = almFilter
      ? almacenes.filter((a) => a.codigo.toUpperCase() === almFilter)
      : almacenes;

    almacenesTarget.forEach((alm) => {
      const arms = getArmariosForAlmacen(catalogo, alm.codigo).filter(
        (a) => !armFilter || a.codigo.toUpperCase() === armFilter
      );
      arms.forEach((a) => {
        ests.forEach((e) => {
          const ec = e.codigo || e;
          const codigo = buildUbicacionCodigo(alm.codigo, a.codigo, ec);
          const armNombre =
            a.nombre || getArmarioNombre(a.codigo, alm.codigo, catalogo.armariosPorAlmacen);
          map.set(codigo, {
            codigo,
            almacen: alm.codigo,
            armario: a.codigo,
            estante: ec,
            nombre: `${armNombre} / ${ec}`,
          });
        });
      });
    });

    inventario.forEach((i) => {
      if (!i.armario || !i.estante) return;
      if (!matchesAlmacenFilter(i.almacen, filters.almacen)) return;
      if (armFilter && i.armario.toUpperCase() !== armFilter) return;
      const alm = String(i.almacen || ALMACEN_DEFAULT).toUpperCase();
      const codigo = buildUbicacionCodigo(alm, i.armario, i.estante);
      if (!map.has(codigo)) {
        map.set(codigo, {
          codigo,
          almacen: alm,
          armario: i.armario,
          estante: i.estante,
          nombre: `${getArmarioNombre(i.armario, alm, catalogo.armariosPorAlmacen)} / ${i.estante}`,
        });
      }
    });

    return [...map.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, [catalogo, almacenes, inventario, filters.almacen, filters.armario]);

  const listaContenedores = useMemo(() => {
    const map = new Map();
    const armFilter = filters.armario?.toUpperCase();

    contenedores.forEach((c) => {
      if (!matchesAlmacenFilter(c.almacen, filters.almacen)) return;
      if (armFilter && String(c.armario || '').toUpperCase() !== armFilter) return;
      const codigo = resolveContenedorCodigo(c);
      if (!codigo) return;
      map.set(codigo, {
        ...c,
        codigo,
        nombre: c.nombre || c.ubicacion || codigo,
      });
    });

    inventario.forEach((i) => {
      const cod = i.contenedorCodigo || resolveContenedorCodigo(i);
      if (!cod) return;
      if (!matchesAlmacenFilter(i.almacen, filters.almacen)) return;
      if (armFilter && String(i.armario || '').toUpperCase() !== armFilter) return;
      if (!map.has(cod)) {
        map.set(cod, {
          codigo: cod,
          almacen: i.almacen,
          armario: i.armario,
          estante: i.estante,
          contenedor: i.contenedor,
          nombre: cod,
        });
      }
    });

    return [...map.values()].sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)));
  }, [contenedores, inventario, filters.almacen, filters.armario]);

  const entries = useMemo(() => {
    switch (tab) {
      case QR_TYPES.ALMACEN:
        return listaAlmacenes.map((a) => ({
          key: `alm:${a.codigo}`,
          type: QR_TYPES.ALMACEN,
          codigo: a.codigo,
          titulo: a.codigo,
          subtitulo: a.nombre || getAlmacenNombre(a.codigo),
        }));
      case QR_TYPES.ARMARIO:
        return listaArmarios.map((a) => ({
          key: `arm:${a.codigo}`,
          type: QR_TYPES.ARMARIO,
          codigo: a.codigo,
          titulo: a.codigo,
          subtitulo: a.nombre || a.codigo,
        }));
      case QR_TYPES.ESTANTE:
        return listaEstantes.map((e) => ({
          key: `est:${e.codigo}`,
          type: QR_TYPES.ESTANTE,
          codigo: e.codigo,
          titulo: e.codigo,
          subtitulo: e.nombre || e.codigo,
        }));
      case QR_TYPES.CONTENEDOR:
        return listaContenedores.map((c) => ({
          key: `cnt:${c.codigo}`,
          type: QR_TYPES.CONTENEDOR,
          codigo: c.codigo,
          titulo: c.codigo,
          subtitulo: c.nombre || c.codigo,
        }));
      case QR_TYPES.ITEM:
        return articulos.map((i) => ({
          key: `item:${i.itemId}`,
          type: QR_TYPES.ITEM,
          itemId: i.itemId,
          codigo: i.itemId,
          titulo: i.itemId,
          subtitulo: itemLinea(i),
        }));
      default:
        return [];
    }
  }, [tab, listaAlmacenes, listaArmarios, listaEstantes, listaContenedores, articulos]);

  const filteredEntries = useMemo(() => {
    let list = entries;
    const armFilter = filters.armario?.toUpperCase();
    if (tab === QR_TYPES.ARMARIO && armFilter) {
      list = list.filter((e) => e.codigo.endsWith(`-${armFilter}`));
    }
    const q = filters.q.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (e) =>
        e.codigo?.toLowerCase().includes(q) ||
        e.itemId?.toLowerCase().includes(q) ||
        e.subtitulo?.toLowerCase().includes(q) ||
        e.titulo?.toLowerCase().includes(q)
    );
  }, [entries, tab, filters.q, filters.armario]);

  const toggle = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(filteredEntries.map((e) => e.key)));
  const clearAll = () => setSelected(new Set());
  const toPrint = filteredEntries.filter((e) => selected.has(e.key));

  const tabHint = {
    [QR_TYPES.ALMACEN]: 'Códigos ALM01, ALM02… (almacén completo).',
    [QR_TYPES.ARMARIO]: 'Códigos ALM02-A00, ALM01-A01… (armario / estantería).',
    [QR_TYPES.ESTANTE]: 'Códigos ALM02-A00-E01 (estante sin contenedor).',
    [QR_TYPES.CONTENEDOR]: 'Códigos ALM02-A00-E01-C05, …-B12, …-H01 o …-SC.',
    [QR_TYPES.ITEM]: 'QR con item_id para identificar cada herramienta.',
  };

  const showLocationFilters = tab !== QR_TYPES.ITEM;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h2 className="page-title">Etiquetas QR</h2>
          <p className="text-muted">{tabHint[tab]}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={selectAll}
            disabled={!filteredEntries.length}
          >
            Todos
          </button>
          <button type="button" className="btn-secondary text-sm" onClick={clearAll}>
            Ninguno
          </button>
          <button
            type="button"
            className="btn-primary text-sm"
            disabled={!toPrint.length}
            onClick={() => window.print()}
          >
            Imprimir ({toPrint.length})
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`rounded-lg px-4 py-2 text-sm font-bold uppercase tracking-wide ${
              tab === t.id
                ? 'bg-accent text-accent-foreground'
                : 'border border-border text-content-muted hover:bg-surface-hover hover:text-content'
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="print:hidden">
        <SearchFilters
          filters={filters}
          onChange={(f) => setFilters((prev) => ({ ...prev, ...f }))}
          almacenes={almacenes}
          armariosPorAlmacen={catalogo.armariosPorAlmacen}
          tipos={showLocationFilters ? [] : tipos}
        />
      </div>

      {loading && <p className="text-muted print:hidden">Cargando...</p>}

      {!loading && !filteredEntries.length && (
        <p className="text-muted print:hidden">Sin elementos para este tipo.</p>
      )}

      <div className="card mb-6 grid gap-2 print:hidden sm:grid-cols-2 lg:grid-cols-3">
        {filteredEntries.map((entry) => (
          <label
            key={entry.key}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3 text-content hover:bg-surface-hover"
          >
            <input
              type="checkbox"
              checked={selected.has(entry.key)}
              onChange={() => toggle(entry.key)}
              className="h-5 w-5 accent-accent"
            />
            <span className="min-w-0">
              <span className="block font-mono font-bold text-accent">{entry.titulo}</span>
              <span className="block truncate text-sm text-content-muted">{entry.subtitulo}</span>
            </span>
          </label>
        ))}
      </div>

      {!toPrint.length && !loading && filteredEntries.length > 0 ? (
        <p className="text-muted print:hidden">Seleccioná al menos una etiqueta.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-3">
          {toPrint.map((entry) => (
            <QrLabel
              key={entry.key}
              type={entry.type}
              codigo={entry.codigo}
              itemId={entry.itemId}
              titulo={entry.titulo}
              subtitulo={entry.subtitulo}
            />
          ))}
        </div>
      )}

      <style>{`
        @media print {
          header, nav, .print\\:hidden { display: none !important; }
          main { max-width: 100% !important; padding: 0 !important; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}
