/**
 * responsive.js — Utilidades de escalado responsive
 * ==================================================
 *
 * EXPORTS DISPONIBLES:
 *   scale(size)        → escalado horizontal (widths, paddings, margins, iconos)
 *   verticalScale(size) → escalado vertical (heights)
 *   moderateScale(size) → escalado suavizado para fuentes
 *   useAppScale()       → hook React con useWindowDimensions (más preciso)
 *
 * Base: 375px width · 812px height (iPhone SE/13 mini)
 *
 * ¿Cuál usar?
 *   → Fuera de componentes: scale, verticalScale, moderateScale
 *   → Dentro de componentes: useAppScale() te da valores dinámicos
 *
 * AMBAS APIs coexisten. No rompas ninguna.
 *
 * WEB: En monitores de PC, el ancho se limita a MAX_WEB_WIDTH (428px)
 * para que la UI no se estire. El contenedor visual (App.js) también
 * se limita a 428px y se centra.
 */

import { Platform, Dimensions, useWindowDimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

// ── Web cap: ancho máximo para que la UI no se hipertrofie ──────
const MAX_WEB_WIDTH = 428;

function capWidth(w) {
  if (Platform.OS === 'web' && w > MAX_WEB_WIDTH) {
    return MAX_WEB_WIDTH;
  }
  return w;
}

// ----------------------------------------------------------------
// API estática (funciones puras, funcionan fuera de componentes)
// ----------------------------------------------------------------

const EFFECTIVE_WIDTH = capWidth(SCREEN_WIDTH);

export const scale = (size) => (EFFECTIVE_WIDTH / BASE_WIDTH) * size;

export const verticalScale = (size) => (SCREEN_HEIGHT / BASE_HEIGHT) * size;

export const moderateScale = (size, factor = 0.5) =>
  size + (scale(size) - size) * factor;

// ----------------------------------------------------------------
// API dinámica (hook, se recalcula automáticamente)
// ----------------------------------------------------------------

export function useAppScale() {
  const { width, height } = useWindowDimensions();
  const effectiveWidth = capWidth(width);

  const s = (size) => (effectiveWidth / BASE_WIDTH) * size;
  const vs = (size) => (height / BASE_HEIGHT) * size;
  const fs = (size, factor = 0.5) => size + (s(size) - size) * factor;

  return {
    scale: s,
    verticalScale: vs,
    fontScale: fs,
    width: effectiveWidth,
    height,
  };
}
