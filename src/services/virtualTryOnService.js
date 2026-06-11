/**
 * virtualTryOnService.js — Try-on virtual vía Cloudflare Worker
 * ==============================================================
 * Ya no habla directo a Hugging Face. Todo pasa por el Worker,
 * que maneja la subida de archivos y el streaming SSE.
 *
 * La app manda las imágenes y recibe una URL con el resultado.
 *
 * Configuración:
 *   EXPO_PUBLIC_VTON_WORKER_URL=https://fitcheck-tryon.xxxx.workers.dev
 */

import * as FileSystem from 'expo-file-system';

const WORKER_URL = process.env.EXPO_PUBLIC_VTON_WORKER_URL;

/**
 * Aplica una prenda virtualmente sobre una foto de persona.
 *
 * @param {string}   garmentUri — URI de la prenda (local file:// o URL)
 * @param {string}   modelUri   — URI de la persona (local file:// o URL)
 * @param {function} [onStatus] — callback con mensajes de estado
 * @returns {Promise<string>} URL de la imagen generada
 */
export async function tryOnGarment(garmentUri, modelUri, onStatus) {
  if (!WORKER_URL) {
    throw new Error(
      'EXPO_PUBLIC_VTON_WORKER_URL no está configurada. ' +
      'Creá un archivo .env en la raíz con: EXPO_PUBLIC_VTON_WORKER_URL=tu-url-de-worker'
    );
  }

  const isUrl = (u) => u?.startsWith('http://') || u?.startsWith('https://');

  // Si AMBAS son URLs remotas → modo JSON (más rápido)
  if (isUrl(garmentUri) && isUrl(modelUri)) {
    return callWorkerJSON(garmentUri, modelUri, onStatus);
  }

  // Si alguna es local → modo FormData
  return callWorkerFormData(garmentUri, modelUri, onStatus);
}

// ── Modo JSON (ambas URLs remotas) ───────────────────────────

async function callWorkerJSON(garmentUrl, humanUrl, onStatus) {
  onStatus?.('Enviando a la IA...');

  const resp = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      humanUrl,
      garmentUrl,
      description: '',
      steps: 30,
      seed: 42,
    }),
  });

  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || `Error HTTP ${resp.status}`);

  return data.imageUrl;
}

// ── Modo FormData (archivos locales) ─────────────────────────

async function callWorkerFormData(garmentUri, modelUri, onStatus) {
  onStatus?.('Preparando imágenes...');

  const isUrl = (u) => u?.startsWith('http://') || u?.startsWith('https://');

  // Descargar URLs remotas a la caché
  const tempDir = FileSystem.cacheDirectory + 'vton/';
  await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });

  const [gLocal, hLocal] = await Promise.all([
    isUrl(garmentUri)
      ? FileSystem.downloadAsync(garmentUri, tempDir + 'garment.png').then((r) => r.uri)
      : garmentUri,
    isUrl(modelUri)
      ? FileSystem.downloadAsync(modelUri, tempDir + 'human.png').then((r) => r.uri)
      : modelUri,
  ]);

  onStatus?.('Enviando a la IA...');

  const form = new FormData();
  form.append('garment_image', {
    uri: gLocal,
    type: 'image/png',
    name: 'garment.png',
  });
  form.append('human_image', {
    uri: hLocal,
    type: 'image/png',
    name: 'human.png',
  });
  form.append('description', '');
  form.append('steps', '30');
  form.append('seed', '42');

  const resp = await fetch(WORKER_URL, {
    method: 'POST',
    body: form,
  });

  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || `Error HTTP ${resp.status}`);

  return data.imageUrl;
}

// ── Utilidades ───────────────────────────────────────────────

/**
 * Verifica si el worker está accesible.
 */
export async function checkServiceHealth() {
  try {
    const resp = await fetch(WORKER_URL, { method: 'OPTIONS' });
    return { available: resp.ok, workerUrl: WORKER_URL };
  } catch (e) {
    return { available: false, error: e.message, workerUrl: WORKER_URL };
  }
}

/**
 * URL del modelo por defecto (imagen de ejemplo de HF).
 */
export const DEFAULT_MODEL_URL =
  'https://huggingface.co/spaces/yisol/IDM-VTON/resolve/main/examples/person_1.png';
