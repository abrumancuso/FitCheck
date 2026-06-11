/**
 * HomeScreen — Dashboard + Outfit del Día
 * ========================================
 */

import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { getClothingItems } from '../services/clothingService';
import { COLORS } from '../constants/theme';
import { useAppScale } from '../utils/responsive';
import ScreenWrapper from '../components/ScreenWrapper';

// ── Categorías para armado de outfits ─────────────────────────

const TOPS = ['Remera', 'Camisa', 'Blusa', 'Buzo', 'Sweater', 'Campera', 'Abrigo', 'Blazer'];
const BOTTOMS = ['Pantalón', 'Short', 'Falda', 'Pollera'];
const SHOES = ['Zapatos', 'Zapatillas'];
const ALL_OUTFIT_CATS = [...TOPS, ...BOTTOMS, ...SHOES];

function pickRandom(arr) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateOutfit(items) {
  const tops = items.filter((i) => TOPS.includes(i.category));
  const bottoms = items.filter((i) => BOTTOMS.includes(i.category));
  const shoes = items.filter((i) => SHOES.includes(i.category));

  return {
    top: pickRandom(tops),
    bottom: pickRandom(bottoms),
    shoes: pickRandom(shoes),
  };
}

// ── Screen ────────────────────────────────────────────────────

