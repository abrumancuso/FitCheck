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
 */

import { Dimensions, useWindowDimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

// ----------------------------------------------------------------
// API estática (funciones puras, funcionan fuera de componentes)
// ----------------------------------------------------------------

export const scale = (size) => (SCREEN_WIDTH / BASE_WIDTH) * size;

export const verticalScale = (size) => (SCREEN_HEIGHT / BASE_HEIGHT) * size;

export const moderateScale = (size, factor = 0.5) =>
  size + (scale(size) - size) * factor;

// ----------------------------------------------------------------
// API dinámica (hook, se recalcula automáticamente)
// ----------------------------------------------------------------

export function useAppScale() {
  const { width, height } = useWindowDimensions();

  const s = (size) => (width / BASE_WIDTH) * size;
  const vs = (size) => (height / BASE_HEIGHT) * size;
  const fs = (size, factor = 0.5) => size + (s(size) - size) * factor;

  return {
    scale: s,
    verticalScale: vs,
    fontScale: fs,
    width,
    height,
  };
}
