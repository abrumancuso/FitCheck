/**
 * worker.js — Proxy de IA para FitCheck
 * =======================================
 * Toma las fotos desde la app, las manda a yisol/IDM-VTON en Hugging Face,
 * espera el resultado, y devuelve la URL de la imagen generada.
 *
 * Acepta DOS formatos de entrada:
 *   A) Multipart/form-data → archivos locales (human_image, garment_image)
 *   B) JSON → URLs remotas   ({ humanUrl, garmentUrl, description?, steps?, seed? })
 *
 * Siempre devuelve JSON: { imageUrl } o { error }
 *
 * DEPLOY (100% gratis, sin tarjeta):
 *   1. Andá a https://workers.cloudflare.com/
 *   2. "Sign up" con tu email (gratis, no pide tarjeta)
 *   3. "Create Worker"
 *   4. Borrá el código default, pegá TODO este archivo
 *   5. "Deploy"
 *   6. Copiá la URL (ej: https://fitcheck-tryon.xxxx.workers.dev)
 *   7. En tu proyecto usala como EXPO_PUBLIC_VTON_WORKER_URL
 */

const HF = 'https://yisol-idm-vton.hf.space';
const FN = '/tryon';

export default {
  async fetch(request) {
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

    try {
      const ct = request.headers.get('Content-Type') || '';

      let humanFile, garmentFile, desc, steps, seed;

      if (ct.includes('multipart/form-data')) {
        // ── MODO A: archivos locales ──────────────────────
        const form = await request.formData();
        humanFile = form.get('human_image');
        garmentFile = form.get('garment_image');
        desc = form.get('description') || '';
        steps = parseInt(form.get('steps') || '30', 10);
        seed = parseInt(form.get('seed') || '42', 10);
      } else {
        // ── MODO B: JSON con URLs ─────────────────────────
        const body = await request.json();
        desc = body.description || '';
        steps = parseInt(body.steps || '30', 10);
        seed = parseInt(body.seed || '42', 10);

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
      const f1 = new FormData();
      f1.append('files', humanFile, humanFile.name || 'human.png');
      const r1 = await fetch(`${HF}/upload`, { method: 'POST', body: f1 });
      if (!r1.ok) return respond(502, { error: `Upload human: ${r1.status}` });
      const [p1] = await r1.json();

      // ── 2. Subir foto de la prenda ───────────────────────
      const f2 = new FormData();
      f2.append('files', garmentFile, garmentFile.name || 'garment.png');
      const r2 = await fetch(`${HF}/upload`, { method: 'POST', body: f2 });
      if (!r2.ok) return respond(502, { error: `Upload garment: ${r2.status}` });
      const [p2] = await r2.json();

      // ── 3. Llamar a la IA ────────────────────────────────
      const r3 = await fetch(`${HF}/call${FN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: [
            { path: p1.path }, { path: p2.path }, desc,
            true, false, steps, seed,
          ],
        }),
      });
      if (!r3.ok) {
        const txt = await r3.text().catch(() => '');
        return respond(502, { error: `IA falló: ${r3.status} — ${txt.slice(0, 200)}` });
      }
      const { event_id } = await r3.json();
      if (!event_id) return respond(502, { error: 'No se recibió event_id de la IA' });

      // ── 4. Leer SSE hasta que termine ────────────────────
      const sse = await readSSE(`${HF}/call${FN}/${event_id}/stream`);
      const imgData = sse?.output?.data?.[0];
      if (!imgData) return respond(502, { error: 'La IA no devolvió resultado' });

      let imageUrl = null;
      if (typeof imgData === 'string') {
        imageUrl = imgData.startsWith('http') ? imgData : `${HF}/file=${imgData}`;
      } else if (imgData?.url) {
        imageUrl = imgData.url;
      } else if (imgData?.path) {
        imageUrl = `${HF}/file=${imgData.path}`;
      }
      if (!imageUrl) return respond(502, { error: 'No se pudo obtener URL del resultado' });

      return respond(200, { imageUrl });
    } catch (err) {
      console.error('[Worker]', err.message);
      return respond(500, { error: err.message });
    }
  },
};

// ── Helpers ─────────────────────────────────────────────────

function respond(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}

async function toFile(response, filename) {
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type || 'image/png' });
}

async function readSSE(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`SSE error: ${resp.status}`);

  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = '';

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
        } catch { /* ignorar */ }
      }
    }
  }
  throw new Error('SSE terminó sin process_completed');
}
