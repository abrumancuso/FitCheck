/**
 * worker.js — Proxy de IA para FitCheck
 * =======================================
 * Toma las fotos desde la app, las manda a un espacio de Hugging Face,
 * espera el resultado, y devuelve la URL de la imagen generada.
 *
 * Backend: franciszzj/Leffa
 *   ZeroGPU (GPU real). ~15s y mejor calidad: `resize_and_center` respeta el
 *   aspecto de la foto (no estira) y `repaint=True` pega la foto original
 *   fuera de la máscara de la prenda, así la CARA no se regenera. Antes usábamos
 *   OOTDiffusion (estiraba todo a 768x1024 y deformaba) y Kwai-Kolors (CPU,
 *   85-135s). Leffa usa VITON-HD para torso y DressCode para abajo/vestidos.
 *
 * Protocolo gradio (verificado con pruebas reales):
 *   1. POST /upload               → array de STRINGS (paths), no objetos
 *   2. POST /queue/join           → { event_id }  (fn_index resuelto desde /config)
 *   3. GET  /queue/data?session…  → SSE con mensajes COMPLETOS
 *      (ojo: /call/.../stream no existe y /call tira el error a la basura;
 *       /queue/data es el único stream que entrega output.error entero)
 *   Este Space usa api_prefix "/gradio_api": los endpoints van debajo.
 *
 * Acepta DOS formatos de entrada:
 *   A) Multipart/form-data → archivos locales (human_image, garment_image)
 *   B) JSON → URLs remotas   ({ humanUrl, garmentUrl, description?, steps?, seed? })
 *
 * Siempre devuelve JSON: { imageUrl } o { error }
 *   (description y steps se aceptan por compatibilidad con la app pero el
 *    modelo actual solo recibe humano + prenda + seed + máscara automática)
 *
 * DEPLOY CLOUDFLARE (100% gratis, sin tarjeta):
 *   workers.cloudflare.com → tu worker → Edit Code → pegar TODO → Deploy
 *   URL: https://<tu-worker>.workers.dev
 *   RECOMENDADO: Settings → Variables and Secrets → HF_TOKEN = hf_...
 *   (cuenta HF gratis: 5 min/día de GPU en vez de 2 min anónimos).
 *
 * DEPLOY SUPABASE (Edge Function, gratis):
 *   Dashboard → Edge Functions → pegar TODO → Deploy
 *   Importante: Supabase exige Authorization (verify_jwt) → la app manda
 *   la publishable key en EXPO_PUBLIC_AIFIT_PROXY_KEY.
 *
 * En .env: EXPO_PUBLIC_AIFIT_PROVIDER=proxy + EXPO_PUBLIC_AIFIT_API_BASE=<URL>
 */

const HF = 'https://franciszzj-leffa.hf.space/gradio_api';

/**
 * Token opcional de Hugging Face. Sin token, ZeroGPU da 2 min/día de GPU
 * (≈8-10 generaciones). Con una cuenta gratis sube a 5 min; PRO, 40 min.
 * Cloudflare: Settings → Variables and Secrets → HF_TOKEN.
 */
let HF_TOKEN = '';

/** La plataforma corta a los ~150s: respondemos un error limpio antes. */
const DEADLINE_MS = 135000;

/** fn_index de respaldo si /config no se puede leer (leffa_predict_vt). */
const FALLBACK_FN_INDEX = 2;

/** Errores transitorios de cupo → vale la pena un reintento. */
const CAPACITY_RE = /too many users|try again later|capacity|rate.?limit|queue.*(full|busy)/i;

/** Cuota diaria de ZeroGPU agotada → reintentar no sirve, cortamos. */
const QUOTA_RE = /quota|exceeded.*gpu|gpu.*quota/i;

/**
 * Espera entre reintentos. Sin pausa los 3 intentos chocan contra la misma
 * saturación (el "too many users" dura decenas de segundos, no milisegundos).
 * Con backoff el reintento tiene chance real de entrar.
 */
const RETRY_DELAYS_MS = [4000, 9000, 15000];
const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1; // 4 intentos en total

