/**
 * AddClothingScreen — Formulario responsive con ScreenWrapper
 * ============================================================
 */

import { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Image, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { useAuth } from '../context/AuthContext';
import { addClothingItem, updateClothingItem, deleteClothingItem, CATEGORIES, SEASONS, COLORS_LIST } from '../services/clothingService';
import { uploadClothingImage } from '../services/storageService';
import { removeBackground } from '../services/backgroundRemovalService';
import { COLORS } from '../constants/theme';
import { useAppScale } from '../utils/responsive';
import ScreenWrapper from '../components/ScreenWrapper';

export default function AddClothingScreen({ navigation }) {
  const { scale, fontScale, verticalScale } = useAppScale();
  const { user } = useAuth();
  const [imageUri, setImageUri] = useState(null);
  const [category, setCategory] = useState('');
  const [selectedColor, setSelectedColor] = useState(null);
  const [season, setSeason] = useState('Todas');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Timeout helper
  const withTimeout = (promise, ms, label) =>
    Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(`Tiempo excedido: ${label}`)), ms)),
    ]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permiso necesario', 'Necesitamos acceso a tu galería'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], quality: 0.7,
    });
    if (result.canceled) return;

    setProcessing(true);
    const originalUri = result.assets[0].uri;

    try {
      // Remover fondo automáticamente con remove.bg
      const processed = await withTimeout(
        removeBackground(originalUri),
        30000, 'remove.bg',
      );
      setImageUri(processed);

      if (processed === originalUri) {
        Alert.alert(
          'Fondo no removido',
          'Para recortar automáticamente la silueta de la prenda necesitás configurar EXPO_PUBLIC_REMOVE_BG_API_KEY en el archivo .env',
        );
      }
    } catch (e) {
      console.log('[pickImage] error:', e.message);
      Alert.alert('Error al procesar', e.message);
      setImageUri(originalUri);
    }

    setProcessing(false);
  };

  const handleSave = async () => {
    if (!category) return Alert.alert('Atención', 'Elegí una categoría');
    setLoading(true);
    let itemId = null;
    try {
      // 1. Crear la prenda en la tabla clothing_items (sin imagen aún)
      const record = await withTimeout(
        addClothingItem(user.id, {
          category, color: selectedColor, season,
          description: description.trim() || '',
          image_url: null,
        }),
        10000, 'Supabase al crear prenda'
      );
      itemId = record.id;

      // 2. Subir imagen (ya está procesada por remove.bg en pickImage)
      if (imageUri) {
        setProcessing(true);
        console.log('[DEBUG] subiendo imagen:', imageUri.substring(0, 80));

        const imageUrl = await withTimeout(
          uploadClothingImage(user.id, itemId, imageUri),
          60000, 'Storage al subir imagen'
        );
        console.log('[DEBUG] imageUrl:', imageUrl?.substring(0, 80));

        // 3. Actualizar el registro con la URL de la imagen
        await withTimeout(
          updateClothingItem(itemId, { image_url: imageUrl }),
          10000, 'Supabase al actualizar prenda'
        );
      } else {
        console.log('[DEBUG] NO HAY imageUri para subir');
      }

      Alert.alert('Listo', 'Prenda agregada', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.log('[DEBUG] ERROR en handleSave:', error.message);
      // Rollback: si se creó la prenda pero falló algo, la borramos
      if (itemId) {
        await deleteClothingItem(user.id, itemId).catch(() => {});
      }
      Alert.alert('Error', error.message || 'No se pudo guardar');
    } finally {
      setProcessing(false);
      setLoading(false);
    }
  };

  const S = (n) => scale(n);
  const FS = (n) => fontScale(n);
  const VS = (n) => verticalScale(n);

  const label = { fontSize: FS(12), fontWeight: '600', color: COLORS.text, letterSpacing: 0.8, marginBottom: S(8), marginTop: S(16) };
  const chip = (active) => ({
    paddingVertical: S(8), paddingHorizontal: S(14), borderRadius: 999,
    backgroundColor: active ? COLORS.primary : COLORS.white,
    borderWidth: 1, borderColor: active ? COLORS.primary : '#E8E0D6',
  });
  const chipText = (active) => ({
    fontSize: FS(13), color: active ? '#fff' : '#1A1A1A', fontWeight: active ? '600' : '400',
  });

  return (
    <>
    <ScreenWrapper horizontalPadding={false}>
      <View style={{ flex: 1 }}>
        {/* Back button */}
        <TouchableOpacity
          style={{ position: 'absolute', top: VS(16), left: S(8), zIndex: 10, padding: S(8) }}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={FS(24)} color={COLORS.primary} />
        </TouchableOpacity>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: S(24), paddingBottom: VS(60) }}>
          <Text style={{ ...label, marginTop: VS(40) }}>FOTO</Text>
          <TouchableOpacity
            style={{ width: '100%', height: VS(220), borderRadius: S(12), overflow: 'hidden', backgroundColor: COLORS.white, borderWidth: 1, borderColor: '#E8E0D6', borderStyle: 'dashed' }}
            onPress={pickImage}
          >
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
            ) : (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="camera-outline" size={S(40)} color="#E8E0D6" />
                <Text style={{ fontSize: FS(14), color: COLORS.textLight, marginTop: S(8) }}>Tocá para agregar foto</Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={label}>CATEGORÍA</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S(6) }}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity key={c} style={chip(category === c)} onPress={() => setCategory(c)}>
                <Text style={chipText(category === c)}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={label}>COLOR</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S(8) }}>
            {COLORS_LIST.map((c) => (
              <TouchableOpacity
                key={c.value}
                style={{ width: S(34), height: S(34), borderRadius: S(17), backgroundColor: c.value, borderWidth: selectedColor === c.value ? 3 : 2, borderColor: selectedColor === c.value ? COLORS.gold : 'transparent' }}
                onPress={() => setSelectedColor(c.value)}
              />
            ))}
          </View>

          <Text style={label}>TEMPORADA</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S(6) }}>
            {SEASONS.map((s) => (
              <TouchableOpacity key={s} style={chip(season === s)} onPress={() => setSeason(s)}>
                <Text style={chipText(season === s)}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={label}>DESCRIPCIÓN (opcional)</Text>
          <TextInput
            style={{ backgroundColor: COLORS.white, borderWidth: 1, borderColor: '#E8E0D6', borderRadius: S(12), padding: S(16), fontSize: FS(15), color: '#1A1A1A', minHeight: VS(80), textAlignVertical: 'top' }}
            placeholder="Ej: Mi remera favorita"
            placeholderTextColor={COLORS.textLight}
            value={description}
            onChangeText={setDescription}
            multiline
          />

          <TouchableOpacity
            style={{ backgroundColor: COLORS.primary, borderRadius: S(12), paddingVertical: S(16), alignItems: 'center', marginTop: S(24), shadowColor: COLORS.primary, shadowOffset: { width: 0, height: VS(4) }, shadowOpacity: 0.2, shadowRadius: FS(8), elevation: 4 }}
            onPress={handleSave}
            disabled={loading || processing}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color="#fff" /> : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S(8) }}>
                <Ionicons name="save-outline" size={FS(18)} color="#fff" />
                <Text style={{ color: '#fff', fontSize: FS(16), fontWeight: '600' }}>Guardar prenda</Text>
              </View>
            )}
          </TouchableOpacity>
        </ScrollView>

        {/* Processing overlay */}
        {processing && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(253,248,240,0.9)', justifyContent: 'center', alignItems: 'center', zIndex: 20 }}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={{ fontSize: FS(16), color: COLORS.primary, fontWeight: '600', marginTop: S(16) }}>Procesando imagen...</Text>
          </View>
        )}
      </View>
    </ScreenWrapper>
    </>
  );
}
