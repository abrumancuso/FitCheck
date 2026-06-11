/**
 * theme.js — Sistema de diseño FitCheck
 * ======================================
 * Estilo minimalista, editorial, responsive.
 * No uses emojis ni decoraciones recargadas.
 */

import { scale, moderateScale } from '../utils/responsive';

export const COLORS = {
  primary: '#6B1D2B',
  secondary: '#4A5D23',
  background: '#FDF8F0',
  gold: '#C9A84C',
  white: '#FFFFFF',
  text: '#1A1A1A',
  textLight: '#8A8A8A',
  border: '#E8E0D6',
  error: '#C0392B',
  success: '#27AE60',
  overlay: 'rgba(0,0,0,0.3)',
  cardShadow: 'rgba(0,0,0,0.06)',
};

export const FONTS = {
  regular: { fontSize: moderateScale(15), color: COLORS.text },
  title: { fontSize: moderateScale(28), fontWeight: '700', color: COLORS.text },
  subtitle: { fontSize: moderateScale(17), fontWeight: '600', color: COLORS.text },
  caption: { fontSize: moderateScale(12), color: COLORS.textLight },
};

export const SPACING = {
  xs: scale(4),
  sm: scale(8),
  md: scale(16),
  lg: scale(24),
  xl: scale(32),
  xxl: scale(48),
};

export const RADIUS = {
  sm: scale(6),
  md: scale(12),
  lg: scale(16),
  full: 999,
};

export const ICON_SIZE = {
  sm: scale(18),
  md: scale(22),
  lg: scale(28),
};
