/**
 * aiFittingService.js — Probador Virtual vía API cloud (Replicate / fal.ai)
 * ==========================================================================
 * Cliente REST para generación de try-on con IDM-VTON (o similar).
 * NO corre en el dispositivo: manda las imágenes a la nube, hace polling
 * hasta que el modelo termina, y devuelve la URL de la imagen generada.
 *
 * ── CONFIGURACIÓN (.env) ───────────────────────────────────────
 *   EXPO_PUBLIC_AIFIT_PROVIDER        replicate | fal | proxy   (default: replicate)
 *   EXPO_PUBLIC_REPLICATE_API_TOKEN   token de replicate.com
 *   EXPO_PUBLIC_FAL_KEY               key de fal.ai
 *   EXPO_PUBLIC_AIFIT_API_BASE        URL de tu Cloudflare Worker (solo provider "proxy")
 *   EXPO_PUBLIC_REPLICATE_MODEL       default: cuuupid/idm-vton
 *   EXPO_PUBLIC_FAL_MODEL             default: fal-ai/idm-vton
 *
 * ── CONTRATO PÚBLICO ───────────────────────────────────────────
 *   generateTryOn({ humanUri, garmentUri, category, description, onStatus })
 *     → Promise<string> URL de la imagen generada
 *   cancelTryOn()          → aborta el polling en curso
 *   isFittingConfigured()  → true si el provider elegido tiene credenciales
 *   mapGarmentCategory()   → 'upper_body' | 'lower_body' | 'dresses'
 *   isTryOnSupported()     → false para calzado/accesorios (el modelo no los soporta)
 *
 * ── ⚠️ SEGURIDAD ───────────────────────────────────────────────
 *   Todo lo que empiece con EXPO_PUBLIC_ queda embebido en el bundle:
 *   CUALQUIER usuario puede leerlo con el dev tools del navegador.
 *   Para producción: provider = "proxy" y la API key vive EN EL WORKER
 *   (tenés worker.js listo en la raíz del repo). Nunca en el cliente.
 */

import { Image, Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

// ── Configuración ─────────────────────────────────────────────

const PROVIDER = (process.env.EXPO_PUBLIC_AIFIT_PROVIDER || 'replicate').toLowerCase();
const REPLICATE_TOKEN = process.env.EXPO_PUBLIC_REPLICATE_API_TOKEN || '';
const FAL_KEY = process.env.EXPO_PUBLIC_FAL_KEY || '';
const PROXY_URL = process.env.EXPO_PUBLIC_AIFIT_API_BASE || '';
/**
 * Publishable key de Supabase (clave PÚBLICA, va en el bundle sin problema).
 * Supabase rechaza con 401 todo request sin Authorization (verify_jwt);
 * Cloudflare la ignora, así que sirve para ambos proveedores.
 */
const PROXY_KEY = process.env.EXPO_PUBLIC_AIFIT_PROXY_KEY || '';

const REPLICATE_MODEL = process.env.EXPO_PUBLIC_REPLICATE_MODEL || 'cuuupid/idm-vton';
const FAL_MODEL = process.env.EXPO_PUBLIC_FAL_MODEL || 'fal-ai/idm-vton';

/** Ancho máximo antes de mandar a la nube (evita payloads de 8 MB). */
const MAX_WIDTH = 1024;
/** Frecuencia del polling. */
const POLL_MS = 2500;
/** Tope total de espera antes de rendirse. */
const TIMEOUT_MS = 120000;
/** Tope para el modo proxy (una sola petición larga, sin polling). */
const PROXY_TIMEOUT_MS = 180000;
/** Máximo de prendas por generación (encadenado: cada una suma ~1 min). */
export const MAX_TRY_ON_GARMENTS = 3;

// ── Errores tipados (la UI decide qué mostrar) ────────────────

export class FittingError extends Error {
  constructor(message, code = 'UNKNOWN') {
    super(message);
    this.name = 'FittingError';
    this.code = code;
  }
}

// ── Cancelación ───────────────────────────────────────────────

let activeJob = null;

/** Cancela el try-on en curso (aborta fetch + polling + sleeps). */
export function cancelTryOn() {
  activeJob?.abort();
}

const sleep = (ms, job) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    // Si cancelan mientras dormimos, despertamos con error.
    job.onCancel(() => {
      clearTimeout(t);
      reject(new FittingError('Operación cancelada', 'CANCELLED'));
    });
  });

