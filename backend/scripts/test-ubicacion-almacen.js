#!/usr/bin/env node
/**
 * Prueba unitaria ligera: lookup de contenedores por almacén.
 * Uso: node backend/scripts/test-ubicacion-almacen.js
 */
import {
  ALMACEN_DEFAULT,
  applyCatalogo,
  buildCodigo,
  codigoLookupVariants,
  contenedorMatchesParsed,
  parseCodigo,
} from '../services/ubicacionUtils.js';

applyCatalogo({
  almacenes: {
    ALM01: {
      tipo: 'Oficina',
      nombre: 'Oficina principal',
      armarios: { A00: { nombre: 'Armario Papelería', tipo: 'armario' } },
    },
    ALM02: {
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

console.log(`\nResultado: ${passed} ok, ${failed} fallos`);
if (failed > 0) process.exit(1);
console.log('Todas las pruebas de almacén pasaron.');
