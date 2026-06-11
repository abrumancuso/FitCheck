/**
 * OutfitPreview.js — Lienzo de capas para combinación de prendas
 * ===============================================================
 * Muestra las prendas seleccionadas en un lienzo blanco,
 * ordenadas por profundidad (zIndex):
 *   1. Calzado
 *   2. Prendas inferiores
 *   3. Prendas superiores
 *   4. Abrigos
 *   5. Accesorios
 *
 * La prenda seleccionada se puede ARRASTRAR directamente
 * sobre el canvas para posicionarla.
 *
 * Props:
 *   items                — clothing items seleccionados
 *   itemSettings         — { [id]: { scale, offsetX, offsetY } }
 *   onSelectItem         — (id) => void
 *   selectedItemId       — id del item seleccionado
 *   onChangeItemSettings — (itemId, newSettings) => void
 *   canvasWidth          — ancho del canvas en px
 */

import { useMemo, useRef } from 'react';
import { View, Image, TouchableOpacity, Text, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { useAppScale } from '../utils/responsive';

// ─── Constantes ─────────────────────────────────────────────────

export const CATEGORY_DEPTH = {
  Zapatos: 1,
  Pantalón: 2, Short: 2, Falda: 2, Pollera: 2,
  Remera: 3, Camisa: 3, Blusa: 3, Buzo: 3, Sweater: 3, Vestido: 3,
  Campera: 4, Abrigo: 4, Blazer: 4,
  Cartera: 5, Accesorio: 5,
};

/** Tamaño natural del contenedor de cada categoría (proporcional al canvas) */
export function getItemSize(category, cw, ch) {
  const SIZES = {
    Zapatos:   { w: 0.16, h: 0.08 },
    Pantalón:  { w: 0.18, h: 0.22 },
    Short:     { w: 0.18, h: 0.12 },
    Falda:     { w: 0.20, h: 0.16 },
    Pollera:   { w: 0.20, h: 0.16 },
    Vestido:   { w: 0.22, h: 0.32 },
    Remera:    { w: 0.20, h: 0.18 },
    Camisa:    { w: 0.20, h: 0.20 },
    Blusa:     { w: 0.20, h: 0.18 },
    Buzo:      { w: 0.22, h: 0.20 },
    Sweater:   { w: 0.22, h: 0.20 },
    Campera:   { w: 0.24, h: 0.22 },
    Abrigo:    { w: 0.24, h: 0.22 },
    Blazer:    { w: 0.22, h: 0.20 },
    Cartera:   { w: 0.12, h: 0.14 },
    Accesorio: { w: 0.10, h: 0.10 },
  };
  const s = SIZES[category] || { w: 0.18, h: 0.18 };
  return { width: cw * s.w, height: ch * s.h };
}

/**
 * getInitialPosition — calcula posición y escala inicial de una prenda
 * según su categoría, para que aparezca sobre la zona del cuerpo correcta.
 *
 * Los valores de offset son RELATIVOS al centro del canvas (cx, cy)
 * y se expresan en píxeles (proporcionales al canvas).
 */
export function getInitialPosition(category, canvasWidth) {
  const CH = canvasWidth / (3 / 4); // canvas height

  // Proporciones de offset respecto a (cx, cy), en múltiplos de canvasHeight
  // Anatomía del avatar:
  //   cy = 0.40*CH (centro del torso)
  //   bodyTop = 0.29*CH, bodyBottom = 0.51*CH
  //   legStart = 0.50*CH, footY ≈ 0.66*CH
  const POS = {
    // Calzado — pies
    Zapatos:   { offsetY:  0.26 * CH,         scale: 1.0 },
    // Inferiores — cintura/caderas
    Pantalón:  { offsetY:  0.10 * CH,         scale: 1.0 },
    Short:     { offsetY:  0.10 * CH,         scale: 1.0 },
    Falda:     { offsetY:  0.10 * CH,         scale: 1.0 },
    Pollera:   { offsetY:  0.10 * CH,         scale: 1.0 },
    // Vestido — torso completo centrado
    Vestido:   { offsetY:  0.02 * CH,         scale: 1.0 },
    // Superiores — torso superior
    Remera:    { offsetY: -0.03 * CH,         scale: 1.0 },
    Camisa:    { offsetY: -0.03 * CH,         scale: 1.0 },
    Blusa:     { offsetY: -0.03 * CH,         scale: 1.0 },
    Buzo:      { offsetY: -0.03 * CH,         scale: 1.0 },
    Sweater:   { offsetY: -0.03 * CH,         scale: 1.0 },
    // Abrigos — apenas debajo de las remeras
    Campera:   { offsetY: -0.01 * CH,         scale: 1.0 },
    Abrigo:    { offsetY: -0.01 * CH,         scale: 1.0 },
    Blazer:    { offsetY: -0.01 * CH,         scale: 1.0 },
    // Accesorios
    Cartera:   { offsetX:  0.18 * canvasWidth, offsetY:  0.05 * CH, scale: 1.0 },
    Accesorio: { offsetY: -0.18 * CH,         scale: 1.0 },
  };

  return POS[category] || { offsetX: 0, offsetY: 0, scale: 1.0 };
}

// ─── Sub-componente: capa de prenda arrastrable ────────────────

function DraggableLayer({
  item, settings, depth, isSelected,
  naturalWidth, naturalHeight, cx, cy, S, fs,
  onSelect, onChangeSettings,
}) {
  // Refs para evitar closures stale en PanResponder
  const isSelectedRef = useRef(isSelected);
  isSelectedRef.current = isSelected;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onChangeRef = useRef(onChangeSettings);
  onChangeRef.current = onChangeSettings;
  const itemIdRef = useRef(item?.id);
  itemIdRef.current = item?.id;

  const locked = settings?.locked === true;

  // Ref para offset inicial al empezar a arrastrar
  const dragStart = useRef({ offsetX: 0, offsetY: 0 });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isSelectedRef.current && !locked,
      onMoveShouldSetPanResponder: (_, g) =>
        isSelectedRef.current && !locked && (Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3),
      // No soltar el gesto aunque el ScrollView padre quiera robarlo
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        const s = settingsRef.current;
        dragStart.current = {
          offsetX: s.offsetX,
          offsetY: s.offsetY,
        };
      },
      onPanResponderMove: (_, { dx, dy }) => {
        if (!isSelectedRef.current || locked) return;
        const s = settingsRef.current;
        onChangeRef.current?.(itemIdRef.current, {
          ...s,
          offsetX: dragStart.current.offsetX + dx,
          offsetY: dragStart.current.offsetY + dy,
        });
      },
      onPanResponderRelease: (_, { dx, dy }) => {
        if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
          onSelectRef.current?.(isSelectedRef.current ? null : itemIdRef.current);
        }
      },
    })
  ).current;

  const itemW = naturalWidth * settings.scale;
  const itemH = naturalHeight * settings.scale;

  return (
    <View
      {...(isSelected ? panResponder.panHandlers : {})}
      style={{
        position: 'absolute',
        left: cx + settings.offsetX - itemW / 2,
        top: cy + settings.offsetY - itemH / 2,
        width: itemW,
        height: itemH,
        zIndex: depth,
        elevation: depth,
      }}
    >
      {/* Locked: se toca para editar */}
      {locked && (
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={0.8}
          onPress={() => onSelect?.(item.id)}
        >
          <ItemContent item={item} isSelected={false} S={S} fs={fs} />
        </TouchableOpacity>
      )}

      {/* Desbloqueado y seleccionado: arrastrable */}
      {!locked && isSelected && (
        <ItemContent item={item} isSelected S={S} fs={fs} />
      )}

      {/* Desbloqueado y NO seleccionado: se toca para seleccionar */}
      {!locked && !isSelected && (
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={0.8}
          onPress={() => onSelect?.(item.id)}
        >
          <ItemContent item={item} isSelected={false} S={S} fs={fs} />
        </TouchableOpacity>
      )}

      {/* Badge: locked o Z */}
      {locked && (
        <View style={{
          position: 'absolute', bottom: -S(4), right: -S(4),
          backgroundColor: COLORS.textLight, borderRadius: S(4),
          paddingHorizontal: S(5), paddingVertical: S(2),
        }}>
          <Ionicons name="lock-closed" size={fs(10)} color="#fff" />
        </View>
      )}

      {!locked && isSelected && (
        <View style={{
          position: 'absolute', top: -S(10), right: -S(4),
          backgroundColor: COLORS.gold, borderRadius: S(4),
          paddingHorizontal: S(6), paddingVertical: S(2),
        }}>
          <Text style={{ fontSize: fs(10), color: '#fff', fontWeight: '700' }}>Z{depth}</Text>
        </View>
      )}
    </View>
  );
}