// ── Helpers de imagen ─────────────────────────────────────────

const isRemote = (uri) => typeof uri === 'string' && /^https?:\/\//.test(uri);

/** Tamaño en píxeles. Devuelve null si no se puede medir (nunca tira). */
function getImageSize(uri) {
  return new Promise((resolve) => {
    try {
      Image.getSize(
        uri,
        (width, height) => resolve({ width, height }),
        () => resolve(null)
      );
    } catch (_) {
      resolve(null);
    }
  });
}

/**
 * Convierte una imagen local en data URI base64 (aceptado por Replicate y fal).
 * Las URLs remotas se pasan tal cual: la API las baja sola.
 * Resize SOLO si la imagen es más ancha que MAX_WIDTH (nunca upscale).
 */
async function toDataUri(uri, onStatus) {
  if (!uri) throw new FittingError('Falta una imagen', 'BAD_INPUT');
  if (isRemote(uri)) return uri;

  onStatus?.('Optimizando imagen…');

  const size = await getImageSize(uri);
  const needsResize = size && size.width > MAX_WIDTH;

  const out = await manipulateAsync(
    uri,
    needsResize ? [{ resize: { width: MAX_WIDTH } }] : [],
    { compress: 0.85, format: SaveFormat.JPEG }
  );

  const base64 = await new File(out.uri).base64();
  return `data:image/jpeg;base64,${base64}`;
}

/**
 * Normaliza una imagen a un archivo local para el proxy.
 * Resize SOLO si es más ancha que MAX_WIDTH (nunca upscale): fotos de
 * celular de 12MP llegaban al backend como payloads de ~10 MB y lo
 * hacían reventar (timeout / crash oculto).
 * keepPng conserva el PNG (transparencia de remove.bg); si no, JPEG q0.85.
 */
async function normalizeForProxy(uri, keepPng) {
  const size = await getImageSize(uri).catch(() => null);
  const needsResize = size && size.width > MAX_WIDTH;
  const out = await manipulateAsync(
    uri,
    needsResize ? [{ resize: { width: MAX_WIDTH } }] : [],
    keepPng ? { format: SaveFormat.PNG } : { compress: 0.85, format: SaveFormat.JPEG }
  );
  const type = keepPng ? 'image/png' : 'image/jpeg';
  return { uri: out.uri, type, name: `norm-${Date.now()}.${keepPng ? 'png' : 'jpg'}` };
}

/**
 * En web el FormData del navegador solo serializa Blob/File/string: un part
 * {uri} termina como "[object Object]" y el worker recibe basura. Bajamos
 * el archivo a Blob (acepta blob:, data: y http(s)://) con el tipo correcto.
 */
async function toBlobPart(uri, png) {
  const resp = await fetch(uri);
  if (!resp.ok) throw new Error(`fetch ${resp.status}`);
  return new Blob([await resp.blob()], { type: png ? 'image/png' : 'image/jpeg' });
}

/**
 * Escribe una data URI base64 a un archivo en caché (solo nativo).
 * Se usa en el ENCADENADO: el resultado de cada paso vuelve como data URI
 * y el paso siguiente lo necesita como archivo local para el FormData.
 */
async function dataUriToFile(dataUri, name) {
  const m = /^data:([^;,]+);base64,(.+)$/s.exec(dataUri);
  if (!m) throw new Error('data URI inválida');
  const mime = m[1];
  const ext =
    mime === 'image/png' ? 'png' : mime === 'image/jpeg' || mime === 'image/jpg' ? 'jpg' : 'webp';
  const file = new File(Paths.cache, `${name}-${Date.now()}.${ext}`);
  file.write(m[2], { encoding: 'base64' });
  return file;
}