export default {
  async fetch(request, env) {
    // Token opcional (Cloudflare `env` o Deno). Es constante por worker,
    // así que pisarlo en cada request es seguro aun con concurrencia.
    if (!HF_TOKEN) {
      const rtEnv = env || globalThis.Deno?.env;
      HF_TOKEN = rtEnv?.HF_TOKEN || rtEnv?.get?.('HF_TOKEN') || '';
    }

    // ── CORS ──────────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        },
      });
    }
    if (request.method !== 'POST') return respond(405, { error: 'Solo POST' });

    const deadline = Date.now() + DEADLINE_MS;

    try {
      const ct = request.headers.get('Content-Type') || '';

      let humanFile, garmentFile, desc, steps, seed, category;

      if (ct.includes('multipart/form-data')) {
        // ── MODO A: archivos locales ──────────────────────
        const form = await request.formData();
        humanFile = form.get('human_image');
        garmentFile = form.get('garment_image');
        desc = form.get('description') || '';
        category = form.get('category') || '';
        steps = parseInt(form.get('steps') || '30', 10);
        seed = parseInt(form.get('seed') || '0', 10);
      } else {
        // ── MODO B: JSON con URLs ─────────────────────────
        const body = await request.json();
        if (!body.humanUrl || !body.garmentUrl) {
          return respond(400, { error: 'humanUrl y garmentUrl requeridos' });
        }
        desc = body.description || '';
        category = body.category || '';
        steps = parseInt(body.steps || '30', 10);
        seed = parseInt(body.seed || '0', 10);

        // Descargar imágenes de las URLs
        const [hResp, gResp] = await Promise.all([
          fetch(body.humanUrl),
          fetch(body.garmentUrl),
        ]);
        if (!hResp.ok) return respond(502, { error: `No se pudo descargar human: ${hResp.status}` });
        if (!gResp.ok) return respond(502, { error: `No se pudo descargar garment: ${gResp.status}` });

        humanFile = await toFile(hResp, 'human.png');
        garmentFile = await toFile(gResp, 'garment.png');
      }

      if (!humanFile || !garmentFile) {
        return respond(400, { error: 'human_image y garment_image requeridos' });
      }

      // ── 1. Subir foto de la persona ──────────────────────
      const p1 = await uploadOne(HF, humanFile, humanFile.name || 'human.png', 'human');
      const p2 = await uploadOne(HF, garmentFile, garmentFile.name || 'garment.png', 'garment');

      // ── 2. Resolver fn_index (sobrevive a redeploys del space) ──
      const fnIndex = await resolveFnIndex();

      // Semilla del slider del space; 0 = "no especificada" → default 42.
      const seedVal = Number.isFinite(seed) && seed > 0 && seed <= 2147483647 ? seed : 42;
      // Leffa pide mínimo 30 pasos (default 30). Más pasos = más calidad.
      const stepsVal = Number.isFinite(steps) ? Math.min(50, Math.max(30, steps)) : 30;

      // leffa_predict_vt:
      // [persona, prenda, accelerate_ref, steps, guidance, seed, model_type, garment_type, repaint]
      const garmentType = leffaGarmentType(category);
      const data = [
        { path: p1, meta: { _type: 'gradio.FileData' } },
        { path: p2, meta: { _type: 'gradio.FileData' } },
        false, // accelerate reference UNet: false = máxima calidad
        stepsVal,
        2.5, // guidance scale (default de Leffa)
        seedVal,
        leffaModel(garmentType),
        garmentType,
        true, // repaint: pega la foto original fuera de la máscara → conserva la cara
      ];

      // ── 3. Llamar a la IA (reintentos con backoff si está saturado) ──
      let lastError = 'La IA no respondió';
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          const imageUrl = await runTryon(HF, data, fnIndex, deadline);
          return respond(200, { imageUrl });
        } catch (err) {
          if (err?.name === 'AbortError') throw err;
          lastError = err?.message || 'Error desconocido en la IA';
          const wait = RETRY_DELAYS_MS[attempt - 1] || 0;
          // Cuota diaria agotada: esperar no la recarga, mejor cortar.
          // Si no, reintentamos solo si queda tiempo para esperar + correr.
          const canRetry =
            !QUOTA_RE.test(String(lastError)) &&
            err?.retryable === true &&
            attempt < MAX_ATTEMPTS &&
            deadline - Date.now() > wait + 15000;
          if (!canRetry) break;
          console.log(
            `[Worker] intento ${attempt} falló (${lastError}); reintento en ${wait}ms`
          );
          await sleep(wait);
        }
      }
      return respond(502, { error: lastError });
    } catch (err) {
      if (err?.name === 'AbortError') {
        return respond(504, {
          error: 'El modelo tardó demasiado (más de 2 minutos). Probá de nuevo.',
        });
      }
      console.error('[Worker]', err.message);
      return respond(500, { error: err.message });
    }
  },
};

// ── Helpers ─────────────────────────────────────────────────

