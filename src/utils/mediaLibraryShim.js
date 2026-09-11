/**
 * mediaLibraryShim.js — Mock web-safe para expo-media-library
 * =============================================================
 *
 * Este archivo SOLO se usa en web (resuelto por metro.config.js).
 * Exporta funciones no-op que coinciden con la API de expo-media-library.
 * En iOS/Android se usa el módulo real (expo-media-library).
 */

export async function requestPermissionsAsync() {
  return { status: 'undetermined' };
}

export async function saveToLibraryAsync(_uri) {
  // No-op: la galería nativa no existe en web
  return true;
}