/**
 * Compone una imagen (posiblemente CON transparencia) sobre fondo BLANCO y
 * la devuelve como Blob JPEG. Solo web: usa canvas del navegador.
 * Motivo: el space de HF convierte todo a JPEG y un PNG con alpha pierde la
 * transparencia quedando fondo OSCURO → el servicio de IA no segmenta la
 * prenda y no la coloca sobre el cuerpo (resultado: persona deformada sin
 * prenda). El formato que espera es prenda sobre fondo blanco (sus propios
 * ejemplos van así). Además aplica resize ≤ MAX_WIDTH como el manipulador.
 */
async function compositeWhite(uri, outPng = false) {
  const img = new window.Image();
  if (isRemote(uri)) img.crossOrigin = 'anonymous';
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = () => rej(new Error('no se pudo cargar para composición'));
    img.src = uri;
  });
  const scale = img.naturalWidth > MAX_WIDTH ? MAX_WIDTH / img.naturalWidth : 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((res, rej) => {
    canvas.toBlob(
      (b) => (b ? res(b) : rej(new Error('toBlob falló'))),
      outPng ? 'image/png' : 'image/jpeg',
      0.85
    );
  });
}

/** Normaliza cualquier forma de output a una sola URL. */
function normalizeOutput(output) {
  if (!output) return null;
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) return normalizeOutput(output[0]);
  if (typeof output.url === 'string') return output.url;
  if (typeof output.image === 'string') return output.image;
  if (output.images) return normalizeOutput(output.images);
  if (typeof output.output === 'string') return normalizeOutput(output.output);
  return null;
}

// ── Mapeo de categorías (clóset FitCheck → IDM-VTON) ──────────

const LOWER_BODY = ['Pantalón', 'Short', 'Falda', 'Pollera', 'Jean'];
const DRESSES = ['Vestido'];
const UNSUPPORTED = ['Zapatos', 'Zapatillas', 'Cartera', 'Accesorio'];

/** Traduce una categoría del clóset al `category` que espera IDM-VTON. */
export function mapGarmentCategory(category = '') {
  if (DRESSES.includes(category)) return 'dresses';
  if (LOWER_BODY.includes(category)) return 'lower_body';
  return 'upper_body';
}

/** El modelo solo sabe ponerse arriba, abajo o vestidos. */
export function isTryOnSupported(category = '') {
  return !UNSUPPORTED.includes(category);
}

/**
 * Orden de aplicación en el encadenado multi-prenda.
 * Primero lo que cubre poco (arriba), después lo que cubre más
 * (abajo, vestido) y al final lo experimental (zapatos/accesorios).
 */
const garmentRank = (category = '') => {
  if (DRESSES.includes(category)) return 3;
  if (LOWER_BODY.includes(category)) return 2;
  if (UNSUPPORTED.includes(category)) return 4;
  return 1;
};

// ── API pública ───────────────────────────────────────────────

export function isFittingConfigured() {
  if (PROVIDER === 'proxy') return Boolean(PROXY_URL);
  if (PROVIDER === 'fal') return Boolean(FAL_KEY);
  return Boolean(REPLICATE_TOKEN);
}

export function getProviderInfo() {
  return { provider: PROVIDER, configured: isFittingConfigured() };
}

/**
 * Genera el try-on. En provider "proxy" soporta VARIAS prendas: se encadena
 * una generación por prenda (el modelo recibe UNA por request), usando el
 * resultado de cada paso como la "persona" del siguiente.
 *
 * @param {Object}   params
 * @param {string}   params.humanUri      — foto del cuerpo (file:// o https://)
 * @param {string}   [params.garmentUri]  — prenda única (compatibilidad)
 * @param {Array}    [params.garments]    — [{ uri, category, description }]
 * @param {string}   [params.category]    — upper_body | lower_body | dresses
 * @param {string}   [params.description] — texto corto de la prenda
 * @param {function} [params.onStatus]    — callback con mensajes para la UI
 * @returns {Promise<string>} URL de la imagen generada
 */
