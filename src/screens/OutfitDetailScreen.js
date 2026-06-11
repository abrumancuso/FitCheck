/**
 * OutfitDetailScreen — Vista completa de un outfit guardado
 * ==========================================================
 * Muestra el outfit en un lienzo blanco, permite
 * compartirlo y guardarlo como imagen en el dispositivo.
 */

import { useRef, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, Alert, Share,
  ScrollView, ActivityIndicator,
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { Ionicons } from '@expo/vector-icons';
import ViewShot from 'react-native-view-shot';
import { COLORS } from '../constants/theme';
import { useAppScale } from '../utils/responsive';
import ScreenWrapper from '../components/ScreenWrapper';
import OutfitPreview, { getInitialPosition } from '../components/OutfitPreview';
import { notification } from '../utils/haptics';

export default function OutfitDetailScreen({ route, navigation }) {
  const { outfit, items } = route.params;
  const { scale, fontScale, verticalScale, width } = useAppScale();
  const S = (n) => scale(n);
  const FS = (n) => fontScale(n);
  const VS = (n) => verticalScale(n);

  const captureRef = useRef(null);
  const [saving, setSaving] = useState(false);

  // Posiciones guardadas del outfit o por defecto
  const itemSettings = useMemo(() => {
    const saved = outfit.item_settings || {};
    const settings = {};
    const canvasW = width * 0.9;
    items.forEach((item) => {
      const s = saved[item.id];
      const initial = getInitialPosition(item?.category, canvasW);
      settings[item.id] = {
        scale: s?.scale ?? initial.scale,
        offsetX: s?.offsetX ?? (initial.offsetX || 0),
        offsetY: s?.offsetY ?? (initial.offsetY || 0),
        locked: true,
      };
    });
    return settings;
  }, [items, width, outfit]);

  // ─── Compartir ────────────────────────────────────────────

  const handleShare = async () => {
    if (!captureRef.current) return;
    try {
      const uri = await captureRef.current.capture();
      await Share.share({
        url: uri,
        message: `Mirá el outfit "${outfit.name}" que armé en FitCheck 👗`,
      });
    } catch (err) {
      if (err?.message !== 'User did not share') {
        Alert.alert('Error', 'No se pudo compartir');
      }
    }
  };

  // ─── Guardar a galería ────────────────────────────────────

  const handleSaveToGallery = async () => {
    if (!captureRef.current) return;

    // Pedir permisos
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permiso necesario',
        'Necesitamos acceso a tu galería para guardar la imagen',
      );
      return;
    }

    setSaving(true);
    try {
      const uri = await captureRef.current.capture();
      await MediaLibrary.saveToLibraryAsync(uri);
      notification.success();
      Alert.alert('Guardado', `"${outfit.name}" se guardó en tu galería`);
    } catch (err) {
      Alert.alert('Error', 'No se pudo guardar la imagen');
    } finally {
      setSaving(false);
    }
  };

  // ─── Editar ─────────────────────────────────────────────────

  const handleEdit = () => {
    navigation.navigate('Main', {
      screen: 'Outfits',
      params: { editOutfit: outfit },
    });
  };

  // ─── Render ───────────────────────────────────────────────

  return (
    <ScreenWrapper>
      <ScrollView
        contentContainerStyle={{ paddingBottom: VS(40) }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: VS(12),
          marginBottom: S(16),
        }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ marginRight: S(12) }}
          >
            <Ionicons name="arrow-back" size={FS(24)} color={COLORS.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{
              fontSize: FS(22), fontWeight: '700', color: COLORS.primary,
            }}>
              {outfit.name}
            </Text>
            <Text style={{
              fontSize: FS(13), color: COLORS.textLight, marginTop: S(2),
            }}>
              {items.length} {items.length === 1 ? 'prenda' : 'prendas'}
            </Text>
          </View>
        </View>

        {/* Preview capturable */}
        <View style={{ alignItems: 'center', marginBottom: S(20) }}>
          <ViewShot
            ref={captureRef}
            options={{ format: 'png', quality: 1.0 }}
          >
            <OutfitPreview
              items={items}
              itemSettings={itemSettings}
              canvasWidth={width * 0.9}
            />
          </ViewShot>
        </View>

        {/* Botones de acción */}
        <View style={{ gap: S(10) }}>
          <TouchableOpacity
            style={{
              backgroundColor: COLORS.primary,
              borderRadius: S(12),
              paddingVertical: S(14),
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: S(8),
            }}
            onPress={handleShare}
            activeOpacity={0.85}
          >
            <Ionicons name="share-outline" size={FS(18)} color={COLORS.white} />
            <Text style={{
              fontSize: FS(16), fontWeight: '600', color: COLORS.white,
            }}>
              Compartir
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              backgroundColor: COLORS.white,
              borderRadius: S(12),
              paddingVertical: S(14),
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: S(8),
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
            onPress={handleEdit}
            activeOpacity={0.85}
          >
            <Ionicons name="create-outline" size={FS(18)} color={COLORS.text} />
            <Text style={{
              fontSize: FS(16), fontWeight: '600', color: COLORS.text,
            }}>
              Editar
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              backgroundColor: COLORS.white,
              borderRadius: S(12),
              paddingVertical: S(14),
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: S(8),
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
            onPress={handleSaveToGallery}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator size="small" color={COLORS.text} />
            ) : (
              <Ionicons name="download-outline" size={FS(18)} color={COLORS.text} />
            )}
            <Text style={{
              fontSize: FS(16), fontWeight: '600', color: COLORS.text,
            }}>
              {saving ? 'Guardando...' : 'Guardar en galería'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}
