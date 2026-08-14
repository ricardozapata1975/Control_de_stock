/**
 * Ficha técnica Siemens (SiePortal) a partir del MLFB / codigo fabricante.
 * Ej.: 8PQ9158-2AA38 → https://sieportal.siemens.com/en-ua/products-services/detail/8PQ9158-2AA38?tree=CatalogTree
 *
 * MLFB típico: dígito + 2 letras + resto, al menos un guion (8PQ9158-2AA38, 3VA1116-5EF36-0AA0).
 */
const SIEMENS_DETAIL =
  'https://sieportal.siemens.com/en-ua/products-services/detail/{code}?tree=CatalogTree';

const MLFB_RE = /^\d[A-Z]{2}[A-Z0-9]*-[A-Z0-9]+(?:-[A-Z0-9]+)*$/i;

export function normalizeMlfb(code) {
  return String(code || '')
    .trim()
    .replace(/\s+/g, '');
}

export function isSiemensMlfb(code) {
  return MLFB_RE.test(normalizeMlfb(code));
}

export function siemensCatalogUrl(code) {
  const mlfb = normalizeMlfb(code);
  if (!MLFB_RE.test(mlfb)) return null;
  return SIEMENS_DETAIL.replace('{code}', encodeURIComponent(mlfb));
}
