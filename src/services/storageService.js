/**
 * storageService.js — Upload de imágenes a Supabase Storage
 * ==========================================================
 *
 * Lee el archivo como ArrayBuffer con un helper que funciona en nativo
 * (expo-file-system) y en web (fetch del URI blob: del image picker).
 */

import { supabase } from '../config/supabaseClient';
import { readImageBytes } from '../utils/imageBytes';

const BUCKET = 'clothing-images';

/**
 * Sube la imagen de una prenda a Storage y devuelve la URL pública.
 *
 * @param {string} userId   — ID del usuario
 * @param {string} itemId   — ID único de la prenda
 * @param {string} imageUri — URI local (file://)
 * @returns {Promise<string>} URL pública
 */
export const uploadClothingImage = async (userId, itemId, imageUri) => {
  if (!imageUri) throw new Error('No hay imagen para subir');
  console.log('[storage] imageUri:', imageUri?.substring(0, 80));

  const filePath = `users/${userId}/clothing/${itemId}.png`;

  // 1. Leer el archivo como ArrayBuffer (nativo o web)
  const arrayBuffer = await readImageBytes(imageUri);
  console.log('[storage] arrayBuffer bytes:', arrayBuffer.byteLength);

  // 2. Subir a Supabase Storage
  const { error } = await supabase.storage.from(BUCKET).upload(filePath, arrayBuffer, {
    contentType: 'image/png',
    upsert: true,
  });
  if (error) {
    console.log('[storage] upload error:', error);
    throw error;
  }

  // 3. Obtener URL pública
  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  console.log('[storage] publicUrl:', publicUrl?.substring(0, 80));
  return publicUrl;
};

/**
 * Sube el PNG del resultado del probador (con marca de agua quemada).
 * Devuelve la URL pública y el path para poder hacer rollback si el INSERT
 * en `outfits` falla. Mismo bucket, carpeta distinta: users/<uid>/outfits/.
 *
 * @param {string} userId
 * @param {string} imageUri — URI local del PNG capturado con view-shot
 * @returns {Promise<{url: string, path: string}>}
 */
export const uploadOutfitImage = async (userId, imageUri) => {
  if (!userId) throw new Error('No hay usuario autenticado');
  if (!imageUri) throw new Error('No hay imagen para subir');

  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
  const filePath = `users/${userId}/outfits/${fileName}`;

  const arrayBuffer = await readImageBytes(imageUri);

  const { error } = await supabase.storage.from(BUCKET).upload(filePath, arrayBuffer, {
    contentType: 'image/png',
    upsert: false,
  });
  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  if (!publicUrl) throw new Error('No se pudo obtener la URL pública');
  return { url: publicUrl, path: filePath };
};

/** Limpieza si falló el guardado del registro después del upload. */
export const removeOutfitImage = async (path) => {
  if (!path) return;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) console.warn('[storage] no se pudo borrar imagen huérfana:', error?.message);
};
