#!/usr/bin/env node
/**
 * Prueba unitaria ligera: lookup de contenedores por almacén.
 * Uso: node backend/scripts/test-ubicacion-almacen.js
 */
import {
  ALMACEN_DEFAULT,
  applyCatalogo,
  buildCodigo,
  buildCodigoCompleto,
  canonicalAlmacenCode,
  codigoLookupVariants,
  contenedorMatchesParsed,
  normalizeAlmacen,
  parseCodigo,
  SEDE_DEFAULT,
} from '../services/ubicacionUtils.js';

applyCatalogo({
  sedes: {
    SED001: { nombre: 'Oficina Ballester' },
    SED002: { nombre: 'Oficina Santa Fe' },
  },
  almacenes: {
    ALM01: {
      sede: 'SED001',
      tipo: 'Oficina',
      nombre: 'Oficina principal',
      armarios: { A00: { nombre: 'Armario Papelería', tipo: 'armario' } },
    },
    ALM02: {
      sede: 'SED002',
      tipo: 'Depósito',
      nombre: 'Jaula primer piso',
      armarios: { A00: { nombre: 'Estantería jaula', tipo: 'estantería' } },
    },
  },
});

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed += 1;
    return;
  }
  failed += 1;
  console.error(`FAIL: ${msg}`);
}

// ALM02 no debe incluir código legacy sin prefijo
const parsedAlm02 = parseCodigo('ALM02-A00-E01');
const variantsAlm02 = codigoLookupVariants(parsedAlm02);
assert(!variantsAlm02.includes('A00-E01'), 'ALM02 no debe buscar A00-E01 legacy');
assert(variantsAlm02.includes('ALM02-A00-E01'), 'ALM02 debe buscar ALM02-A00-E01');

// ALM01 sí incluye legacy
const parsedAlm01 = {
  almacen: ALMACEN_DEFAULT,
  armario: 'A00',
  estante: 'E01',
  contenedor: null,
  codigo: 'A00-E01',
};
const variantsAlm01 = codigoLookupVariants(parsedAlm01);
assert(variantsAlm01.includes('A00-E01'), 'ALM01 debe incluir A00-E01 legacy');

// contenedorMatchesParsed rechaza cruce de almacén
const legacyCont = { codigo: 'A00-E01', almacen: 'ALM01', armario: 'A00', estante: 'E01' };
assert(
  !contenedorMatchesParsed(legacyCont, parsedAlm02),
  'Contenedor ALM01 no debe coincidir con ubicación ALM02'
);
assert(
  contenedorMatchesParsed(legacyCont, parsedAlm01),
  'Contenedor ALM01 debe coincidir con ubicación ALM01'
);

const prefixedCont = { codigo: 'ALM02-A00-E01', almacen: 'ALM02', armario: 'A00', estante: 'E01' };
assert(
  contenedorMatchesParsed(prefixedCont, parsedAlm02),
  'Contenedor ALM02 prefijado debe coincidir con ALM02'
);

// buildCodigo con almacén explícito
assert(
  buildCodigo('ALM02', 'A00', 'E01', null) === 'ALM02-A00-E01',
  'buildCodigo debe prefijar ALM02'
);

// ALM002 → ALM02 (cero extra al escribir manualmente)
assert(canonicalAlmacenCode('ALM002') === 'ALM02', 'ALM002 debe normalizarse a ALM02');
assert(normalizeAlmacen('ALM002') === 'ALM02', 'normalizeAlmacen acepta ALM002');

// Código completo con sede
const fullSede = buildCodigoCompleto({
  sede: 'SED001',
  almacen: 'ALM01',
  armario: 'A00',
  estante: 'E01',
  contenedor: 'C01',
});
assert(fullSede === 'SED001-ALM01-A00-E01-C01', 'buildCodigoCompleto con sede');

const parsedSede = parseCodigo('SED001-ALM01-A00-E01-C01');
assert(parsedSede?.sede === 'SED001', 'parseCodigo extrae sede');
assert(parsedSede?.almacen === 'ALM01', 'parseCodigo extrae almacén con sede');

const variantsSede = codigoLookupVariants(parsedSede);
assert(variantsSede.includes('SED001-ALM01-A00-E01-C01'), 'variantes incluyen código con sede');
assert(variantsSede.includes('A00-E01-C01'), 'variantes incluyen legacy ALM01');

console.log(`\nResultado: ${passed} ok, ${failed} fallos`);
if (failed > 0) process.exit(1);
console.log('Todas las pruebas de almacén pasaron.');