export default function HomeScreen() {
  const { scale, fontScale } = useAppScale();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [outfit, setOutfit] = useState(null);

  const loadItems = async () => {
    try {
      const data = await getClothingItems(user.id);
      setItems(data);
    } catch (_) {}
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadItems();
    setRefreshing(false);
  };

  useEffect(() => {
    loadItems();
  }, []);

  // Regenerar outfit cuando cambian las prendas
  useEffect(() => {
    if (items.length > 0) {
      setOutfit(generateOutfit(items));
    }
  }, [items]);

  const handleRefreshOutfit = () => {
    setOutfit(generateOutfit(items));
  };

  const handleShare = async () => {
    const parts = [];
    if (outfit?.top) parts.push(`- ${outfit.top.category}`);
    if (outfit?.bottom) parts.push(`- ${outfit.bottom.category}`);
    if (outfit?.shoes) parts.push(`- ${outfit.shoes.category}`);

    try {
      await Share.share({
        message: parts.length > 0
          ? `Mi Look FitCheck:\n${parts.join('\n')}`
          : 'Armá tus outfits con FitCheck!',
        title: 'FitCheck',
      });
    } catch (e) {
      if (e?.message !== 'User did not share') {
        console.warn('[Share error]', e.message);
      }
    }
  };

  const categories = [...new Set(items.map((i) => i.category))];
  const displayName = user?.email?.split('@')[0] || 'Usuario';

  const S = (n) => scale(n);
  const FS = (n) => fontScale(n);

  // ── Render ──────────────────────────────────────────────────

  return (
    <ScreenWrapper scrollable refreshing={refreshing} onRefresh={onRefresh}>
      {/* Título */}
      <Text
        style={{
          fontSize: FS(26),
          fontWeight: '700',
          color: COLORS.primary,
          marginTop: S(8),
          marginBottom: S(2),
        }}
      >
        Hola, {displayName}
      </Text>
      <Text style={{ fontSize: FS(14), color: COLORS.textLight, marginBottom: S(24) }}>
        Tu guardarropas al dia
      </Text>

      {/* Stats */}
      <View style={{ flexDirection: 'row', gap: S(10), marginBottom: S(24) }}>
        {[
          { icon: 'shirt-outline', number: items.length, label: 'Prendas', color: COLORS.primary },
          { icon: 'layers-outline', number: categories.length, label: 'Categorias', color: COLORS.secondary },
          { icon: 'sparkles-outline', number: 0, label: 'Outfits', color: COLORS.gold },
        ].map((stat, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              backgroundColor: COLORS.white,
              borderRadius: S(12),
              paddingVertical: S(16),
              paddingHorizontal: S(8),
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: S(2) },
              shadowOpacity: 0.05,
              shadowRadius: S(4),
              elevation: 2,
            }}
          >
            <Ionicons name={stat.icon} size={FS(24)} color={stat.color} />
            <Text
              style={{
                fontSize: FS(20),
                fontWeight: '700',
                color: '#1A1A1A',
                marginTop: S(6),
              }}
            >
              {stat.number}
            </Text>
            <Text
              style={{
                fontSize: FS(11),
                color: COLORS.textLight,
                marginTop: S(2),
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

      {/* ─── Outfit del Dia ─────────────────────────────── */}

      {items.length > 0 && outfit ? (
        <View style={{ marginBottom: S(24) }}>
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: S(12),
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S(6) }}>
              <Ionicons name="sparkles" size={FS(18)} color={COLORS.gold} />
              <Text style={{ fontSize: FS(18), fontWeight: '700', color: '#1A1A1A' }}>
                Outfit del Dia
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleRefreshOutfit}
              style={{
                padding: S(6),
                borderRadius: S(8),
                backgroundColor: '#F5F0EB',
              }}
            >
              <Ionicons name="refresh" size={FS(18)} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          {/* Card */}
          <View
              style={{
                backgroundColor: COLORS.white,
                borderRadius: S(16),
                padding: S(16),
                shadowColor: '#000',
                shadowOffset: { width: 0, height: S(4) },
                shadowOpacity: 0.08,
                shadowRadius: S(12),
                elevation: 4,
              }}
            >
              {/* Items */}
              <View style={{ gap: S(10) }}>
                {outfit.top && (
                  <OutfitItemRow
                    item={outfit.top}
                    icon="shirt-outline"
                    label="Arriba"
                    S={S}
                    FS={FS}
                  />
                )}
                {outfit.bottom && (
                  <OutfitItemRow
                    item={outfit.bottom}
                    icon="shirt-outline"
                    label="Abajo"
                    S={S}
                    FS={FS}
                  />
                )}
                {outfit.shoes && (
                  <OutfitItemRow
                    item={outfit.shoes}
                    icon="footsteps-outline"
                    label="Calzado"
                    S={S}
                    FS={FS}
                  />
                )}
              </View>

              {/* Footer */}
              <View
                style={{
                  marginTop: S(16),
                  paddingTop: S(12),
                  borderTopWidth: 1,
                  borderTopColor: '#F0EAE2',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: FS(11), color: COLORS.textLight, letterSpacing: 1, textTransform: 'uppercase' }}>
                  FitCheck
                </Text>
              </View>
            </View>

          {/* Share */}
          <TouchableOpacity
            onPress={handleShare}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: S(6),
              marginTop: S(12),
              paddingVertical: S(10),
              borderRadius: S(10),
              backgroundColor: COLORS.primary,
            }}
          >
            <Ionicons name="share-outline" size={FS(16)} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: FS(14) }}>
              Compartir look
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Tip card */}
      <View
        style={{
          backgroundColor: COLORS.white,
          borderRadius: S(16),
          padding: S(16),
          marginBottom: S(24),
          borderWidth: 1,
          borderColor: '#E8E0D6',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S(6), marginBottom: S(4) }}>
          <Ionicons name="bulb-outline" size={FS(16)} color={COLORS.gold} />
          <Text style={{ fontSize: FS(14), fontWeight: '600', color: '#1A1A1A' }}>Consejo</Text>
        </View>
        <Text style={{ fontSize: FS(13), color: COLORS.textLight, lineHeight: FS(20) }}>
          {items.length === 0
            ? 'Agrega tus primeras prendas desde la seccion Armario para empezar a armar outfits.'
            : `Ya tenes ${items.length} prendas. Segui sumando para crear combinaciones unicas.`}
        </Text>
      </View>

      {/* Ultimas prendas */}
      {items.length > 0 && (
        <>
          <Text style={{ fontSize: FS(17), fontWeight: '600', color: '#1A1A1A', marginBottom: S(12) }}>
            Ultimas agregadas
          </Text>
          {items.slice(0, 6).map((item) => (
            <View
              key={item.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: S(14),
                backgroundColor: COLORS.white,
                borderRadius: S(12),
                padding: S(14),
                marginBottom: S(8),
                shadowColor: '#000',
                shadowOffset: { width: 0, height: S(1) },
                shadowOpacity: 0.04,
                shadowRadius: S(3),
                elevation: 1,
              }}
            >
              <View
                style={{
                  width: S(36),
                  height: S(36),
                  borderRadius: S(8),
                  backgroundColor: item.color || '#E8E0D6',
                  borderWidth: 1,
                  borderColor: '#E8E0D6',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                {item.imageUrl ? null : (
                  <Ionicons name="shirt-outline" size={S(18)} color="#FFFFFF" style={{ opacity: 0.5 }} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: FS(14), fontWeight: '600', color: '#1A1A1A' }}>
                  {item.category}
                </Text>
                {item.season && item.season !== 'Todas' && (
                  <Text
                    style={{
                      fontSize: FS(11),
                      color: COLORS.textLight,
                      marginTop: S(2),
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

// ── Fila de item de outfit ────────────────────────────────────

function OutfitItemRow({ item, icon, label, S, FS }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: S(12),
        backgroundColor: '#FAF7F2',
        borderRadius: S(10),
        padding: S(10),
      }}
    >
      {/* Thumbnail */}
      <View
        style={{
          width: S(44),
          height: S(44),
          borderRadius: S(8),
          backgroundColor: item.color || '#E8E0D6',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
        }}
      >
        {(item.imageUrl || item.image_url) ? (
          <View style={{ width: '100%', height: '100%', backgroundColor: item.color || '#E8E0D6' }}>
            {/* Image would go here if we had it */}
          </View>
        ) : (
          <Ionicons name={icon} size={S(20)} color="#FFFFFF" style={{ opacity: 0.6 }} />
        )}
      </View>

      {/* Info */}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: FS(11), color: COLORS.textLight, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </Text>
        <Text style={{ fontSize: FS(14), fontWeight: '600', color: '#1A1A1A' }}>
          {item.category}
        </Text>
      </View>

      <Ionicons name="checkmark-circle" size={FS(18)} color={COLORS.secondary} />
    </View>
  );
}
