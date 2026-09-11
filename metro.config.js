/**
 * metro.config.js — Configuración de Metro Bundler
 * ==================================================
 *
 * En web, redirigimos expo-media-library a un shim seguro (no-op)
 * para evitar errores "Cannot find native module" en el bundle web.
 * En iOS/Android, se resuelve el módulo real normalmente.
 */

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const originalResolve = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Solo en web: redirigir expo-media-library al shim local
  if (platform === 'web' && moduleName === 'expo-media-library') {
    return {
      filePath: path.resolve(__dirname, 'src/utils/mediaLibraryShim.js'),
      type: 'sourceFile',
    };
  }

  // Para todo lo demás: resolución estándar de Metro
  if (originalResolve) {
    return originalResolve(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