export async function generateTryOn({
  humanUri,
  garments,
  garmentUri,
  category,
  description,
  onStatus,
}) {
  if (activeJob) {
    throw new FittingError('Ya hay un proceso en curso', 'BUSY');
  }

  const job = {
    cancelled: false,
    controller: new AbortController(),
    cancelListeners: [],
    onCancel(fn) {
      if (this.cancelled) fn();
      else this.cancelListeners.push(fn);
    },
    abort() {
      this.cancelled = true;
      this.cancelListeners.forEach((fn) => fn());
      try {
        this.controller.abort();
      } catch (_) {}
    },
  };
  activeJob = job;

  try {
    // Normalizamos a lista y ordenamos: arriba → abajo → vestido → resto.
    const list = (garments && garments.length ? garments : [{ uri: garmentUri, category, description }])
      .filter((g) => g && g.uri)
      .sort((a, b) => garmentRank(a.category) - garmentRank(b.category));

    if (list.length === 0) {
      throw new FittingError('Elegí al menos una prenda', 'BAD_INPUT');
    }
    if (list.length > MAX_TRY_ON_GARMENTS) {
      throw new FittingError(`Máximo ${MAX_TRY_ON_GARMENTS} prendas por generación`, 'BAD_INPUT');
    }

    if (PROVIDER === 'proxy') {
      // ── Encadenado: cada paso es un POST completo al worker ────
      let human = humanUri;
      for (let i = 0; i < list.length; i++) {
        if (job.cancelled) throw new FittingError('Operación cancelada', 'CANCELLED');
        const g = list[i];
        const stepStatus = (msg) => onStatus?.(`Prenda ${i + 1} de ${list.length} · ${msg}`);
        const out = await runProxy({
          humanUri: human,
          garmentUri: g.uri,
          category: g.category,
          description: g.description || description || '',
          onStatus: stepStatus,
          job,
          // Paso 2+: el "humano" es un resultado previo → PNG sin pérdida
          // para no degradar la cara en cada re-encaje (JPEG acumula).
          keepHumanPng: i > 0,
        });
        human = out; // data URI → la "persona" del siguiente paso
      }
      return human;
    }

    // Providers de una sola prenda (replicate/fal): usan la primera.
    const single = list[0];
    const payload = {
      humanUri,
      garmentUri: single.uri,
      category: single.category || category || 'upper_body',
      description: single.description || description || '',
      onStatus,
      job,
    };
    if (PROVIDER === 'fal') return await runFal(payload);
    return await runReplicate(payload);
  } catch (e) {
    // Nuestros errores ya traen el código correcto (TIMEOUT, CANCELLED…)
    if (e instanceof FittingError) throw e;
    // AbortController explota como AbortError: lo traducimos a CANCELLED
    if (e?.name === 'AbortError' || e?.code === 'ABORT_ERR' || job.cancelled) {
      throw new FittingError('Operación cancelada', 'CANCELLED');
    }
    throw e;
  } finally {
    if (activeJob === job) activeJob = null;
  }
}

// ── Provider: Replicate ───────────────────────────────────────

