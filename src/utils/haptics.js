/**
 * haptics.js — Feedback háptico sutil
 * =====================================
 * Envoltorio sobre expo-haptics para mantener consistencia.
 */

import * as Haptics from 'expo-haptics';

export const impact = {
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
};

export const notification = {
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
};

export const selection = () => Haptics.selectionAsync();
