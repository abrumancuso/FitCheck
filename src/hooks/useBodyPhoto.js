/**
 * useBodyPhoto — Hook compartido por Onboarding / Probador / Perfil
 * ================================================================
 *
 * Centraliza el flujo completo: elegir imagen (cámara o galería),
 * subirla a Supabase Storage, actualizar user_metadata y sincronizar
 * el AuthContext. Así las tres pantallas hacen exactamente lo mismo.
 */

import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import {
  pickBodyImage,
  uploadBodyPhoto,
  markBodyPhotoDeferred,
} from '../services/bodyPhotoService';

export function useBodyPhoto() {
  const { user, bodyPhotoUrl, bodyPhotoVersion, syncUser } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  /** Devuelve { url, path, version, user } o null si canceló / falló. */
  const changePhoto = useCallback(async (source = 'gallery') => {
    const uri = await pickBodyImage(source);
    if (!uri) return null;

    setUploading(true);
    setError(null);
    try {
      const result = await uploadBodyPhoto(user.id, uri, user.user_metadata || {});
      await syncUser(result.user);
      return result;
    } catch (e) {
      console.warn('[bodyPhoto] upload error:', e?.message);
      setError(e?.message || 'No se pudo guardar la foto');
      Alert.alert(
        'No se pudo guardar',
        'La foto no se subió a tu cuenta. Revisá tu conexión e intentá de nuevo.'
      );
      return null;
    } finally {
      setUploading(false);
    }
  }, [user?.id, user?.user_metadata, syncUser]);

  const deferPhoto = useCallback(async () => {
    try {
      const updated = await markBodyPhotoDeferred(user.user_metadata || {});
      await syncUser(updated);
    } catch (e) {
      console.warn('[bodyPhoto] defer error:', e?.message);
    }
  }, [user?.id, user?.user_metadata, syncUser]);

  return { bodyPhotoUrl, bodyPhotoVersion, changePhoto, deferPhoto, uploading, error };
}
