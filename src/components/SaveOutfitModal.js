/**
 * SaveOutfitModal — Nombre rápido para guardar un look de IA en Outfits
 * ====================================================================
 * Sigue el patrón de MissingItemSuggestionModal: Modal transparente,
 * card blanca, botón primario + botón de texto. El nombre viene
 * precargado ("Look IA - fecha") y se puede aceptar o editar.
 */

import { useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { useAppScale } from '../utils/responsive';

export default function SaveOutfitModal({
  visible,
  defaultName = '',
  saving = false,
  errorMsg = '',
  onConfirm,
  onCancel,
}) {
  const [name, setName] = useState(defaultName);

  // El modal se remonta al abrirlo (visible condicional en el caller),
  // así que el valor inicial se toma una sola vez por apertura.
  const handleConfirm = () => {
    const finalName = name.trim() || defaultName;
    if (finalName) onConfirm(finalName);
  };

  const { scale, fontScale, verticalScale } = useAppScale();
  const S = (n) => scale(n);
  const FS = (n) => fontScale(n);
  const VS = (n) => verticalScale(n);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{
          flex: 1, backgroundColor: COLORS.overlay,
          justifyContent: 'center', alignItems: 'center',
          paddingHorizontal: S(24),
        }}
      >
        <View style={{
          width: '100%', maxWidth: S(390),
          backgroundColor: COLORS.white,
          borderRadius: S(16), padding: S(22),
          shadowColor: '#000',
          shadowOffset: { width: 0, height: VS(8) },
          shadowOpacity: 0.18, shadowRadius: S(20), elevation: 8,
        }}>
          <View style={{
            width: S(48), height: S(48), borderRadius: S(24),
            backgroundColor: `${COLORS.gold}22`,
            justifyContent: 'center', alignItems: 'center',
            marginBottom: S(14),
          }}>
            <Ionicons name="sparkles-outline" size={S(24)} color={COLORS.gold} />
          </View>

          <Text style={{
            fontSize: FS(20), fontWeight: '700', color: COLORS.primary,
            marginBottom: S(6),
          }}>
            Guardar en Outfits
          </Text>
          <Text style={{
            fontSize: FS(13), color: COLORS.textLight,
            lineHeight: FS(19), marginBottom: S(16),
          }}>
            Ponéle un nombre para encontrarlo después en tu guardarropa.
          </Text>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Nombre del outfit"
            placeholderTextColor={COLORS.textLight}
            maxLength={60}
            returnKeyType="done"
            onSubmitEditing={handleConfirm}
            style={{
              borderWidth: 1, borderColor: COLORS.border,
              backgroundColor: COLORS.background,
              borderRadius: S(10), paddingHorizontal: S(12),
              paddingVertical: Platform.OS === 'ios' ? S(12) : S(8),
              fontSize: FS(15), color: COLORS.text, marginBottom: S(18),
            }}
          />

          {errorMsg ? (
            <View style={{
              backgroundColor: '#FDECEE', borderWidth: 1, borderColor: '#E6B7BE',
              borderRadius: S(10), padding: S(12), marginBottom: S(14),
            }}>
              <Text style={{ color: COLORS.primary, fontSize: FS(13), textAlign: 'center' }}>
                {errorMsg}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={{
              backgroundColor: COLORS.primary, borderRadius: S(12),
              paddingVertical: S(14), flexDirection: 'row',
              alignItems: 'center', justifyContent: 'center', gap: S(8),
              opacity: saving ? 0.7 : 1,
            }}
            onPress={handleConfirm}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Ionicons name="bookmark-outline" size={FS(17)} color={COLORS.white} />
            )}
            <Text style={{ fontSize: FS(15), fontWeight: '600', color: COLORS.white }}>
              {saving ? 'Guardando…' : 'Guardar outfit'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onCancel}
            disabled={saving}
            activeOpacity={0.85}
            style={{ paddingVertical: S(12), alignItems: 'center' }}
          >
            <Text style={{ fontSize: FS(13), color: COLORS.textLight }}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
