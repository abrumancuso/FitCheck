/**
 * WardrobeScreen — Grid responsive con diseño premium
 * ====================================================
 */

import { useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import {
  getClothingItems,
  deleteClothingItem,
  CATEGORIES,
  SEASONS,
  COLORS_LIST,
} from '../services/clothingService';
import { COLORS } from '../constants/theme';
import { useAppScale } from '../utils/responsive';
import ScreenWrapper from '../components/ScreenWrapper';
import { impact } from '../utils/haptics';

// ── Iconos por categoría ──────────────────────────────────────

const CATEGORY_ICONS = {
  Remera: 'shirt-outline',
  Camisa: 'shirt-outline',
  Blusa: 'shirt-outline',
  Buzo: 'shirt-outline',
  Sweater: 'shirt-outline',
  Campera: 'shirt-outline',
  Abrigo: 'shirt-outline',
  Blazer: 'shirt-outline',
  Pantalón: 'shirt-outline',
  Short: 'shirt-outline',
  Falda: 'shirt-outline',
  Pollera: 'shirt-outline',
  Vestido: 'shirt-outline',
  Zapatos: 'footsteps-outline',
  Zapatillas: 'footsteps-outline',
  Accesorio: 'diamond-outline',
  Bufanda: 'shirt-outline',
  Gorro: 'shirt-outline',
  Otro: 'shirt-outline',
};

const getIcon = (cat) => CATEGORY_ICONS[cat] || 'shirt-outline';

// ── Screen ────────────────────────────────────────────────────

export default function WardrobeScreen({ navigation }) {
  const { scale, fontScale, verticalScale, width } = useAppScale();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedSeason, setSelectedSeason] = useState(null);

  const loadItems = async () => {
    try {
      const data = await getClothingItems(user.id);
      setItems(data);
    } catch (_) {}
  };

  useFocusEffect(useCallback(() => { loadItems(); }, []));

  const onRefresh = async () => {
    setRefreshing(true);
    setSelectedCategory(null);
    setSelectedColor(null);
    setSelectedSeason(null);
    await loadItems();
    setRefreshing(false);
  };

  const handleDelete = (item) => {
    impact.light();
    Alert.alert('Eliminar prenda', `Eliminar ${item.category}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteClothingItem(user.id, item.id);
            loadItems();
          } catch (_) {
            Alert.alert('Error', 'No se pudo eliminar');
          }
        },
      },
    ]);
  };

  const S = (n) => scale(n);
  const FS = (n) => fontScale(n);
  const VS = (n) => verticalScale(n);
  const CARD_GAP = S(10);
  const H_PADDING = S(20);
  const CARD_W = (width - H_PADDING * 2 - CARD_GAP) / 2;

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedCategory && item.category !== selectedCategory) return false;
      if (selectedColor && item.color !== selectedColor) return false;
      if (selectedSeason && item.season !== selectedSeason) return false;
      return true;
    });
  }, [items, selectedCategory, selectedColor, selectedSeason]);

  const hasActiveFilters = selectedCategory || selectedColor || selectedSeason;

  // ── Card ────────────────────────────────────────────────────

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={{
        width: CARD_W,
        backgroundColor: COLORS.white,
        borderRadius: S(14),
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: S(3) },
        shadowOpacity: 0.08,
        shadowRadius: S(8),
        elevation: 3,
      }}
      onLongPress={() => handleDelete(item)}
      activeOpacity={0.85}
    >
      {/* Imagen */}
      <View
        style={{
          height: CARD_W * 1.3,
          backgroundColor: item.color || '#F5F0EB',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {(item.imageUrl || item.image_url) ? (
          <Image
            source={{ uri: item.imageUrl || item.image_url }}
            style={{ width: '100%', height: '100%', resizeMode: 'cover' }}
          />
        ) : (
          <Ionicons name={getIcon(item.category)} size={S(36)} color="#FFFFFF" style={{ opacity: 0.6 }} />
        )}

        {/* Season badge */}
        {item.season && item.season !== 'Todas' && (
          <View
            style={{
              position: 'absolute',
              top: S(8),
              right: S(8),
              backgroundColor: 'rgba(0,0,0,0.45)',
              borderRadius: S(6),
              paddingHorizontal: S(8),
              paddingVertical: S(3),
            }}
          >
            <Text style={{ color: '#fff', fontSize: FS(9), fontWeight: '600', letterSpacing: 0.5 }}>
              {item.season === 'Verano' ? '☀️' : item.season === 'Invierno' ? '❄️' : item.season === 'Otoño' ? '🍂' : '🌸'}
            </Text>
          </View>
        )}

        {/* Botón eliminar visible */}
        <TouchableOpacity
          style={{
            position: 'absolute',
            top: S(6),
            left: S(6),
            width: S(28),
            height: S(28),
            borderRadius: S(14),
            backgroundColor: 'rgba(0,0,0,0.35)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPress={() => handleDelete(item)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="trash-outline" size={S(14)} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Info */}
      <View style={{ padding: S(10), gap: S(2) }}>
        <Text
          style={{ fontSize: FS(13), fontWeight: '600', color: '#1A1A1A' }}
          numberOfLines={1}
        >
          {item.category}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: S(6) }}>
          {item.color && (
            <View
              style={{
                width: S(10),
                height: S(10),
                borderRadius: S(5),
                backgroundColor: item.color,
                borderWidth: 1,
                borderColor: 'rgba(0,0,0,0.08)',
              }}
            />
          )}
          {item.brand ? (
            <Text style={{ fontSize: FS(11), color: COLORS.textLight }} numberOfLines={1}>
              {item.brand}
            </Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );

  // ── Filter chips ────────────────────────────────────────────

  const FilterChip = ({ label, selected, onPress, style }) => (
    <TouchableOpacity
      style={{
        paddingVertical: S(6),
        paddingHorizontal: S(14),
        borderRadius: 999,
        marginRight: S(6),
        backgroundColor: selected ? COLORS.primary : '#F5F0EB',
        ...style,
      }}
      onPress={onPress}
    >
      <Text
        style={{
          fontSize: FS(12),
          color: selected ? '#fff' : COLORS.text,
          fontWeight: selected ? '600' : '400',
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  // ── Render ──────────────────────────────────────────────────

  return (
    <ScreenWrapper horizontalPadding={false}>
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ paddingHorizontal: H_PADDING, paddingTop: VS(12), paddingBottom: S(12) }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <View>
              <Text style={{ fontSize: FS(24), fontWeight: '700', color: COLORS.primary }}>
                Mi Armario
              </Text>
              <Text style={{ fontSize: FS(13), color: COLORS.textLight, marginTop: S(2) }}>
                {filteredItems.length} {filteredItems.length === 1 ? 'prenda' : 'prendas'}
                {hasActiveFilters && ` filtradas`}
              </Text>
            </View>
            {hasActiveFilters && (
              <TouchableOpacity
                onPress={() => {
                  setSelectedCategory(null);
                  setSelectedColor(null);
                  setSelectedSeason(null);
                }}
                style={{
                  paddingVertical: S(4),
                  paddingHorizontal: S(12),
                  borderRadius: 999,
                  backgroundColor: COLORS.primary + '15',
                }}
              >
                <Text style={{ fontSize: FS(11), color: COLORS.primary, fontWeight: '600' }}>
                  Limpiar
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {items.length === 0 ? (
          // ── Empty state ───────────────────────────
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              paddingHorizontal: H_PADDING,
            }}
          >
            <View
              style={{
                width: S(80),
                height: S(80),
                borderRadius: S(40),
                backgroundColor: '#F5F0EB',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: S(20),
              }}
            >
              <Ionicons name="shirt-outline" size={S(36)} color="#D4CFC8" />
            </View>
            <Text
              style={{
                fontSize: FS(18),
                fontWeight: '600',
                color: '#1A1A1A',
                marginBottom: S(6),
              }}
            >
              Tu armario está vacío
            </Text>
            <Text
              style={{
                fontSize: FS(14),
                color: COLORS.textLight,
                textAlign: 'center',
                marginBottom: S(20),
                lineHeight: FS(20),
              }}
            >
              Agregá tu primera prenda para empezar{'\n'}a armar outfits
            </Text>
            <TouchableOpacity
              style={{
                backgroundColor: COLORS.primary,
                paddingVertical: S(12),
                paddingHorizontal: S(28),
                borderRadius: S(12),
              }}
              onPress={() => navigation.navigate('AddClothing')}
            >
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: FS(15) }}>
                Agregar prenda
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Filters */}
            <View style={{ paddingHorizontal: H_PADDING, paddingBottom: S(12) }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: S(8) }}>
                {CATEGORIES.map((cat) => (
                  <FilterChip
                    key={cat}
                    label={cat}
                    selected={selectedCategory === cat}
                    onPress={() => {
                      impact.light();
                      setSelectedCategory(selectedCategory === cat ? null : cat);
                    }}
                  />
                ))}
              </ScrollView>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: S(8) }}>
                {COLORS_LIST.map((c) => (
                  <TouchableOpacity
                    key={c.value}
                    style={{
                      width: S(28),
                      height: S(28),
                      borderRadius: S(14),
                      marginRight: S(8),
                      backgroundColor: c.value,
                      borderWidth: selectedColor === c.value ? 3 : 1,
                      borderColor: selectedColor === c.value ? COLORS.primary : '#E0D8CE',
                    }}
                    onPress={() => {
                      impact.light();
                      setSelectedColor(selectedColor === c.value ? null : c.value);
                    }}
                  />
                ))}
              </ScrollView>

              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {SEASONS.filter((s) => s !== 'Todas').map((s) => (
                  <FilterChip
                    key={s}
                    label={s}
                    selected={selectedSeason === s}
                    onPress={() => {
                      impact.light();
                      setSelectedSeason(selectedSeason === s ? null : s);
                    }}
                  />
                ))}
              </ScrollView>
            </View>

            {/* Grid */}
            <FlatList
              data={filteredItems}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={{
                justifyContent: 'space-between',
                marginBottom: CARD_GAP,
              }}
              contentContainerStyle={{
                paddingHorizontal: H_PADDING,
                paddingBottom: VS(100),
              }}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={COLORS.primary}
                />
              }
            />
          </>
        )}

        {/* FAB */}
        <TouchableOpacity
          style={{
            position: 'absolute',
            bottom: VS(24),
            right: S(24),
            width: S(56),
            height: S(56),
            borderRadius: S(28),
            backgroundColor: COLORS.primary,
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: COLORS.primary,
            shadowOffset: { width: 0, height: VS(4) },
            shadowOpacity: 0.3,
            shadowRadius: S(8),
            elevation: 6,
          }}
          onPress={() => navigation.navigate('AddClothing')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={S(28)} color={COLORS.white} />
        </TouchableOpacity>
      </View>
    </ScreenWrapper>
  );
}
