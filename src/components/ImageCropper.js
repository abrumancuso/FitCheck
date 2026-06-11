/**
 * ImageCropper.js — Recorte cuadrado interactivo
 * ================================================
 * Modal que se abre automáticamente al elegir una foto.
 * Permite arrastrar la imagen y ajustar zoom para elegir
 * el encuadre perfecto cuadrado.
 *
 * Props:
 *   visible     — bool, controla el modal
 *   imageUri    — string, URI de la imagen original
 *   onCrop      — (croppedUri: string) => void, se llama con la imagen recortada
 *   onCancel    — () => void, se llama si cancela
 */

import { useState, useRef, useEffect } from 'react';
import {
  View, Image, Modal, PanResponder,
  TouchableOpacity, Text, ActivityIndicator, Dimensions, Platform,
} from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { useAppScale } from '../utils/responsive';

const { width: SCREEN_W } = Dimensions.get('window');

export default function ImageCropper({ visible, imageUri, onCrop, onCancel }) {
  const { scale, fontScale, verticalScale } = useAppScale();
  const S = (n) => scale(n);
  const FS = (n) => fontScale(n);

  // Tamaño del marco de recorte (90% del ancho de pantalla, máximo 400)
  const CROP_SIZE = Math.min(SCREEN_W * 0.9, 400);

  const [imageSize, setImageSize] = useState(null); // { width, height } natural
  const [zoom, setZoom] = useState(1);               // 1 = la imagen entra justo en el marco
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  // Ref para tracking acumulativo del pan
  const offsetRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });

  // Obtener dimensiones naturales de la imagen
  useEffect(() => {
    if (imageUri && visible) {
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      offsetRef.current = { x: 0, y: 0 };
      setError(null);
      Image.getSize(
        imageUri,
        (w, h) => setImageSize({ width: w, height: h }),
        () => setError('No se pudo leer la imagen')
      );
    }
  }, [imageUri, visible]);

  // Scale base: la imagen entra justo con su lado más corto ocupando el marco
  const baseScale = imageSize
    ? CROP_SIZE / Math.min(imageSize.width, imageSize.height)
    : 1;

  const effectiveScale = baseScale * zoom;

  // Dimensiones en pantalla de la imagen
  const imgW = imageSize ? imageSize.width * effectiveScale : CROP_SIZE;
  const imgH = imageSize ? imageSize.height * effectiveScale : CROP_SIZE;

  // Posición centrada + offset del usuario
  const imgX = -(imgW - CROP_SIZE) / 2 + offset.x;
  const imgY = -(imgH - CROP_SIZE) / 2 + offset.y;

  // PanResponder para arrastrar la imagen
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2,
      onPanResponderGrant: () => {
        panStartRef.current = { ...offsetRef.current };
      },
      onPanResponderMove: (_, { dx, dy }) => {
        const newX = panStartRef.current.x + dx;
        const newY = panStartRef.current.y + dy;
        setOffset({ x: newX, y: newY });
      },
      onPanResponderRelease: (_, { dx, dy }) => {
        offsetRef.current.x += dx;
        offsetRef.current.y += dy;
      },
    })
  ).current;

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.25));

  const handleConfirm = async () => {
    if (!imageSize) return;
    setProcessing(true);
    try {
      // Calcular el rectángulo de recorte en coordenadas de la imagen original
      const cropOriginX = (-CROP_SIZE / 2 - offset.x + imageSize.width * effectiveScale / 2) / effectiveScale;
      const cropOriginY = (-CROP_SIZE / 2 - offset.y + imageSize.height * effectiveScale / 2) / effectiveScale;
      const cropW = CROP_SIZE / effectiveScale;
      const cropH = CROP_SIZE / effectiveScale;

      // Clamp para no salirnos de la imagen
      const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
      const clampedX = clamp(cropOriginX, 0, imageSize.width - cropW);
      const clampedY = clamp(cropOriginY, 0, imageSize.height - cropH);
      const clampedW = clamp(cropW, 1, imageSize.width - clampedX);
      const clampedH = clamp(cropH, 1, imageSize.height - clampedY);

      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          { crop: { originX: Math.round(clampedX), originY: Math.round(clampedY), width: Math.round(clampedW), height: Math.round(clampedH) } },
          { resize: { width: 512, height: 512 } },
        ],
        { format: ImageManipulator.SaveFormat.PNG }
      );
      onCrop(result.uri);
    } catch (e) {
      setError('Error al recortar: ' + e.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: S(12),
          paddingHorizontal: S(20),
        }}>
          <TouchableOpacity onPress={onCancel} disabled={processing}>
            <Text style={{ fontSize: FS(16), color: COLORS.white, fontWeight: '500' }}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: FS(17), color: COLORS.white, fontWeight: '600' }}>Ajustá el recorte</Text>
          <TouchableOpacity onPress={handleConfirm} disabled={processing}>
            {processing ? (
              <ActivityIndicator size="small" color={COLORS.gold} />
            ) : (
              <Text style={{ fontSize: FS(16), color: COLORS.gold, fontWeight: '700' }}>Aplicar</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Crop area */}
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          {error ? (
            <View style={{ alignItems: 'center', paddingHorizontal: S(24) }}>
              <Ionicons name="image-outline" size={S(48)} color="#666" />
              <Text style={{ color: '#ff6b6b', fontSize: FS(14), marginTop: S(12), textAlign: 'center' }}>{error}</Text>
            </View>
          ) : (
            <View style={{ width: CROP_SIZE, height: CROP_SIZE, overflow: 'hidden', borderRadius: S(8) }}>
              <Image
                source={{ uri: imageUri }}
                style={{
                  width: imgW,
                  height: imgH,
                  position: 'absolute',
                  left: imgX,
                  top: imgY,
                }}
                {...panResponder.panHandlers}
              />
              {/* Marco visual */}
              <View style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                borderWidth: 2, borderColor: COLORS.gold, borderRadius: S(8),
              }} pointerEvents="none" />
              {/* Esquinas decorativas */}
              <View style={{ position: 'absolute', top: -1, left: -1, width: S(24), height: S(24), borderTopWidth: 3, borderLeftWidth: 3, borderColor: COLORS.white }} pointerEvents="none" />
              <View style={{ position: 'absolute', top: -1, right: -1, width: S(24), height: S(24), borderTopWidth: 3, borderRightWidth: 3, borderColor: COLORS.white }} pointerEvents="none" />
              <View style={{ position: 'absolute', bottom: -1, left: -1, width: S(24), height: S(24), borderBottomWidth: 3, borderLeftWidth: 3, borderColor: COLORS.white }} pointerEvents="none" />
              <View style={{ position: 'absolute', bottom: -1, right: -1, width: S(24), height: S(24), borderBottomWidth: 3, borderRightWidth: 3, borderColor: COLORS.white }} pointerEvents="none" />
            </View>
          )}
        </View>

        {/* Zoom controls */}
        <View style={{
          flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
          paddingVertical: S(24), gap: S(24), paddingBottom: Platform.OS === 'ios' ? 40 : 24,
        }}>
          <TouchableOpacity onPress={handleZoomOut} disabled={zoom <= 0.25 || processing}
            style={{ opacity: zoom <= 0.25 ? 0.4 : 1 }}>
            <Ionicons name="remove-circle-outline" size={S(36)} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={{ color: COLORS.white, fontSize: FS(18), fontWeight: '600', minWidth: S(50), textAlign: 'center' }}>
            {zoom.toFixed(2)}x
          </Text>
          <TouchableOpacity onPress={handleZoomIn} disabled={zoom >= 3 || processing}
            style={{ opacity: zoom >= 3 ? 0.4 : 1 }}>
            <Ionicons name="add-circle-outline" size={S(36)} color={COLORS.white} />
          </TouchableOpacity>
          {/* Reset */}
          <TouchableOpacity
            onPress={() => { setZoom(1); setOffset({ x: 0, y: 0 }); offsetRef.current = { x: 0, y: 0 }; }}
            style={{ marginLeft: S(16) }}
            disabled={processing}
          >
            <Ionicons name="refresh-outline" size={S(26)} color={COLORS.gold} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
