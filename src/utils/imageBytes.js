/**
 * imageBytes — lectura de imágenes compatible con nativo y web
 * =============================================================
 *
 * expo-file-system NO está soportado en web (su implementación web solo
 * hace console.warn). En el celular usamos la clase File como siempre;
 * en web el image picker devuelve un URI blob:/data: que se lee con fetch.
 */

import { Platform } from 'react-native';
import { File } from 'expo-file-system';

export async function readImageBytes(uri) {
  if (!uri) throw new Error('No hay imagen para leer');

  const isWebFriendly = /^(blob:|data:|https?:)/i.test(uri);
  if (Platform.OS === 'web' || isWebFriendly) {
    const response = await fetch(uri);
    if (!response.ok) throw new Error('No se pudo leer la imagen');
    return await response.arrayBuffer();
  }

  const imageFile = new File(uri);
  return await imageFile.arrayBuffer();
}