async function runReplicate({ humanUri, garmentUri, category, description, onStatus, job }) {
  if (!REPLICATE_TOKEN) {
    throw new FittingError(
      'Falta EXPO_PUBLIC_REPLICATE_API_TOKEN en el archivo .env',
      'NO_CONFIG'
    );
  }

  const [humanImg, garmImg] = await Promise.all([
    toDataUri(humanUri, onStatus),
    toDataUri(garmentUri, onStatus),
  ]);

  onStatus?.('Enviando a Replicate…');

  const resp = await fetch(`https://api.replicate.com/v1/models/${REPLICATE_MODEL}/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REPLICATE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: {
        human_img: humanImg,
        garm_img: garmImg,
        garment_des: description || 'Garment',
        category,
        crop: true, // recorta el cuerpo a 3:4 — las fotos de celular casi nunca lo son
        steps: 30,
        seed: 42,
      },
    }),
    signal: job.controller.signal,
  });

  let prediction = await readJson(resp);
  if (!resp.ok) throw httpError(resp.status, prediction);

  // ── Polling hasta estado terminal ──────────────────────────
  const started = Date.now();

  while (!['succeeded', 'failed', 'canceled'].includes(prediction.status)) {
    if (job.cancelled) throw new FittingError('Operación cancelada', 'CANCELLED');

    const elapsed = Math.round((Date.now() - started) / 1000);
    if (elapsed * 1000 > TIMEOUT_MS) {
      throw new FittingError('La IA tardó demasiado. Probá de nuevo.', 'TIMEOUT');
    }

    onStatus?.(
      prediction.status === 'starting'
        ? 'Encolando generación…'
        : `Generando tu probador… ${elapsed}s`
    );

    await sleep(POLL_MS, job);

    const pollUrl =
      prediction.urls?.get || `https://api.replicate.com/v1/predictions/${prediction.id}`;
    const poll = await fetch(pollUrl, {
      headers: { Authorization: `Bearer ${REPLICATE_TOKEN}` },
      signal: job.controller.signal,
    });

    prediction = await readJson(poll);
    if (!poll.ok) throw httpError(poll.status, prediction);
  }

  if (prediction.status === 'failed') {
    throw new FittingError(prediction.error || 'El modelo falló al generar la imagen', 'MODEL');
  }
  if (prediction.status === 'canceled') {
    throw new FittingError('Operación cancelada', 'CANCELLED');
  }

  const imageUrl = normalizeOutput(prediction.output);
  if (!imageUrl) throw new FittingError('La IA no devolvió ninguna imagen', 'MODEL');
  return imageUrl;
}

// ── Provider: fal.ai (Queue API) ──────────────────────────────

async function runFal({ humanUri, garmentUri, description, onStatus, job }) {
  if (!FAL_KEY) {
    throw new FittingError('Falta EXPO_PUBLIC_FAL_KEY en el archivo .env', 'NO_CONFIG');
  }

  const [human_image_url, garment_image_url] = await Promise.all([
    toDataUri(humanUri, onStatus),
    toDataUri(garmentUri, onStatus),
  ]);

  onStatus?.('Enviando a fal.ai…');

  const submit = await fetch(`https://queue.fal.run/${FAL_MODEL}`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      human_image_url,
      garment_image_url,
      description: description || 'Garment',
      num_inference_steps: 30,
      seed: 42,
    }),
    signal: job.controller.signal,
  });

  const ticket = await readJson(submit);
  if (!submit.ok) throw httpError(submit.status, ticket);

  const statusUrl =
    ticket.status_url || `https://queue.fal.run/${FAL_MODEL}/requests/${ticket.request_id}/status`;
  const resultUrl =
    ticket.response_url || `https://queue.fal.run/${FAL_MODEL}/requests/${ticket.request_id}`;

  // ── Polling: IN_QUEUE → IN_PROGRESS → COMPLETED ────────────
  const started = Date.now();

  while (true) {
    if (job.cancelled) throw new FittingError('Operación cancelada', 'CANCELLED');

    const elapsed = Math.round((Date.now() - started) / 1000);
    if (elapsed * 1000 > TIMEOUT_MS) {
      throw new FittingError('La IA tardó demasiado. Probá de nuevo.', 'TIMEOUT');
    }

    await sleep(POLL_MS, job);

    const status = await fetch(statusUrl, {
      headers: { Authorization: `Key ${FAL_KEY}` },
      signal: job.controller.signal,
    });
    const statusData = await readJson(status);
    if (!status.ok) throw httpError(status.status, statusData);

    if (statusData.status === 'COMPLETED') break;
    if (statusData.status === 'FAILED' || statusData.status === 'ERROR') {
      throw new FittingError('El modelo falló al generar la imagen', 'MODEL');
    }

    onStatus?.(
      statusData.status === 'IN_QUEUE'
        ? 'Esperando turno en la cola…'
        : `Generando tu probador… ${elapsed}s`
    );
  }

  onStatus?.('Descargando resultado…');

  const result = await fetch(resultUrl, {
    headers: { Authorization: `Key ${FAL_KEY}` },
    signal: job.controller.signal,
  });
  const data = await readJson(result);
  if (!result.ok) throw httpError(result.status, data);

  const imageUrl = normalizeOutput(data);
  if (!imageUrl) throw new FittingError('La IA no devolvió ninguna imagen', 'MODEL');
  return imageUrl;
}