class TryonError extends Error {
  constructor(message, retryable = false) {
    super(message);
    this.retryable = retryable;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Headers para Hugging Face: suma el token si está configurado. */
function hfHeaders(extra = {}) {
  return HF_TOKEN ? { ...extra, Authorization: `Bearer ${HF_TOKEN}` } : extra;
}

/**
 * Categoría del clóset → la que espera Leffa.
 * Acepta valores crudos ("Pantalón", "Vestido") y los ya mapeados
 * ("lower_body", "dresses") por compatibilidad.
 */
const LOWER_RE = /pantal|short|falda|pollera|jean/i;
const DRESS_RE = /vestido|dress/i;
function leffaGarmentType(raw = '') {
  const c = String(raw);
  if (/^lower_body$/i.test(c) || LOWER_RE.test(c)) return 'lower_body';
  if (/^dresses?$/i.test(c) || DRESS_RE.test(c)) return 'dresses';
  return 'upper_body';
}

/**
 * VITON-HD solo se entrenó con torso; DressCode cubre torso, piernas y vestidos.
 * Por eso el torso usa el checkpoint recomendado y el resto el multi-categoría.
 */
function leffaModel(garmentType) {
  return garmentType === 'upper_body' ? 'viton_hd' : 'dress_code';
}

function respond(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

async function toFile(response, filename) {
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type || 'image/png' });
}

/** POST /upload → la respuesta es un array de strings (paths). */
async function uploadOne(base, file, filename, label) {
  // Un Blob llega como name "blob" (sin extensión): PIL sniff igual,
  // pero gradio guarda por nombre y preferimos uno con punto.
  const safeName = filename.includes('.')
    ? filename
    : `${filename}.${(file.type || '').includes('png') ? 'png' : 'jpg'}`;
  const form = new FormData();
  form.append('files', file, safeName);
  const resp = await fetch(`${base}/upload`, {
    method: 'POST',
    body: form,
    headers: hfHeaders(),
  });
  if (!resp.ok) throw new TryonError(`Upload ${label}: ${resp.status}`);
  const items = await resp.json();
  const item = Array.isArray(items) ? items[0] : items;
  const path = typeof item === 'string' ? item : item?.path;
  if (!path) throw new TryonError(`Upload ${label} no devolvió path`);
  return path;
}

/**
 * Busca en /config la función leffa_predict_vt:
 * imagen + imagen + 7 opciones (radio/number) → 3 imágenes.
 * Si el space cambia, nos adaptamos; si falla, usamos el índice conocido.
 */
async function resolveFnIndex() {
  try {
    const resp = await fetch(`${HF}/config`, { headers: hfHeaders() });
    if (!resp.ok) return FALLBACK_FN_INDEX;
    const cfg = await resp.json();
    const types = {};
    for (const c of cfg.components || []) types[c.id] = c.type;
    const deps = cfg.dependencies || [];
    const inp = (d) => (d.inputs || []).map((i) => types[i]);
    const out = (d) => (d.outputs || []).map((i) => types[i]);

    let idx = deps.findIndex((d) => d.api_name === 'leffa_predict_vt');
    if (idx < 0) {
      idx = deps.findIndex((d) => {
        const i = inp(d);
        return (
          i[0] === 'image' &&
          i[1] === 'image' &&
          i[2] === 'radio' &&
          i[3] === 'number' &&
          i.length === 9 &&
          out(d)[0] === 'image'
        );
      });
    }
    if (idx < 0) {
      idx = deps.findIndex((d) => {
        const i = inp(d);
        return i[0] === 'image' && i[1] === 'image' && i[2] === 'radio';
      });
    }
    return idx >= 0 ? idx : FALLBACK_FN_INDEX;
  } catch {
    return FALLBACK_FN_INDEX;
  }
}

/**
 * Flujo completo: /queue/join → SSE /queue/data → process_completed.
 * Devuelve la URL de la imagen o lanza TryonError.
 */
async function runTryon(base, data, fnIndex, deadline) {
  const session = crypto.randomUUID();

  const joinResp = await fetch(`${base}/queue/join`, {
    method: 'POST',
    headers: hfHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ data, fn_index: fnIndex, session_hash: session }),
  });
  if (!joinResp.ok) {
    const txt = await joinResp.text().catch(() => '');
    throw new TryonError(`IA rechazó la llamada: ${joinResp.status} ${txt.slice(0, 150)}`, true);
  }
  const { event_id } = await joinResp.json().catch(() => ({}));
  if (!event_id) throw new TryonError('No se recibió event_id de la IA', true);

  const msg = await readSSE(
    `${base}/queue/data?session_hash=${session}`,
    deadline
  );

  const out = msg.output || {};
  if (msg.success && !out.error) {
    const img = await downloadResult(base, (out.data || [])[0]);
    if (img) return img.imageUrl;
    // Sin imagen descargable: algunos spaces mandan un texto de estado en
    // data[2] ("Try again latter", "URL error…", "Empty image", …).
    // En Leffa data[2] es la densepose (objeto), así que el guard lo ignora.
    const info = Array.isArray(out.data) ? out.data[2] : null;
    const infoText = typeof info === 'string' && info.trim() ? info.trim() : '';
    throw new TryonError(
      infoText
        ? `El servicio de IA respondió: ${infoText}`
        : 'La IA devolvió una imagen que no se pudo descargar',
      true
    );
  }

  // success=false: o hay error visible… o es un crash interno suyo con
  // show_error=false (error null). El null suele ser transitorio (su backend
  // satura y su código oculta la causa). El error literal "Success" también
  // es transitorio (el servicio interno devuelve success=false + error=
  // "Success" cuando está saturado): se reintenta igual.
  const errText = out.error || 'crash interno del servicio (sin detalle)';
  const isTransient =
    !out.error ||
    CAPACITY_RE.test(String(errText)) ||
    String(errText).toLowerCase() === 'success';
  throw new TryonError(`El servicio de IA respondió: ${errText}`, isTransient);
}

