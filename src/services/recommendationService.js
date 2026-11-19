/**
 * recommendationService.js
 * Reglas simples para sugerir prendas faltantes + marcas con links.
 * Hecho para demostrar la funcionalidad en la entrega (sin IA compleja).
 */

const BRAND_SUGGESTIONS = [
  {
    brand: 'Zara',
    category: 'Jean',
    itemName: 'Jean negro básico',
    url: 'https://www.zara.com/es/es/search?searchTerm=jean%20negro',
  },
  {
    brand: 'H&M',
    category: 'Remera',
    itemName: 'Remera básica blanca',
    url: 'https://www2.hm.com/es_es/search-results.html?q=remera%20blanca%20basica',
  },
  {
    brand: 'Pull&Bear',
    category: 'Pantalón',
    itemName: 'Pantalón recto negro',
    url: 'https://www.pullandbear.com/es/es/search/?q=pantalon%20recto%20negro',
  },
  {
    brand: 'Stradivarius',
    category: 'Campera',
    itemName: 'Campera oversize',
    url: 'https://www.stradivarius.com/es/es/search?q=campera%20oversize',
  },
];

const LOWER_BODY = ['Pantalón', 'Short', 'Falda', 'Pollera', 'Jean'];
const TOPS = [
  'Remera', 'Camisa', 'Blusa', 'Buzo', 'Sweater',
  'Top', 'Hoodie', 'Campera', 'Abrigo', 'Blazer',
];
const DRESSES = ['Vestido'];

/**
 * Sugiere un básico para completar el OUTFIT que se probó (no el clóset).
 * Regla: si probó solo arriba -> falta abajo; solo abajo -> falta arriba;
 * vestido -> una campera. `_wardrobeItems` queda por compatibilidad.
 */
export function getMissingItemSuggestion(_wardrobeItems = [], selectedItems = []) {
  if (!selectedItems.length) return null;

  const triedTop = selectedItems.some((i) => TOPS.includes(i.category));
  const triedBottom = selectedItems.some((i) => LOWER_BODY.includes(i.category));
  const triedDress = selectedItems.some((i) => DRESSES.includes(i.category));

  // Probó solo una parte de arriba → le falta abajo.
  if (triedTop && !triedBottom && !triedDress) {
    return BRAND_SUGGESTIONS.find((s) => s.category === 'Jean') || BRAND_SUGGESTIONS[0];
  }

  // Probó solo abajo → le falta arriba.
  if (triedBottom && !triedTop && !triedDress) {
    return BRAND_SUGGESTIONS.find((s) => s.category === 'Remera') || BRAND_SUGGESTIONS[1];
  }

  // Probó vestido → sugerir una campera para complementar.
  if (triedDress && !triedTop) {
    return BRAND_SUGGESTIONS.find((s) => s.category === 'Campera') || BRAND_SUGGESTIONS[3];
  }

  return null;
}
