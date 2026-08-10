/** Ubicación transitoria (aduana) por sede para recepción de transferencias */

export const ADUANA_ARMARIO = 'A00';
export const ADUANA_ESTANTE = 'E01';
export const ADUANA_CONTENEDOR = 'C01';

export const PROYECTOS_ARMARIO = 'A00';
export const PROYECTOS_ESTANTE = 'E00';

export const HERRAMIENTAS_ARMARIO = 'A00';
export const HERRAMIENTAS_ESTANTE = 'E00';
export const HERRAMIENTAS_CONTENEDOR = 'C01';

export function nextAlmacenCode(catalogo) {
  let num = catalogo.nextAlmacenNum || Object.keys(catalogo.almacenes || {}).length + 1;
  let code;
  do {
    code = `ALM${String(num).padStart(2, '0')}`;
    num += 1;
  } while (catalogo.almacenes?.[code]);
  catalogo.nextAlmacenNum = num;
  return code;
}

export function nextSedeCode(catalogo) {
  let num = catalogo.nextSedeNum || Object.keys(catalogo.sedes || {}).length + 1;
  let code;
  do {
    code = `SED${String(num).padStart(3, '0')}`;
    num += 1;
  } while (catalogo.sedes?.[code]);
  catalogo.nextSedeNum = num;
  return code;
}

/** Crea almacén aduana + gabinete inicial para una sede */
export function createAduanaForSede(catalogo, sedeCode, sedeNombre) {
  const almCode = nextAlmacenCode(catalogo);
  catalogo.almacenes = catalogo.almacenes || {};
  catalogo.almacenes[almCode] = {
    sede: sedeCode,
    tipo: 'Depósito',
    nombre: `Recepción tránsito — ${sedeNombre}`,
    esAduana: true,
    armarios: {
      [ADUANA_ARMARIO]: {
        nombre: 'Gabinete recepción (Aduana)',
        tipo: 'gabinete',
      },
    },
    nextArmarioNum: 1,
  };

  const aduana = {
    almacen: almCode,
    armario: ADUANA_ARMARIO,
    estante: ADUANA_ESTANTE,
    contenedor: ADUANA_CONTENEDOR,
  };

  catalogo.sedes[sedeCode].aduana = aduana;
  return aduana;
}

function findAlmacenByFlag(catalogo, sedeCode, flag) {
  return Object.entries(catalogo.almacenes || {}).find(
    ([, info]) => info?.sede === sedeCode && info?.[flag]
  )?.[0];
}

function findAlmacenByNombreHint(catalogo, sedeCode, hints) {
  return Object.entries(catalogo.almacenes || {}).find(([_, info]) => {
    if (info?.sede !== sedeCode) return false;
    const n = String(info?.nombre || '').toLowerCase();
    return hints.some((h) => n.includes(h));
  })?.[0];
}

/**
 * Almacenes lógicos de Proyectos por sede:
 * - Reservados: compromiso limbo (stock físico sigue en depósito general)
 * - Producción: materiales ya retirados para armar tableros
 */
export function ensureProyectosAlmacenesForSede(catalogo, sedeCode, sedeNombre) {
  catalogo.almacenes = catalogo.almacenes || {};
  catalogo.sedes = catalogo.sedes || {};
  catalogo.proyectosAlmacenes = catalogo.proyectosAlmacenes || {};
  const sedeInfo = catalogo.sedes[sedeCode] || { nombre: sedeNombre || sedeCode };
  catalogo.sedes[sedeCode] = sedeInfo;

  const cfg = catalogo.proyectosAlmacenes[sedeCode] || {};

  let reservadosCode =
    cfg.reservados ||
    sedeInfo.reservados?.almacen ||
    findAlmacenByFlag(catalogo, sedeCode, 'esReservados') ||
    findAlmacenByNombreHint(catalogo, sedeCode, ['materiales reservados', 'reservados (proyectos)']);

  if (!reservadosCode || !catalogo.almacenes[reservadosCode]) {
    reservadosCode = nextAlmacenCode(catalogo);
    catalogo.almacenes[reservadosCode] = {
      sede: sedeCode,
      tipo: 'Depósito',
      nombre: `Materiales reservados — ${sedeNombre || sedeCode}`,
      esReservados: true,
      armarios: {
        [PROYECTOS_ARMARIO]: {
          nombre: 'Limbo / comprometidos (sin egreso físico)',
          tipo: 'gabinete',
        },
      },
      nextArmarioNum: 1,
    };
  } else {
    catalogo.almacenes[reservadosCode].esReservados = true;
    catalogo.almacenes[reservadosCode].sede = sedeCode;
  }

  let produccionCode =
    cfg.produccion ||
    sedeInfo.produccion?.almacen ||
    findAlmacenByFlag(catalogo, sedeCode, 'esProduccion') ||
    findAlmacenByNombreHint(catalogo, sedeCode, ['producción', 'produccion', 'armado de tableros']);

  if (!produccionCode || !catalogo.almacenes[produccionCode]) {
    produccionCode = nextAlmacenCode(catalogo);
    catalogo.almacenes[produccionCode] = {
      sede: sedeCode,
      tipo: 'Depósito',
      nombre: `Producción / Armado tableros — ${sedeNombre || sedeCode}`,
      esProduccion: true,
      armarios: {
        [PROYECTOS_ARMARIO]: {
          nombre: 'Material en tableros / taller',
          tipo: 'gabinete',
        },
      },
      nextArmarioNum: 1,
    };
  } else {
    catalogo.almacenes[produccionCode].esProduccion = true;
    catalogo.almacenes[produccionCode].sede = sedeCode;
  }

  sedeInfo.reservados = {
    almacen: reservadosCode,
    armario: PROYECTOS_ARMARIO,
    estante: PROYECTOS_ESTANTE,
  };
  sedeInfo.produccion = {
    almacen: produccionCode,
    armario: PROYECTOS_ARMARIO,
    estante: PROYECTOS_ESTANTE,
  };
  catalogo.proyectosAlmacenes[sedeCode] = {
    reservados: reservadosCode,
    produccion: produccionCode,
  };

  return { reservados: reservadosCode, produccion: produccionCode };
}

