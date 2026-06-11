/**
 * ItemLayerControls.js — Controles de capa (escala + OK/Editar)
 * ==============================================================
 * Ajustes de escala para una prenda seleccionada en el lienzo.
 * La posición se ajusta ARRASTRANDO directamente sobre el canvas.
 * Botón "Listo" para fijar la posición, "Editar" para reajustar.
 *
 * Props:
 *   item        — clothing item (para mostrar nombre/categoría)
 *   settings    — { scale, offsetX, offsetY, locked }
 *   onChange    — (newSettings) => void
 *   onRemove    — () => void (elimina la prenda del outfit)
 */

import { View, Text, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { useAppScale } from '../utils/responsive';

export default function ItemLayerControls({ item, settings, onChange, onRemove }) {
  const { scale: s, fontScale: fs } = useAppScale();
  const S = (n) => s(n);
  const FS = (n) => fs(n);

  if (!item) return null;

  const { scale = 1, locked = false } = settings || {};

  const clampScale = (val) => Math.max(0.3, Math.min(3, val));

  const adjustScale = (delta) => {
    const newScale = clampScale(scale + delta);
    onChange?.({ ...settings, scale: newScale });
  };

  return (
    <View style={{
      backgroundColor: COLORS.white,
      borderRadius: S(12),
      padding: S(12),
      borderWidth: 1,
      borderColor: COLORS.border,
      marginTop: S(8),
    }}>
      {/* Header: nombre del item + reset */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: S(10) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S(6) }}>
          <View style={{
            width: S(8), height: S(8), borderRadius: S(4),
            backgroundColor: item.color || COLORS.primary,
          }} />
          <Text style={{ fontSize: FS(13), fontWeight: '600', color: COLORS.text }} numberOfLines={1}>
            {item.category}
          </Text>
          {locked && (
            <Ionicons name="lock-closed" size={FS(11)} color={COLORS.textLight} />
          )}
        </View>
        <TouchableOpacity
          onPress={() => onChange?.({ scale: 1, offsetX: 0, offsetY: 0, locked: false })}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S(4) }}>
            <Ionicons name="refresh-outline" size={FS(14)} color={COLORS.textLight} />
            <Text style={{ fontSize: FS(11), color: COLORS.textLight }}>Reset</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ESCALA (solo editable si no está locked) */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: FS(12), color: COLORS.textLight, width: S(50) }}>Escala</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S(8) }}>
          <TouchableOpacity
            onPress={() => adjustScale(-0.1)}
            disabled={locked}
          >
            <Ionicons
              name="remove-circle-outline"
              size={FS(22)}
              color={locked ? COLORS.border : COLORS.primary}
            />
          </TouchableOpacity>
          <Text style={{ fontSize: FS(16), fontWeight: '700', color: COLORS.text, minWidth: S(40), textAlign: 'center' }}>
            {scale.toFixed(1)}x
          </Text>
          <TouchableOpacity
            onPress={() => adjustScale(0.1)}
            disabled={locked}
          >
            <Ionicons
              name="add-circle-outline"
              size={FS(22)}
              color={locked ? COLORS.border : COLORS.primary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Prueba virtual con IA — abre Hugging Face en el navegador */}
      <TouchableOpacity
        style={{
          marginTop: S(8),
          backgroundColor: '#F5F0FF',
          borderRadius: S(8),
          paddingVertical: S(9),
          alignItems: 'center',
          borderWidth: 1,
          borderColor: '#D8CFF0',
        }}
        onPress={() => Linking.openURL('https://yisol-idm-vton.hf.space')}
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S(6) }}>
          <Ionicons name="sparkles" size={FS(14)} color="#6B4FA0" />
          <Text style={{ fontSize: FS(13), fontWeight: '600', color: '#6B4FA0' }}>
            Probar con IA
          </Text>
        </View>
      </TouchableOpacity>

      {/* Botón eliminar */}
      {onRemove && (
        <TouchableOpacity
          style={{
            marginTop: S(8),
            backgroundColor: '#FFF0F0',
            borderRadius: S(8),
            paddingVertical: S(8),
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#FFD0D0',
          }}
          onPress={onRemove}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S(6) }}>
            <Ionicons name="trash-outline" size={FS(15)} color="#E05050" />
            <Text style={{ fontSize: FS(13), fontWeight: '500', color: '#E05050' }}>
              Quitar del outfit
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Botón OK / Editar */}
      <TouchableOpacity
        style={{
          marginTop: S(10),
          backgroundColor: locked ? COLORS.background : COLORS.primary,
          borderRadius: S(8),
          paddingVertical: S(10),
          alignItems: 'center',
          borderWidth: locked ? 1 : 0,
          borderColor: locked ? COLORS.border : 'transparent',
        }}
        onPress={() => {
          if (locked) {
            // Desbloquear para editar
            onChange?.({ ...settings, locked: false });
          } else {
            // Fijar posición
            onChange?.({ ...settings, locked: true });
          }
        }}
        activeOpacity={0.8}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S(6) }}>
          <Ionicons
            name={locked ? 'pencil-outline' : 'checkmark-circle-outline'}
            size={FS(16)}
            color={locked ? COLORS.primary : '#fff'}
          />
          <Text style={{
            fontSize: FS(14),
            fontWeight: '600',
            color: locked ? COLORS.primary : '#fff',
          }}>
            {locked ? 'Editar' : '✓ Listo'}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Hint de arrastre (solo cuando no está locked) */}
      {!locked && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S(4), marginTop: S(8) }}>
          <Ionicons name="move-outline" size={FS(11)} color={COLORS.textLight} />
          <Text style={{ fontSize: FS(10), color: COLORS.textLight }}>
            Arrastrá la prenda en el canvas para posicionarla
          </Text>
        </View>
      )}
    </View>
  );
}
