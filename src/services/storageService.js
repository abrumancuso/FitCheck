/**
 * storageService.js — Upload de imágenes a Supabase Storage
 * ==========================================================
 *
 * Lee el archivo como ArrayBuffer usando la API moderna de
 * expo-file-system v19 (clase File), y lo pasa directo a Supabase.
 */

import { File } from 'expo-file-system';
import { supabase } from '../config/supabaseClient';

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

  // 1. Leer el archivo como ArrayBuffer (API moderna expo-file-system v19)
  const imageFile = new File(imageUri);
  const arrayBuffer = await imageFile.arrayBuffer();
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