/**
 * Depósito Pañol / Herramientas por sede (préstamos a operarios).
 */
export function ensureHerramientasAlmacenForSede(catalogo, sedeCode, sedeNombre) {
  catalogo.almacenes = catalogo.almacenes || {};
  catalogo.sedes = catalogo.sedes || {};
  catalogo.herramientasAlmacenes = catalogo.herramientasAlmacenes || {};
  const sedeInfo = catalogo.sedes[sedeCode] || { nombre: sedeNombre || sedeCode };
  catalogo.sedes[sedeCode] = sedeInfo;

  let herramientasCode =
    catalogo.herramientasAlmacenes[sedeCode] ||
    sedeInfo.herramientas?.almacen ||
    findAlmacenByFlag(catalogo, sedeCode, 'esHerramientas') ||
    findAlmacenByNombreHint(catalogo, sedeCode, ['herramientas / pañol', 'pañol', 'panol']);

  if (!herramientasCode || !catalogo.almacenes[herramientasCode]) {
    herramientasCode = nextAlmacenCode(catalogo);
    catalogo.almacenes[herramientasCode] = {
      sede: sedeCode,
      tipo: 'Depósito',
      nombre: `Herramientas / Pañol — ${sedeNombre || sedeCode}`,
      esHerramientas: true,
      armarios: {
        [HERRAMIENTAS_ARMARIO]: {
          nombre: 'Pañol de herramientas',
          tipo: 'gabinete',
        },
      },
      nextArmarioNum: 1,
    };
  } else {
    catalogo.almacenes[herramientasCode].esHerramientas = true;
    catalogo.almacenes[herramientasCode].sede = sedeCode;
    if (!catalogo.almacenes[herramientasCode].nombre) {
      catalogo.almacenes[herramientasCode].nombre = `Herramientas / Pañol — ${sedeNombre || sedeCode}`;
    }
  }

  sedeInfo.herramientas = {
    almacen: herramientasCode,
    armario: HERRAMIENTAS_ARMARIO,
    estante: HERRAMIENTAS_ESTANTE,
    contenedor: HERRAMIENTAS_CONTENEDOR,
  };
  catalogo.herramientasAlmacenes[sedeCode] = herramientasCode;

  return { herramientas: herramientasCode };
}

/** Marca flags especiales según refs de sede (tras cargar desde DB sin columnas extra). */
export function annotateSpecialAlmacenes(catalogo) {
  const c = catalogo;
  c.almacenes = c.almacenes || {};
  for (const [sedeCode, sedeInfo] of Object.entries(c.sedes || {})) {
    const aduanaAlm = sedeInfo?.aduana?.almacen;
    if (aduanaAlm && c.almacenes[aduanaAlm]) {
      c.almacenes[aduanaAlm].esAduana = true;
      c.almacenes[aduanaAlm].sede = c.almacenes[aduanaAlm].sede || sedeCode;
    }
    const resAlm = sedeInfo?.reservados?.almacen || c.proyectosAlmacenes?.[sedeCode]?.reservados;
    if (resAlm && c.almacenes[resAlm]) {
      c.almacenes[resAlm].esReservados = true;
    }
    const prodAlm = sedeInfo?.produccion?.almacen || c.proyectosAlmacenes?.[sedeCode]?.produccion;
    if (prodAlm && c.almacenes[prodAlm]) {
      c.almacenes[prodAlm].esProduccion = true;
    }
    const herrAlm =
      sedeInfo?.herramientas?.almacen || c.herramientasAlmacenes?.[sedeCode];
    if (herrAlm && c.almacenes[herrAlm]) {
      c.almacenes[herrAlm].esHerramientas = true;
    }
  }
  return c;
}

/** Asegura sede Ballester, aduana y almacenes de Proyectos para sedes existentes */
export function bootstrapSedesCatalog(catalogo) {
  const c = { ...catalogo };
  c.sedes = c.sedes || {};
  c.almacenes = c.almacenes || {};
  c.proyectosAlmacenes = c.proyectosAlmacenes || {};
  c.herramientasAlmacenes = c.herramientasAlmacenes || {};
  if (!c.nextSedeNum) {
    c.nextSedeNum = Math.max(2, Object.keys(c.sedes).length + 1);
  }
  if (!c.nextAlmacenNum) {
    c.nextAlmacenNum = Math.max(2, Object.keys(c.almacenes).length + 1);
  }

  if (!c.sedes.SED001) {
    c.sedes.SED001 = { nombre: 'Oficina Ballester' };
  } else if (!c.sedes.SED001.nombre || c.sedes.SED001.nombre === 'Sede principal') {
    c.sedes.SED001.nombre = 'Oficina Ballester';
  }

  if (c.almacenes.ALM01 && !c.almacenes.ALM01.sede) {
    c.almacenes.ALM01.sede = 'SED001';
  }

  for (const [sedeCode, sedeInfo] of Object.entries(c.sedes)) {
    if (!sedeInfo.aduana?.almacen) {
      createAduanaForSede(c, sedeCode, sedeInfo.nombre || sedeCode);
    }
    ensureProyectosAlmacenesForSede(c, sedeCode, sedeInfo.nombre || sedeCode);
    ensureHerramientasAlmacenForSede(c, sedeCode, sedeInfo.nombre || sedeCode);
  }

  return annotateSpecialAlmacenes(c);
}