/**
 * Arma las candidatas a URL del resultado y baja la PRIMERA que responda.
 * Motivo: gradio 4.43 a veces entrega /gradio_api/file= (404) o rutas
 * relativas, y el cache /tmp/gradio del space muere en SEGUNDOS — entregar
 * la URL al cliente garantiza un recuadro blanco "cargando" para siempre.
 * Por eso el worker baja los bytes AHORA y entrega un data URI: la imagen
 * viaja adentro del JSON y nada depende del cache ajeno.
 */
async function downloadResult(base, imgData) {
  // Leffa devuelve 3 imágenes y pasamos out.data[0] (el resultado), pero
  // algunos spaces devuelven GALLERY [[{ image: FileData }], …]: desarmamos
  // hasta llegar al FileData real.
  let d = imgData;
  if (Array.isArray(d)) d = d[0];
  if (d && d.image) d = d.image;

  const candidates = [];
  const push = (u) => { if (u && !candidates.includes(u)) candidates.push(u); };
  const host = base.replace(/\/gradio_api$/, '');

  if (typeof d === 'string') {
    if (d.startsWith('http')) push(d);
    else {
      push(`${base}/file=${d}`);
      push(`${host}/file=${d}`);
    }
  } else if (d) {
    if (d.url) {
      push(String(d.url)); // tal cual: /gradio_api/file=… es válido
      if (String(d.url).includes('/gradio_api/file=')) {
        push(String(d.url).replace('/gradio_api/file=', '/file='));
      }
    }
    if (d.path) {
      push(`${base}/file=${d.path}`);
      push(`${host}/file=${d.path}`);
    }
  }

  for (const url of candidates) {
    try {
      const r = await fetch(url, { headers: hfHeaders() });
      if (!r.ok) continue;
      const blob = await r.blob();
      return { imageUrl: await blobToDataUri(blob) };
    } catch { /* probamos la siguiente */ }
  }
  return null;
}

/** blob → data URI base64 (la respuesta JSON viaja con la imagen adentro). */
async function blobToDataUri(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return `data:${blob.type || 'image/png'};base64,${btoa(bin)}`;
}

async function readSSE(url, deadline) {
  // Cortamos el stream antes del límite de la plataforma: si el modelo no
  // terminó a tiempo, devolvemos un error prolijo en vez de uno opaco.
  const ctrl = new AbortController();
  const killer = setTimeout(() => ctrl.abort(), Math.max(0, deadline - Date.now()));

  let resp;
  try {
    resp = await fetch(url, { signal: ctrl.signal, headers: hfHeaders() });
  } catch (err) {
    clearTimeout(killer);
    throw err;
  }
  if (!resp.ok) {
    clearTimeout(killer);
    throw new TryonError(`Stream de la IA: HTTP ${resp.status}`, true);
  }

  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });

      const parts = buf.split('\n\n');
      buf = parts.pop() || '';
      for (const part of parts) {
        for (const line of part.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.msg === 'process_completed') {
              reader.cancel();
              return data;
            }
          } catch { /* ignorar líneas mal formadas */ }
        }
      }
    }
    throw new TryonError('El stream de la IA se cortó sin resultado', true);
  } finally {
    clearTimeout(killer);
  }
}
