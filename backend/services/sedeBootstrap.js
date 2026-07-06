/** Ubicación transitoria (aduana) por sede para recepción de transferencias */

export const ADUANA_ARMARIO = 'A00';
export const ADUANA_ESTANTE = 'E01';
export const ADUANA_CONTENEDOR = 'C01';

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

/** Asegura sede Ballester y aduana para sedes existentes sin aduana */
export function bootstrapSedesCatalog(catalogo) {
  const c = { ...catalogo };
  c.sedes = c.sedes || {};
  c.almacenes = c.almacenes || {};
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
  }

  return c;
}