// Contenido interno del item (imagen o fallback)
function ItemContent({ item, isSelected, S, fs }) {
  return (
    <View style={{
      flex: 1,
      borderRadius: S(8),
      overflow: 'hidden',
      borderWidth: isSelected ? 2.5 : 0,
      borderColor: isSelected ? COLORS.gold : 'transparent',
      backgroundColor: 'transparent',
    }}>
      {item.imageUrl || item.image_url ? (
        <Image
          source={{ uri: item.imageUrl || item.image_url }}
          style={{ width: '100%', height: '100%', resizeMode: 'contain' }}
        />
      ) : (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#E8E0D6' }}>
          <Ionicons name="shirt-outline" size={S(22)} color={COLORS.white} />
        </View>
      )}
    </View>
  );
}

// ─── Componente principal ──────────────────────────────────────

export default function OutfitPreview({
  items, itemSettings, onSelectItem, selectedItemId,
  onChangeItemSettings, canvasWidth,
}) {
  const { scale: s, fontScale: fs } = useAppScale();
  const S = (n) => s(n);

  const ASPECT = 3 / 4;
  const canvasHeight = canvasWidth / ASPECT;

  const sortedItems = useMemo(() =>
    [...items]
      .map((item) => ({ ...item, depth: CATEGORY_DEPTH[item.category] || 3 }))
      .sort((a, b) => a.depth - b.depth),
    [items]
  );

  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;

  return (
    <View style={{ alignItems: 'center' }}>
      {/* Canvas */}
      <View style={{
        width: canvasWidth, height: canvasHeight,
        backgroundColor: COLORS.white,
        borderRadius: S(16), overflow: 'hidden',
        borderWidth: 1, borderColor: COLORS.border,
        shadowColor: '#000', shadowOffset: { width: 0, height: S(2) },
        shadowOpacity: 0.06, shadowRadius: S(8), elevation: 3,
      }}>
        {/* Lienzo blanco — el usuario arrastra las prendas y ve cómo combinan */}

        {items.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: S(24) }}>
            <Ionicons name="layers-outline" size={S(40)} color="#E8E0D6" />
            <Text style={{ fontSize: fs(13), color: COLORS.textLight, marginTop: S(12), textAlign: 'center' }}>
              Seleccioná prendas abajo para ver cómo quedan
            </Text>
          </View>
        ) : (
          sortedItems.map((item) => {
            const settings = itemSettings[item.id] || { scale: 1, offsetX: 0, offsetY: 0 };
            const natural = getItemSize(item.category, canvasWidth, canvasHeight);
            return (
              <DraggableLayer
                key={item.id}
                item={item}
                settings={settings}
                naturalWidth={natural.width}
                naturalHeight={natural.height}
                depth={CATEGORY_DEPTH[item.category] || 3}
                isSelected={selectedItemId === item.id}
                cx={cx}
                cy={cy}
                S={S}
                fs={fs}
                onSelect={onSelectItem}
                onChangeSettings={onChangeItemSettings}
              />
            );
          })
        )}
      </View>
    </View>
  );
}
