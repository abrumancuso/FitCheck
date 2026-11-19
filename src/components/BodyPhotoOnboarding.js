/**
 * BodyPhotoOnboarding — Bienvenida al primer ingreso
 * ==================================================
 *
 * Se monta en el RootNavigator cuando hay sesión y el usuario todavía
 * no tiene foto de cuerpo (y no eligió "Hacerlo más tarde").
 * Modal liviano: NO bloquea el clóset, se puede cerrar sin subir nada.
 */

import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { useAppScale } from '../utils/responsive';
import { useBodyPhoto } from '../hooks/useBodyPhoto';

export default function BodyPhotoOnboarding() {
  const { changePhoto, deferPhoto, uploading } = useBodyPhoto();
  const [busy, setBusy] = useState(false);

  const { scale, fontScale, verticalScale } = useAppScale();
  const S = (n) => scale(n);
  const FS = (n) => fontScale(n);
  const VS = (n) => verticalScale(n);

  const handleUpload = async (source) => {
    setBusy(true);
    await changePhoto(source);
    setBusy(false);
  };

  const handleLater = async () => {
    setBusy(true);
    await deferPhoto();
    setBusy(false);
  };

  const disabled = busy || uploading;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={handleLater}
    >
      <View style={{
        flex: 1,
        backgroundColor: COLORS.overlay,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: S(24),
      }}>
        <View style={{
          width: '100%',
          maxWidth: S(390),
          backgroundColor: COLORS.background,
          borderRadius: S(18),
          padding: S(24),
          shadowColor: '#000',
          shadowOffset: { width: 0, height: VS(8) },
          shadowOpacity: 0.18,
          shadowRadius: S(20),
          elevation: 8,
        }}>
          <View style={{
            width: S(56), height: S(56), borderRadius: S(28),
            backgroundColor: `${COLORS.gold}22`,
            justifyContent: 'center', alignItems: 'center',
            marginBottom: S(16),
          }}>
            <Ionicons name="person-outline" size={S(28)} color={COLORS.gold} />
          </View>

          <Text style={{
            fontSize: FS(22), fontWeight: '700', color: COLORS.primary,
            marginBottom: S(8),
          }}>
            Tu foto de cuerpo
          </Text>

          <Text style={{
            fontSize: FS(14), color: COLORS.text, lineHeight: FS(21),
            marginBottom: S(10),
          }}>
            Subila una sola vez y el Probador Virtual la usa automáticamente
            cada vez que quieras probarte algo.
          </Text>

          <Text style={{
            fontSize: FS(12), color: COLORS.textLight, lineHeight: FS(18),
            marginBottom: S(20),
          }}>
            De frente, cuerpo entero y con buena luz. Podés cambiarla cuando
            quieras desde tu perfil.
          </Text>

          <TouchableOpacity
            style={{
              backgroundColor: COLORS.primary,
              borderRadius: S(12),
              paddingVertical: S(15),
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: S(8),
              opacity: disabled ? 0.7 : 1,
            }}
            onPress={() => handleUpload('gallery')}
            disabled={disabled}
            activeOpacity={0.85}
          >
            {disabled ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Ionicons name="image-outline" size={FS(18)} color={COLORS.white} />
            )}
            <Text style={{ fontSize: FS(15), fontWeight: '600', color: COLORS.white }}>
              {uploading ? 'Guardando en tu perfil…' : 'Subir mi foto'}
            </Text>
          </TouchableOpacity>

          {Platform.OS !== 'web' && (
            <TouchableOpacity
              onPress={() => handleUpload('camera')}
              disabled={disabled}
              activeOpacity={0.85}
              style={{ paddingVertical: S(12), alignItems: 'center' }}
            >
              <Text style={{
                fontSize: FS(13), fontWeight: '600', color: COLORS.primary,
              }}>
                Usar la cámara
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={handleLater}
            disabled={disabled}
            activeOpacity={0.85}
            style={{ paddingVertical: S(10), alignItems: 'center' }}
          >
            <Text style={{ fontSize: FS(13), color: COLORS.textLight }}>
              Hacerlo más tarde
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