// ── Provider: Proxy (tu Cloudflare Worker) ────────────────────
// Contrato igual a worker.js: multipart con human_image/garment_image,
// responde { imageUrl }. La API key queda DENTRO del worker.

async function runProxy({
  humanUri,
  garmentUri,
  category,
  description,
  onStatus,
  job,
  keepHumanPng = false,
}) {
  if (!PROXY_URL) {
    throw new FittingError('Falta EXPO_PUBLIC_AIFIT_API_BASE en el archivo .env', 'NO_CONFIG');
  }

  onStatus?.('Preparando imágenes…');

  const mimeOf = (uri) => {
    // El output del encadenado llega como data URI: el mime va en el prefijo.
    if (/^data:/.test(uri)) {
      const m = /^data:([^;,]+)/.exec(uri);
      if (m && m[1].startsWith('image/')) return m[1];
    }
    return /\.png(\?|#|$)/i.test(uri) ? 'image/png' : 'image/jpeg';
  };

  // FormData en RN no acepta URLs remotas, y el File nativo de
  // expo-file-system revienta con "this.validatePath is not a function"
  // en este runtime. No usamos File para nada: manipulateAsync baja él
  // solo las URLs remotas (iOS/Android/web) y deja el archivo en caché.
  // Después normalizamos: la FOTO va a JPEG con resize ≤ MAX_WIDTH;
  // la PRENDA conserva PNG cuando era PNG (remove.bg tiene fondo
  // transparente y JPEG la arruina), también con resize máximo.
  const toPart = async (uri, name, keepPng) => {
  const png = keepPng ?? mimeOf(uri) === 'image/png';
  try {
    // Paso siguiente del ENCADENADO: el humano viene como data URI base64.
    // En web alcanza con bajar el Blob (fetch acepta data:); en nativo
    // escribimos a caché y lo normalizamos a JPEG como cualquier local.
    if (/^data:/.test(uri)) {
      if (Platform.OS === 'web') {
        // Humano del paso 2+ (transparente no, pero opaque igual): si pidió
        // PNG lo entregamos PNG — el flatten sobre blanco no lo degrada.
        return png ? await compositeWhite(uri, true) : await toBlobPart(uri, false);
      }
      const tmp = await dataUriToFile(uri, name);
      const part = await normalizeForProxy(tmp.uri, false);
      if (!isRemote(part.uri)) return part;
    } else {
      const part = await normalizeForProxy(uri, png);
      if (Platform.OS === 'web') {
        // La prenda transparente va COMPUESTA sobre blanco: el space
        // convierte todo a JPEG y la transparencia quedaría oscura.
        return png ? await compositeWhite(part.uri) : await toBlobPart(part.uri, false);
      }
      if (!isRemote(part.uri)) return part;
    }
  } catch (_) {
    // Seguimos al fallback: sin manipulador resolvemos otro camino.
  }
    if (isRemote(uri)) {
      // Fallback remoto: fetch → Blob (aceptado por FormData de RN y web).
      try {
        const resp = await fetch(uri);
        if (resp.ok) return await resp.blob();
      } catch (_) {}
      throw new FittingError(`No se pudo descargar la imagen de ${name}`, 'NETWORK');
    }
    // Fallback local: mandamos el original en vez de romper todo.
    // Un data URI NO es un archivo: si llegamos hasta acá es que el
    // paso anterior del encadenado no se pudo materializar.
    if (/^data:/.test(uri) && Platform.OS !== 'web') {
      throw new FittingError('No se pudo preparar la imagen del paso anterior', 'MODEL');
    }
    const type = mimeOf(uri);
    if (Platform.OS === 'web') {
      try {
        return type === 'image/png' ? await compositeWhite(uri) : await toBlobPart(uri, false);
      } catch (_) {
        return toBlobPart(uri, false);
      }
    }
    return { uri, type, name: `${name}.${type === 'image/png' ? 'png' : 'jpg'}` };
  };

  const form = new FormData();
  const humanPart = await toPart(humanUri, 'human', keepHumanPng);
  const garmentPart = await toPart(garmentUri, 'garment');
  // Diagnóstico: si el celu se cuelga, el último [aifit] de Metro dice DÓNDE.
  const desc = (p) =>
    p?.uri ? `{uri ${p.name || ''} ${p.type || ''}}`
      : p instanceof Blob ? `Blob(${p.type}, ${p.size}B)`
      : typeof p === 'object' ? JSON.stringify(p).slice(0, 80)
      : String(p).slice(0, 40);
  console.log('[aifit] parts listos:', { human: desc(humanPart), garment: desc(garmentPart) });
  form.append('human_image', humanPart);
  form.append('garment_image', garmentPart);
  form.append('description', description || '');
  // OOTDiffusion necesita saber qué zona vestir (torso / piernas / vestido).
  form.append('category', mapGarmentCategory(category));

  onStatus?.('Enviando a la nube…');

  // El proxy es UNA sola petición larga (sin polling), así que el estado
  // lo actualiza este ticker: si no, la pantalla parece congelada.
  const started = Date.now();
  const ticker = setInterval(() => {
    if (!job.cancelled) {
      onStatus?.(`Esperando al modelo… ${Math.round((Date.now() - started) / 1000)}s`);
    }
  }, 1000);

  let resp;
  try {
    console.log('[aifit] POST', PROXY_URL);
    resp = await fetchWithTimeout(
      PROXY_URL,
      {
        method: 'POST',
        body: form,
        signal: job.controller.signal,
        // Supabase exige Authorization antes de ejecutar la función.
        ...(PROXY_KEY ? { headers: { Authorization: `Bearer ${PROXY_KEY}`, apikey: PROXY_KEY } } : {}),
      },
      PROXY_TIMEOUT_MS,
      job
    );
  } finally {
    clearInterval(ticker);
  }

  console.log('[aifit] respuesta HTTP', resp.status);
  const data = await readJson(resp);
  if (!resp.ok) throw httpError(resp.status, data);

  const imageUrl = data.imageUrl || normalizeOutput(data);
  if (!imageUrl) throw new FittingError('El servidor no devolvió ninguna imagen', 'MODEL');
  // Con PROXY el worker entrega la imagen como data URI (el cache del
  // space de HF muere en segundos; una URL muerta = blanco eterno).
  // Logueamos el inicio nomás: un base64 completo spamea la consola.
  console.log('[aifit] resultado:', imageUrl.slice(0, 64), `…(${imageUrl.length} chars)`);
  return imageUrl;
}

// ── Utilidades internas ───────────────────────────────────────

/**
 * fetch con tope de tiempo. Al expirar aborta el job (para no dejar
 * conexiones colgadas) y tira un FittingError TIMEOUT.
 */
function fetchWithTimeout(url, options, ms, job) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      job.abort();
      reject(
        new FittingError('El modelo tardó demasiado (3 minutos). Probá de nuevo.', 'TIMEOUT')
      );
    }, ms);
  });
  return Promise.race([fetch(url, options), timeout]).finally(() => clearTimeout(timer));
}

async function readJson(resp) {
  try {
    return await resp.json();
  } catch (_) {
    return {};
  }
}

function httpError(status, data) {
  const detail =
    (typeof data?.detail === 'string' && data.detail) ||
    data?.detail?.[0]?.msg ||
    data?.error ||
    data?.title ||
    '';
  // El 502 sale del worker cuando la IA está saturada o sin cuota (los
  // reintentos automáticos ya se hicieron): que el usuario entienda que
  // es un tema del servicio ajeno, no de la app.
  const quota = /quota/i.test(String(detail));
  const hint = quota
    ? ' Se agotó la cuota diaria de GPU. Configurá un token de Hugging Face en el worker o esperá 24 h.'
    : status === 502 && detail
      ? ' El servicio de IA está saturado: esperá unos segundos y probá de nuevo.'
      : '';
  return new FittingError(
    detail
      ? `Error ${status}: ${String(detail).slice(0, 200)}${hint}`
      : `Error HTTP ${status}`,
    status === 401 || status === 403 ? 'UNAUTHORIZED' : 'HTTP'
  );
}
