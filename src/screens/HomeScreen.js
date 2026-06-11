/**
 * HomeScreen — Dashboard responsive con ScreenWrapper
 * ====================================================
 * El wrapper global maneja SafeArea, scroll, padding,
 * background y pull-to-refresh. El screen solo tiene
 * la lógica y el layout interno.
 */

import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { getClothingItems } from '../services/clothingService';
import { COLORS } from '../constants/theme';
import { useAppScale } from '../utils/responsive';
import ScreenWrapper from '../components/ScreenWrapper';

export default function HomeScreen() {
  const { scale, fontScale } = useAppScale();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadItems = async () => {
    try { const data = await getClothingItems(user.id); setItems(data); } catch (_) {}
  };
  const onRefresh = async () => { setRefreshing(true); await loadItems(); setRefreshing(false); };
  useEffect(() => { loadItems(); }, []);

  const categories = [...new Set(items.map((i) => i.category))];
  const displayName = user?.email?.split('@')[0] || 'Usuario';

  const s = (n) => scale(n);
  const fs = (n) => fontScale(n);

  return (
    <ScreenWrapper scrollable refreshing={refreshing} onRefresh={onRefresh}>
      {/* Título */}
      <Text style={{ fontSize: fs(26), fontWeight: '700', color: COLORS.primary, marginTop: s(8), marginBottom: s(2) }}>
        Hola, {displayName}
      </Text>
      <Text style={{ fontSize: fs(14), color: COLORS.textLight, marginBottom: s(24) }}>
        Tu guardarropas al día
      </Text>

      {/* Stats — flex: 1 con gap proporcional */}
      <View style={{ flexDirection: 'row', gap: s(10), marginBottom: s(24) }}>
        {[
          { icon: 'shirt-outline', number: items.length, label: 'Prendas', color: COLORS.primary },
          { icon: 'layers-outline', number: categories.length, label: 'Categorías', color: COLORS.secondary },
          { icon: 'sparkles-outline', number: 0, label: 'Outfits', color: COLORS.gold },
        ].map((stat, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              backgroundColor: COLORS.white,
              borderRadius: s(12),
              paddingVertical: s(16),
              paddingHorizontal: s(8),
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: s(2) },
              shadowOpacity: 0.05,
              shadowRadius: s(4),
              elevation: 2,
            }}
          >
            <Ionicons name={stat.icon} size={fs(24)} color={stat.color} />
            <Text style={{ fontSize: fs(20), fontWeight: '700', color: '#1A1A1A', marginTop: s(6) }}>
              {stat.number}
            </Text>
            <Text
              style={{
                fontSize: fs(11),
                color: COLORS.textLight,
                marginTop: s(2),
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                textAlign: 'center',
              }}
            >
              {stat.label}
            </Text>
          </View>
        ))}
      </View>

      {/* Tip card */}
      <View
        style={{
          backgroundColor: COLORS.white,
          borderRadius: s(16),
          padding: s(16),
          marginBottom: s(24),
          borderWidth: 1,
          borderColor: '#E8E0D6',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), marginBottom: s(4) }}>
          <Ionicons name="bulb-outline" size={fs(16)} color={COLORS.gold} />
          <Text style={{ fontSize: fs(14), fontWeight: '600', color: '#1A1A1A' }}>Consejo</Text>
        </View>
        <Text style={{ fontSize: fs(13), color: COLORS.textLight, lineHeight: fs(20) }}>
          {items.length === 0
            ? 'Agregá tus primeras prendas desde la sección Wardrobe para empezar a armar outfits.'
            : `Ya tenés ${items.length} prendas. Seguí sumando para crear combinaciones únicas.`}
        </Text>
      </View>

      {/* Últimas prendas */}
      {items.length > 0 && (
        <>
          <Text style={{ fontSize: fs(17), fontWeight: '600', color: '#1A1A1A', marginBottom: s(12) }}>
            Últimas agregadas
          </Text>
          {items.slice(0, 6).map((item) => (
            <View
              key={item.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: s(14),
                backgroundColor: COLORS.white,
                borderRadius: s(12),
                padding: s(14),
                marginBottom: s(8),
                shadowColor: '#000',
                shadowOffset: { width: 0, height: s(1) },
                shadowOpacity: 0.04,
                shadowRadius: s(3),
                elevation: 1,
              }}
            >
              <View
                style={{
                  width: s(36),
                  height: s(36),
                  borderRadius: s(8),
                  backgroundColor: item.color || '#E8E0D6',
                  borderWidth: 1,
                  borderColor: '#E8E0D6',
                }}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: fs(14), fontWeight: '600', color: '#1A1A1A' }}>
                  {item.category}
                </Text>
                {item.season && item.season !== 'Todas' && (
                  <Text
                    style={{
                      fontSize: fs(11),
                      color: COLORS.textLight,
                      marginTop: s(2),
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    {item.season}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </>
      )}
    </ScreenWrapper>
  );
}
