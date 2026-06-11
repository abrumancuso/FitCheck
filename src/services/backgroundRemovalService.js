/**
 * backgroundRemovalService.js — Remover fondo con remove.bg
 * ==========================================================
 *
 * Toma una imagen local, la envía a remove.bg, y devuelve
 * la URI de la imagen procesada (PNG con fondo transparente).
 *
 * Si no hay API key configurada, devuelve la imagen original.
 */

import { File, Paths } from 'expo-file-system';

// Lee la API key desde la variable de entorno.
// Configurarla en el archivo .env:
//   EXPO_PUBLIC_REMOVE_BG_API_KEY=tu-key
// Las variables EXPO_PUBLIC_* se exponen al cliente automáticamente.
const REMOVE_BG_API_KEY = process.env.EXPO_PUBLIC_REMOVE_BG_API_KEY || '';

/**
 * Remueve el fondo de una imagen usando remove.bg.
 *
 * @param {string} imageUri — URI local de la imagen (file://)
 * @returns {Promise<string>} URI de la imagen procesada
 */
export async function removeBackground(imageUri) {
  if (!REMOVE_BG_API_KEY) {
    console.log('[remove-bg] ⚠️  No hay API key — se usa la imagen original');
    return imageUri;
  }

  console.log('[remove-bg] Leyendo imagen...');
  const imageFile = new File(imageUri);

  // 1. Leer la imagen como base64
  const base64 = await imageFile.base64();

  console.log('[remove-bg] Enviando a remove.bg... key?', REMOVE_BG_API_KEY ? 'sí' : 'no');
  const response = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': REMOVE_BG_API_KEY,
    },
    body: JSON.stringify({
      image_file_b64: base64,
      size: 'preview',
      response_type: 'json',
    }),
  });

  console.log('[remove-bg] status:', response.status, 'content-type:', response.headers.get('content-type'));

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`remove.bg ${response.status}: ${text.substring(0, 300)}`);
  }

  // 2. Obtener el resultado — puede ser JSON o imagen binaria
  const contentType = response.headers.get('content-type') || '';
  let resultB64;

  if (contentType.includes('json')) {
    const json = await response.json();
    resultB64 = json.data?.result_b64;
    if (!resultB64) throw new Error('remove.bg no incluyó result_b64');
  } else {
    // Respuesta binaria → convertir a base64
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    resultB64 = btoa(binary);
  }

  console.log('[remove-bg] Imagen procesada, guardando...');

  // 3. Convertir base64 → bytes y guardar en caché
  const binaryStr = atob(resultB64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  const outputFile = new File(Paths.cache, `bg-removed-${Date.now()}.png`);
  outputFile.write(bytes);

  console.log('[remove-bg] Listo:', outputFile.uri.substring(0, 80));
  return outputFile.uri;
}
