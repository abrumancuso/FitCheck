/**
 * WardrobeScreen — Grid responsive con ScreenWrapper
 * ===================================================
 * El wrapper global maneja SafeArea, background y padding.
 * El screen solo se ocupa de su layout interno.
 */

import { useCallback, useState, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image,
  ScrollView, RefreshControl, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { getClothingItems, deleteClothingItem, CATEGORIES, SEASONS, COLORS_LIST } from '../services/clothingService';
import { COLORS } from '../constants/theme';
import { useAppScale } from '../utils/responsive';
import ScreenWrapper from '../components/ScreenWrapper';

export default function WardrobeScreen({ navigation }) {
  const { scale, fontScale, verticalScale, width } = useAppScale();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedSeason, setSelectedSeason] = useState(null);

  const loadItems = async () => {
    try { const data = await getClothingItems(user.id); setItems(data); } catch (_) {}
  };
  useFocusEffect(useCallback(() => { loadItems(); }, []));
  const onRefresh = async () => { setRefreshing(true); setSelectedCategory(null); setSelectedColor(null); setSelectedSeason(null); await loadItems(); setRefreshing(false); };

  const handleDelete = (item) => {
    Alert.alert('Eliminar prenda', `Eliminar ${item.category}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        try { await deleteClothingItem(user.id, item.id); loadItems(); } catch (_) { Alert.alert('Error', 'No se pudo eliminar'); }
      }},
    ]);
  };

  const S = (n) => scale(n);
  const FS = (n) => fontScale(n);
  const VS = (n) => verticalScale(n);
  const CARD_GAP = S(8);
  const H_PADDING = S(24);
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

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={{
        width: CARD_W, backgroundColor: COLORS.white, borderRadius: S(12), overflow: 'hidden',
        shadowColor: '#000', shadowOffset: { width: 0, height: S(2) },
        shadowOpacity: 0.06, shadowRadius: S(6), elevation: 2,
      }}
      onLongPress={() => handleDelete(item)}
      activeOpacity={0.85}
    >
      <View style={{ height: CARD_W * 1.2, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center' }}>
        {(item.imageUrl || item.image_url) ? (
          <Image source={{ uri: item.imageUrl || item.image_url }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
        ) : (
          <Ionicons name="shirt-outline" size={FS(26)} color={COLORS.white} />
        )}
      </View>
      <View style={{ padding: S(8) }}>
        <Text style={{ fontSize: FS(14), fontWeight: '600', color: '#1A1A1A' }} numberOfLines={1}>{item.category}</Text>
        {item.season && item.season !== 'Todas' && (
          <Text style={{ fontSize: FS(11), color: COLORS.textLight, marginTop: S(2), textTransform: 'uppercase', letterSpacing: 0.5 }}>{item.season}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <ScreenWrapper horizontalPadding={false}>
      <View style={{ flex: 1 }}>
        {/* Header — paddingTop VS(12) como transición visual del notch */}
        <View style={{ paddingHorizontal: H_PADDING, paddingTop: VS(12), paddingBottom: S(16) }}>
          <Text style={{ fontSize: FS(24), fontWeight: '700', color: COLORS.primary }}>Wardrobe</Text>
          <Text style={{ fontSize: FS(13), color: COLORS.textLight, marginTop: S(2) }}>
            {filteredItems.length} {filteredItems.length === 1 ? 'prenda' : 'prendas'}
            {hasActiveFilters && ` (filtradas)`}
          </Text>
        </View>

        {items.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: H_PADDING }}>
            <Ionicons name="file-tray-outline" size={S(56)} color="#E8E0D6" />
            <Text style={{ fontSize: FS(18), fontWeight: '600', color: '#1A1A1A', marginTop: S(16), marginBottom: S(4) }}>
              Tu guardarropas está vacío
            </Text>
            <Text style={{ fontSize: FS(14), color: COLORS.textLight, textAlign: 'center' }}>
              Tocá el botón + para agregar tu primera prenda
            </Text>
          </View>
        ) : (
          <>
            {/* Filter Bar */}
            {items.length > 0 && (
              <View style={{ paddingHorizontal: H_PADDING, paddingBottom: S(12) }}>
                {/* Category Chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: S(8) }}>
                  {CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={{
                        paddingVertical: S(6), paddingHorizontal: S(14), borderRadius: 999, marginRight: S(6),
                        backgroundColor: selectedCategory === cat ? COLORS.primary : COLORS.white,
                        borderWidth: 1, borderColor: selectedCategory === cat ? COLORS.primary : COLORS.border,
                      }}
                      onPress={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                    >
                      <Text style={{ fontSize: FS(12), color: selectedCategory === cat ? '#fff' : COLORS.text, fontWeight: selectedCategory === cat ? '600' : '400' }}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Color Circles */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: S(8) }}>
                  {COLORS_LIST.map((c) => (
                    <TouchableOpacity
                      key={c.value}
                      style={{
                        width: S(28), height: S(28), borderRadius: S(14), marginRight: S(8),
                        backgroundColor: c.value,
                        borderWidth: selectedColor === c.value ? 3 : 1,
                        borderColor: selectedColor === c.value ? COLORS.gold : COLORS.border,
                      }}
                      onPress={() => setSelectedColor(selectedColor === c.value ? null : c.value)}
                    />
                  ))}
                </ScrollView>

                {/* Season Chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {SEASONS.filter(s => s !== 'Todas').map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={{
                        paddingVertical: S(6), paddingHorizontal: S(14), borderRadius: 999, marginRight: S(6),
                        backgroundColor: selectedSeason === s ? COLORS.primary : COLORS.white,
                        borderWidth: 1, borderColor: selectedSeason === s ? COLORS.primary : COLORS.border,
                      }}
                      onPress={() => setSelectedSeason(selectedSeason === s ? null : s)}
                    >
                      <Text style={{ fontSize: FS(12), color: selectedSeason === s ? '#fff' : COLORS.text, fontWeight: selectedSeason === s ? '600' : '400' }}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Clear Filters */}
                {hasActiveFilters && (
                  <TouchableOpacity
                    style={{ alignSelf: 'flex-start', marginTop: S(8) }}
                    onPress={() => { setSelectedCategory(null); setSelectedColor(null); setSelectedSeason(null); }}
                  >
                    <Text style={{ fontSize: FS(12), color: COLORS.primary, fontWeight: '600' }}>Limpiar filtros</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <FlatList
              data={filteredItems}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={{ justifyContent: 'space-between', marginBottom: CARD_GAP }}
              contentContainerStyle={{ paddingHorizontal: H_PADDING, paddingBottom: VS(100) }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            />
          </>
        )}

        {/* FAB flotante */}
        <TouchableOpacity
          style={{
            position: 'absolute', bottom: VS(24), right: S(24),
            width: S(56), height: S(56), borderRadius: S(28),
            backgroundColor: COLORS.primary,
            justifyContent: 'center', alignItems: 'center',
            shadowColor: COLORS.primary, shadowOffset: { width: 0, height: VS(4) },
            shadowOpacity: 0.3, shadowRadius: S(8), elevation: 6,
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
