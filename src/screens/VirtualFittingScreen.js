/**
 * VirtualFittingScreen — Probador Virtual (Hito 1 + Hito 2)
 * ==========================================================
 * Flujo: foto de cuerpo → prenda del clóset → generación IA (cloud)
 *        → resultado con marca de agua → compartir / guardar.
 *
 * Registrada como TAB "Probador" en TabNavigator.
 * Se puede preseleccionar una prenda llegando desde el Armario:
 *   navigation.navigate('Fitting', { itemId })
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Share,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import * as ImagePicker from 'expo-image-picker';
// En web, metro.config.js redirige esto a un shim no-op
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import ViewShot from 'react-native-view-shot';
import { File, Paths } from 'expo-file-system';

import { useAuth } from '../context/AuthContext';
import { getClothingItems } from '../services/clothingService';
import {
  generateTryOn,
  cancelTryOn,
  MAX_TRY_ON_GARMENTS,
  isTryOnSupported,
  isFittingConfigured,
} from '../services/aiFittingService';
import { COLORS } from '../constants/theme';
import { useAppScale } from '../utils/responsive';
import ScreenWrapper from '../components/ScreenWrapper';
import { impact, notification, selection } from '../utils/haptics';

const LOGO = require('../../assets/icon.png');

export default function VirtualFittingScreen({ navigation, route }) {
  const { scale, fontScale, verticalScale } = useAppScale();
  const { user } = useAuth();

  const S = (n) => scale(n);
  const FS = (n) => fontScale(n);
  const VS = (n) => verticalScale(n);
  const H_PADDING = S(24);

  const captureRef = useRef(null);

  // Composite nativo de la prenda (fondo blanco): view-shot necesita un
  // View montado y cargado para capturarlo. Los refs median la espera.
  const compViewShot = useRef(null);
  const compLoadedRef = useRef(null);
  const [compSrc, setCompSrc] = useState(null);

  const [items, setItems] = useState([]);
  const [bodyUri, setBodyUri] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  const [status, setStatus] = useState('idle'); // idle | working | done
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState(null);
  const [resultUrl, setResultUrl] = useState(null);
  const [resultAspect, setResultAspect] = useState(3 / 4);
  const [imageReady, setImageReady] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedItems = items.filter((i) => selectedIds.includes(i.id));

  // ── Datos ───────────────────────────────────────────────────

  const loadItems = async () => {
    try {
      const data = await getClothingItems(user.id);
      setItems(data);
    } catch (_) {}
  };

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [])
  );

  // Llegada desde el Armario con una prenda preseleccionada
  useEffect(() => {
    const id = route.params?.itemId;
    if (!id) return;
    setSelectedIds([id]);
    navigation.setParams({ itemId: undefined });
  }, [route.params?.itemId]);

  const clearResult = () => {
    setResultUrl(null);
    setImageReady(false);
    setError(null);
    setStatus('idle');
    setStatusText('');
  };

  // ── Foto de cuerpo ──────────────────────────────────────────

  const pickBody = async (source) => {
    impact.light();
    try {
      let result;

      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permiso necesario', 'Necesitamos acceso a la cámara');
          return;
        }
        result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permiso necesario', 'Necesitamos acceso a tu galería');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
      }

      if (result.canceled) return;
      setBodyUri(result.assets[0].uri);
      clearResult();
    } catch (e) {
      Alert.alert('Error', 'No se pudo cargar la foto');
    }
  };

  // ── Generación ──────────────────────────────────────────────

  /**
   * Prenda transparente (remove.bg) → JPEG sobre fondo BLANCO, solo nativo.
   * En web el servicio lo hace con canvas (compositeWhite); acá no hay
   * canvas, así que renderizamos la prenda sobre un View blanco y capturamos
   * con view-shot. El servicio interno del space re-encodea a JPEG y el
   * alpha se vuelve NEGRO: fondo oscuro = la IA no segmenta la prenda.
   * Si algo falla, mandamos el original (como antes).
   */
  const compositeGarment = useCallback(async (uri) => {
    try {
      const loaded = new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('la prenda no cargó a tiempo')), 15000);
        compLoadedRef.current = () => {
          clearTimeout(t);
          resolve();
        };
      });
      setCompSrc(uri);
      await loaded;
      // Un frame para que el layout quede asentado antes de capturar
      await new Promise((r) => setTimeout(r, 300));
      const out = await compViewShot.current.capture();
      if (!out) throw new Error('capture devolvió vacío');
      // view-shot escribe en tmp/ReactNative/ — iOS lo PURGA. En el modo
      // multi-prenda el archivo espera minutos hasta su paso: copiamos la
      // captura a la caché estable (Library/Caches) ahora mismo y usamos ESA.
      const stable = new File(Paths.cache, `composite-${Date.now()}.jpg`);
      await new File(out).copy(stable);
      console.log('[aifit] prenda compuesta sobre blanco:', stable.uri);
      return stable.uri;
    } catch (e) {
      console.warn('[aifit] composite nativo falló, mando original:', e?.message);
      return uri;
    } finally {
      compLoadedRef.current = null;
      setCompSrc(null);
    }
  }, []);

  const handleTryOn = async () => {
    if (!bodyUri || selectedIds.length === 0 || status === 'working') return;

    if (!isFittingConfigured()) {
      Alert.alert(
        'Servicio no configurado',
        'Falta configurar la API en el archivo .env (EXPO_PUBLIC_AIFIT_API_BASE).'
      );
      return;
    }

    const garments = selectedItems
      .filter((item) => isTryOnSupported(item.category))
      .map((item) => ({
        uri: item.imageUrl || item.image_url,
        category: item.category,
        description: [item.category, item.brand].filter(Boolean).join(' '),
      }))
      .slice(0, MAX_TRY_ON_GARMENTS);

    if (garments.length === 0) {
      Alert.alert(
        'Sin prendas válidas',
        'El probador solo viste ropa: elegí prendas de arriba, abajo o vestidos.'
      );
      return;
    }

    impact.medium();
    clearResult();
    setStatus('working');

    try {
      // Nativo: aplanamos CADA prenda sobre blanco ANTES de encadenar.
      // Web ya lo hace dentro del servicio (compositeWhite por canvas).
      if (Platform.OS !== 'web') {
        for (const g of garments) {
          setStatusText('Preparando la prenda…');
          g.uri = await compositeGarment(g.uri);
        }
      }

      setStatusText('Preparando imágenes…');
      const url = await generateTryOn({
        humanUri: bodyUri,
        garments,
        onStatus: setStatusText,
      });

      // Medimos el resultado para que el contenedor respete la proporción real
      Image.getSize(
        url,
        (w, h) => setResultAspect(w / h),
        () => setResultAspect(3 / 4)
      );

      setResultUrl(url);
      setStatus('done');
      notification.success();
    } catch (e) {
      if (e?.code === 'CANCELLED') {
        setStatus('idle');
        setStatusText('');
        return;
      }
      setStatus('idle');
      setStatusText('');
      setError(e?.message || 'No se pudo generar el probador');
      notification.error();
    }
  };

  const handleCancel = () => {
    cancelTryOn();
  };

  // ── Share / Guardar (con marca de agua quemada en el PNG) ───

  const handleShare = async () => {
    if (!captureRef.current || !imageReady) return;
    impact.light();
    try {
      // capture() rasteriza la View: imagen + watermark = un solo PNG
      const uri = await captureRef.current.capture();

      // En Android, Share.share() SOLO manda texto (url es iOS-only),
      // así que el canal real de archivos es expo-sharing.
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Compartir probador',
          UTI: 'public.png',
        });
        return;
      }

      await Share.share({
        message: `Probé "${selectedItems.map((i) => i.category).join(' + ')}" en el Probador Virtual de FitCheck`,
        title: 'FitCheck',
      });
    } catch (err) {
      const msg = String(err?.message || '');
      const cancelled =
        msg.includes('User did not share') ||
        msg.includes('cancel') ||
        err?.code === 'ERR_CANCELED';
      if (!cancelled) Alert.alert('Error', 'No se pudo compartir la imagen');
    }
  };

  const handleSaveToGallery = async () => {
    if (Platform.OS === 'web') {
      Alert.alert(
        'Aviso',
        'Esta función es exclusiva de la app móvil. En la web podés sacar una captura de pantalla.'
      );
      return;
    }
    if (!captureRef.current || !imageReady) return;

    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso necesario', 'Necesitamos acceso a tu galería.');
      return;
    }

    setSaving(true);
    try {
      const uri = await captureRef.current.capture();
      await MediaLibrary.saveToLibraryAsync(uri);
      notification.success();
      Alert.alert('Guardado', 'La imagen se guardó en tu galería con la marca de FitCheck');
    } catch (_) {
      Alert.alert('Error', 'No se pudo guardar la imagen');
    } finally {
      setSaving(false);
    }
  };

  // ── Estilos locales ─────────────────────────────────────────

  const sectionLabel = {
    fontSize: FS(12),
    fontWeight: '600',
    color: COLORS.text,
    letterSpacing: 0.8,
    marginTop: VS(20),
    marginBottom: S(8),
  };

  const primaryBtn = {
    backgroundColor: COLORS.primary,
    borderRadius: S(12),
    paddingVertical: S(15),
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: S(8),
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: VS(4) },
    shadowOpacity: 0.2,
    shadowRadius: S(8),
    elevation: 4,
  };

  const ghostBtn = {
    backgroundColor: COLORS.white,
    borderRadius: S(12),
    paddingVertical: S(14),
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: S(8),
    borderWidth: 1,
    borderColor: COLORS.border,
  };

  const smallBtn = {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: S(10),
    paddingVertical: S(10),
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: S(6),
    borderWidth: 1,
    borderColor: COLORS.border,
  };

  // ── Render ──────────────────────────────────────────────────

  return (
    <ScreenWrapper horizontalPadding={false}>
      <View style={{ flex: 1 }}>
        {/* Header fijo */}
        <View style={{ paddingHorizontal: H_PADDING, paddingTop: VS(12), paddingBottom: S(4) }}>
          <Text style={{ fontSize: FS(24), fontWeight: '700', color: COLORS.primary }}>
            Probador Virtual
          </Text>
          <Text style={{ fontSize: FS(13), color: COLORS.textLight, marginTop: S(2) }}>
            Probá tus prendas en tu cuerpo con IA
          </Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: H_PADDING,
            paddingTop: S(8),
            paddingBottom: VS(110),
          }}
        >
          {/* ── 1. TU FOTO ─────────────────────────────────── */}

          <Text style={sectionLabel}>1 · TU FOTO</Text>

          <TouchableOpacity
            style={{
              width: '100%',
              height: VS(230),
              borderRadius: S(12),
              overflow: 'hidden',
              backgroundColor: COLORS.white,
              borderWidth: 1,
              borderColor: '#E8E0D6',
              borderStyle: 'dashed',
            }}
            onPress={() => pickBody('gallery')}
            activeOpacity={0.85}
          >
            {bodyUri ? (
              <Image source={{ uri: bodyUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            ) : (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="scan-outline" size={S(40)} color="#E8E0D6" />
                <Text style={{ fontSize: FS(14), color: COLORS.textLight, marginTop: S(8) }}>
                  Subí una foto de cuerpo entero
                </Text>
                <Text style={{ fontSize: FS(11), color: COLORS.textLight, marginTop: S(4) }}>
                  De frente, con buena luz, sin espejo
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', gap: S(8), marginTop: S(8) }}>
            <TouchableOpacity style={smallBtn} onPress={() => pickBody('camera')} activeOpacity={0.85}>
              <Ionicons name="camera-outline" size={FS(16)} color={COLORS.text} />
              <Text style={{ fontSize: FS(13), fontWeight: '600', color: COLORS.text }}>
                Cámara
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={smallBtn} onPress={() => pickBody('gallery')} activeOpacity={0.85}>
              <Ionicons name="image-outline" size={FS(16)} color={COLORS.text} />
              <Text style={{ fontSize: FS(13), fontWeight: '600', color: COLORS.text }}>
                Galería
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── 2. TUS PRENDAS ──────────────────────────────── */}

          <Text style={sectionLabel}>2 · ELEGÍ TUS PRENDAS</Text>
          <Text style={{ fontSize: FS(12), color: COLORS.textLight, marginBottom: S(8) }}>
            {selectedIds.length > 0
              ? `${selectedIds.length} de ${MAX_TRY_ON_GARMENTS} seleccionadas — tocalas de nuevo para sacarlas`
              : `Elegí hasta ${MAX_TRY_ON_GARMENTS} prendas (solo ropa: arriba, abajo y vestidos)`}
          </Text>

          {items.length === 0 ? (
            <View
              style={{
                backgroundColor: COLORS.white,
                borderRadius: S(14),
                borderWidth: 1,
                borderColor: COLORS.border,
                borderStyle: 'dashed',
                padding: S(20),
                alignItems: 'center',
              }}
            >
              <Ionicons name="shirt-outline" size={S(32)} color={COLORS.border} />
              <Text
                style={{
                  fontSize: FS(14),
                  fontWeight: '600',
                  color: '#1A1A1A',
                  marginTop: S(8),
                }}
              >
                Tu armario está vacío
              </Text>
              <Text
                style={{
                  fontSize: FS(12),
                  color: COLORS.textLight,
                  textAlign: 'center',
                  marginTop: S(4),
                  marginBottom: S(14),
                }}
              >
                Agregá prendas para poder probarlas
              </Text>
              <TouchableOpacity
                style={{
                  backgroundColor: COLORS.primary,
                  paddingVertical: S(10),
                  paddingHorizontal: S(22),
                  borderRadius: S(10),
                }}
                onPress={() => navigation.navigate('AddClothing')}
                activeOpacity={0.85}
              >
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: FS(14) }}>
                  Agregar prenda
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: S(10) }}
            >
              {items.map((item) => {
                const idx = selectedIds.indexOf(item.id);
                const isSelected = idx !== -1;
                const uri = item.imageUrl || item.image_url;
                return (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.85}
                    onPress={() => {
                      if (isSelected) {
                        setSelectedIds((prev) => prev.filter((x) => x !== item.id));
                      } else if (!isTryOnSupported(item.category)) {
                        Alert.alert(
                          'Prenda no compatible',
                          'El probador viste ropa (arriba, abajo y vestidos). Los zapatos y accesorios no se pueden poner con IA: el modelo los dibujaría como ropa.'
                        );
                        return;
                      } else if (selectedIds.length >= MAX_TRY_ON_GARMENTS) {
                        Alert.alert(
                          `Máximo ${MAX_TRY_ON_GARMENTS}`,
                          `El probador encadena hasta ${MAX_TRY_ON_GARMENTS} prendas por vez.`
                        );
                        return;
                      } else {
                        setSelectedIds((prev) => [...prev, item.id]);
                      }
                      selection();
                      clearResult();
                    }}
                    style={{
                      width: S(94),
                      borderRadius: S(12),
                      backgroundColor: COLORS.white,
                      borderWidth: isSelected ? 2 : 1,
                      borderColor: isSelected ? COLORS.gold : COLORS.border,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        height: S(110),
                        backgroundColor: item.color || '#F5F0EB',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      {uri ? (
                        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      ) : (
                        <Ionicons name="shirt-outline" size={S(28)} color="#FFFFFF" style={{ opacity: 0.6 }} />
                      )}

                      {isSelected && (
                        <View
                          style={{
                            position: 'absolute',
                            top: S(6),
                            right: S(6),
                            minWidth: S(20),
                            height: S(20),
                            borderRadius: S(10),
                            backgroundColor: COLORS.gold,
                            justifyContent: 'center',
                            alignItems: 'center',
                            paddingHorizontal: S(4),
                          }}
                        >
                          {selectedIds.length > 1 ? (
                            <Text style={{ color: '#fff', fontSize: FS(11), fontWeight: '700' }}>
                              {idx + 1}
                            </Text>
                          ) : (
                            <Ionicons name="checkmark" size={S(13)} color="#fff" />
                          )}
                        </View>
                      )}
                    </View>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: FS(11),
                        fontWeight: '600',
                        color: '#1A1A1A',
                        paddingHorizontal: S(6),
                        paddingVertical: S(6),
                      }}
                    >
                      {item.category}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* ── CTA ────────────────────────────────────────── */}

          <TouchableOpacity
            style={[
              primaryBtn,
              {
                marginTop: VS(24),
                opacity: !bodyUri || selectedIds.length === 0 || status === 'working' ? 0.5 : 1,
              },
            ]}
            onPress={handleTryOn}
            disabled={!bodyUri || selectedIds.length === 0 || status === 'working'}
            activeOpacity={0.85}
          >
            {status === 'working' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="sparkles-outline" size={FS(18)} color="#fff" />
                <Text style={{ color: '#fff', fontSize: FS(16), fontWeight: '600' }}>
                  Probar en mi cuerpo
                </Text>
              </>
            )}
          </TouchableOpacity>

          {!bodyUri || selectedIds.length === 0 ? (
            <Text
              style={{
                fontSize: FS(12),
                color: COLORS.textLight,
                textAlign: 'center',
                marginTop: S(8),
              }}
            >
              {!bodyUri
                ? 'Falta tu foto'
                : 'Elegí una prenda del listado de arriba'}
            </Text>
          ) : null}

          {/* ── Error ──────────────────────────────────────── */}

          {error ? (
            <View
              style={{
                marginTop: VS(16),
                backgroundColor: COLORS.error + '0D',
                borderWidth: 1,
                borderColor: COLORS.error + '40',
                borderRadius: S(12),
                padding: S(14),
                flexDirection: 'row',
                gap: S(10),
              }}
            >
              <Ionicons name="alert-circle-outline" size={FS(20)} color={COLORS.error} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: FS(13), fontWeight: '600', color: COLORS.error }}>
                  No se pudo generar
                </Text>
                <Text style={{ fontSize: FS(12), color: COLORS.text, marginTop: S(2), lineHeight: FS(17) }}>
                  {error}
                </Text>
              </View>
            </View>
          ) : null}

          {/* ── RESULTADO ──────────────────────────────────── */}

          {resultUrl ? (
            <View style={{ marginTop: VS(24) }}>
              <Text style={[sectionLabel, { marginTop: 0 }]}>RESULTADO</Text>

              {/* ViewShot: captura imagen + watermark juntos */}
              <ViewShot ref={captureRef} options={{ format: 'png', quality: 1.0 }} style={{ width: '100%' }}>
                <View
                  style={{
                    width: '100%',
                    aspectRatio: resultAspect,
                    backgroundColor: '#F5F0EB',
                    borderRadius: S(14),
                    overflow: 'hidden',
                    borderWidth: 1,
                    borderColor: COLORS.border,
                  }}
                >
                  <Image
                    source={{ uri: resultUrl }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                    onLoad={() => setImageReady(true)}
                  />

                  {/* Marca de agua — queda quemada en el PNG al compartir */}
                  <View
                    style={{
                      position: 'absolute',
                      right: S(10),
                      bottom: S(10),
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: S(6),
                      backgroundColor: 'rgba(0,0,0,0.42)',
                      paddingHorizontal: S(10),
                      paddingVertical: S(5),
                      borderRadius: 999,
                    }}
                  >
                    <Image source={LOGO} style={{ width: S(14), height: S(14), borderRadius: S(7) }} />
                    <Text
                      style={{
                        color: '#fff',
                        fontSize: FS(10),
                        fontWeight: '700',
                        letterSpacing: 1.2,
                      }}
                    >
                      FITCHECK
                    </Text>
                  </View>
                </View>
              </ViewShot>

              <View style={{ gap: S(10), marginTop: S(14) }}>
                <TouchableOpacity
                  style={[primaryBtn, { opacity: imageReady ? 1 : 0.5 }]}
                  onPress={handleShare}
                  disabled={!imageReady}
                  activeOpacity={0.85}
                >
                  <Ionicons name="share-social-outline" size={FS(18)} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: FS(16), fontWeight: '600' }}>
                    Compartir
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[ghostBtn, { opacity: imageReady ? 1 : 0.5 }]}
                  onPress={handleSaveToGallery}
                  disabled={!imageReady || saving}
                  activeOpacity={0.85}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={COLORS.text} />
                  ) : (
                    <Ionicons name="download-outline" size={FS(18)} color={COLORS.text} />
                  )}
                  <Text style={{ fontSize: FS(15), fontWeight: '600', color: COLORS.text }}>
                    {saving ? 'Guardando…' : 'Guardar en galería'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    paddingVertical: S(10),
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: S(6),
                  }}
                  onPress={handleTryOn}
                  disabled={status === 'working'}
                  activeOpacity={0.85}
                >
                  <Ionicons name="refresh-outline" size={FS(16)} color={COLORS.primary} />
                  <Text style={{ fontSize: FS(14), fontWeight: '600', color: COLORS.primary }}>
                    Generar otra vez
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </ScrollView>

        {/* ── Overlay de carga ──────────────────────────────── */}

        {status === 'working' && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(253,248,240,0.94)',
              justifyContent: 'center',
              alignItems: 'center',
              paddingHorizontal: S(40),
              zIndex: 30,
            }}
          >
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text
              style={{
                fontSize: FS(15),
                color: COLORS.primary,
                fontWeight: '600',
                marginTop: S(16),
                textAlign: 'center',
              }}
            >
              {statusText || 'Generando tu probador…'}
            </Text>
            <Text
              style={{
                fontSize: FS(12),
                color: COLORS.textLight,
                marginTop: S(6),
                textAlign: 'center',
              }}
            >
              La IA tarda ~1 min por prenda
            </Text>

            <TouchableOpacity
              style={{
                marginTop: S(20),
                paddingVertical: S(8),
                paddingHorizontal: S(20),
                borderRadius: 999,
                borderWidth: 1,
                borderColor: COLORS.border,
                backgroundColor: COLORS.white,
              }}
              onPress={handleCancel}
              activeOpacity={0.85}
            >
              <Text style={{ fontSize: FS(13), fontWeight: '600', color: COLORS.text }}>
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Host del composite nativo (fuera de pantalla) ──── */}
        {/* Prenda renderizada sobre blanco para capturarla con view-shot.
            pointerEvents=none: no intercepta toques. collapsable=false:
            Android no debe colapsar la View antes de la captura. */}

        {Platform.OS !== 'web' && compSrc ? (
          <View
            collapsable={false}
            pointerEvents="none"
            style={{ position: 'absolute', left: -10000, top: 0, width: S(360), height: S(480) }}
          >
            <ViewShot ref={compViewShot} options={{ format: 'jpg', quality: 0.85 }}>
              <View style={{ width: S(360), height: S(480), backgroundColor: '#FFFFFF' }}>
                <Image
                  source={{ uri: compSrc }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="contain"
                  onLoad={() => compLoadedRef.current?.()}
                />
              </View>
            </ViewShot>
          </View>
        ) : null}
      </View>
    </ScreenWrapper>
  );
}
