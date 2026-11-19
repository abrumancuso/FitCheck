/**
 * bodyPhotoService.js — Foto de cuerpo persistente del usuario
 * ============================================================
 *
 * La foto se guarda UNA sola vez en Supabase Storage y su URL pública
 * vive en `user_metadata` de Supabase Auth (opción elegida para no
 * agregar tabla `profiles` ni triggers al esquema actual).
 *
 * - Bucket: el MISMO que ya usa el clóset (`clothing-images`).
 * - Path:   users/<userId>/body/body.jpg  (fijo + upsert → sin huérfanos)
 * - Metadata: body_photo_url, body_photo_path, body_photo_version,
 *             body_photo_deferred
 *
 * `body_photo_version` existe porque el path es fijo: sin un número de
 * versión, la URL pública no cambia al reemplazar el archivo y el
 * componente <Image> (y el CDN) puede seguir mostrando la foto vieja.
 */

import { Platform, Alert } from 'react-native';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../config/supabaseClient';

const BUCKET = 'clothing-images';
const bodyPhotoPath = (userId) => `users/${userId}/body/body.jpg`;

// ── Lectura de metadata ─────────────────────────────────────────

export const getBodyPhotoUrl = (user) => user?.user_metadata?.body_photo_url ?? null;

export const getBodyPhotoVersion = (user) => user?.user_metadata?.body_photo_version ?? 0;

/** El onboarding se muestra una sola vez: "Hacerlo más tarde" queda guardado. */
export const shouldShowBodyPhotoPrompt = (user) => {
  if (!user || getBodyPhotoUrl(user)) return false;
  return user.user_metadata?.body_photo_deferred !== true;
};

/**
 * Versión cache-busted SOLO para <Image>. La URL limpia se usa para la IA:
 * el servicio de try-on ya acepta http(s) y así no le metemos query params.
 */
export const withCacheBuster = (uri, version = 0) => {
  if (!uri || !/^https?:\/\//i.test(uri) || !version) return uri;
  return `${uri}${uri.includes('?') ? '&' : '?'}v=${version}`;
};

// ── Selección de imagen ─────────────────────────────────────────

/**
 * Abre cámara o galería con expo-image-picker (funciona en Expo Go).
 * En web no hay cámara nativa: los callers ocultan esa opción.
 * @returns {Promise<string|null>} URI local, o null si canceló / falló.
 */
export const pickBodyImage = async (source = 'gallery') => {
  try {
    let result;

    if (source === 'camera') {
      if (Platform.OS === 'web') return null;
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso necesario', 'Necesitamos acceso a la cámara');
        return null;
      }
      result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    } else {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permiso necesario', 'Necesitamos acceso a tu galería');
          return null;
        }
      }
      // En web Expo resuelve esto a un <input type="file">.
      result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    }

    if (result.canceled || !result.assets?.[0]?.uri) return null;
    return result.assets[0].uri;
  } catch (e) {
    console.warn('[bodyPhoto] picker error:', e?.message);
    Alert.alert('Error', 'No se pudo cargar la foto');
    return null;
  }
};

// ── Persistencia ────────────────────────────────────────────────

/**
 * Sube/reemplaza la foto y guarda la URL en user_metadata.
 * Devuelve { url, path, version, user } para actualizar el contexto
 * sin un viaje extra al servidor.
 *
 * @param {string} userId         — ID del usuario autenticado
 * @param {string} imageUri       — URI local devuelta por el picker
 * @param {object} currentMetadata — metadata actual (se preserva completa)
 */
export const uploadBodyPhoto = async (userId, imageUri, currentMetadata = {}) => {
  if (!userId) throw new Error('No hay usuario autenticado');
  if (!imageUri) throw new Error('No hay imagen para subir');

  const path = bodyPhotoPath(userId);
  const contentType = /\.png(\?|#|$)/i.test(imageUri) ? 'image/png' : 'image/jpeg';

  // Mismo patrón que storageService.js (expo-file-system v19 / File).
  const imageFile = new File(imageUri);
  const arrayBuffer = await imageFile.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, { contentType, upsert: true });
  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
  if (!publicUrl) throw new Error('No se pudo obtener la URL pública');

  const version = Date.now();
  const { data, error } = await supabase.auth.updateUser({
    data: {
      ...currentMetadata,
      body_photo_url: publicUrl,
      body_photo_path: path,
      body_photo_version: version,
      body_photo_deferred: false,
    },
  });
  if (error) throw error;

  return { url: publicUrl, path, version, user: data?.user };
};

/** "Hacerlo más tarde": se guarda en metadata para no preguntar de nuevo. */
export const markBodyPhotoDeferred = async (currentMetadata = {}) => {
  const { data, error } = await supabase.auth.updateUser({
    data: { ...currentMetadata, body_photo_deferred: true },
  });
  if (error) throw error;
  return data?.user;
};
