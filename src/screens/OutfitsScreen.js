/**
 * OutfitsScreen — List/Build outfit builder
 * ===========================================
 * Two-mode screen: list saved outfits or build a new one.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image,
  TextInput, Alert, ActivityIndicator, RefreshControl,
  ScrollView, LayoutAnimation, Platform, UIManager,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import ViewShot from 'react-native-view-shot';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { getClothingItems } from '../services/clothingService';
import { addOutfit, getOutfits, deleteOutfit, updateOutfit } from '../services/outfitService';
import { COLORS } from '../constants/theme';
import { useAppScale } from '../utils/responsive';
import ScreenWrapper from '../components/ScreenWrapper';
import OutfitPreview, { getInitialPosition } from '../components/OutfitPreview';
import ItemLayerControls from '../components/ItemLayerControls';
import Skeleton from '../components/Skeleton';
import { impact, notification } from '../utils/haptics';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function OutfitsScreen({ navigation, route }) {
  const { scale, fontScale, verticalScale, width } = useAppScale();
  const { user } = useAuth();
  const S = (n) => scale(n);
  const FS = (n) => fontScale(n);
  const VS = (n) => verticalScale(n);

  const [mode, setMode] = useState('list');
  const [outfits, setOutfits] = useState([]);
  const [wardrobeItems, setWardrobeItems] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [itemSettings, setItemSettings] = useState({});
  const [selectedLayerId, setSelectedLayerId] = useState(null);
  const outfitPreviewRef = useRef(null);

  const [outfitName, setOutfitName] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [smartMatchLoading, setSmartMatchLoading] = useState(false);
  const [editingOutfit, setEditingOutfit] = useState(null);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setError(null);
    try {
      const [o, w] = await Promise.all([
        getOutfits(user.id),
        getClothingItems(user.id),
      ]);
      setOutfits(o);
      setWardrobeItems(w);
    } catch (err) {
      setError('No se pudieron cargar los outfits');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => {
    if (!route.params?.editOutfit) {
      loadData();
    }
  }, [loadData, route.params?.editOutfit]));

  // Manejar edición desde OutfitDetail
  useEffect(() => {
    const edit = route.params?.editOutfit;
    if (!edit) return;

    // Poblar el builder con los datos del outfit existente
    setEditingOutfit(edit);
    setOutfitName(edit.name);
    setSelectedIds(edit.item_ids || []);

    // Reconstruir posiciones guardadas
    const saved = edit.item_settings || {};
    const canvasW = width * 0.68;
    const settings = {};
    (edit.item_ids || []).forEach((id) => {
      const item = wardrobeItems.find((w) => w.id === id);
      if (item) {
        const s = saved[id];
        const initial = getInitialPosition(item.category, canvasW);
        settings[id] = {
          scale: s?.scale ?? initial.scale,
          offsetX: s?.offsetX ?? (initial.offsetX || 0),
          offsetY: s?.offsetY ?? (initial.offsetY || 0),
          locked: false,
        };
      }
    });
    setItemSettings(settings);
    setMode('builder');

    // Limpiar el param para que no re-ingrese al volver
    navigation.setParams({ editOutfit: undefined });
  }, [route.params?.editOutfit]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleDeleteOutfit = (outfit) => {
    Alert.alert('Eliminar outfit', `Eliminar ${outfit.name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          try {
            await deleteOutfit(user.id, outfit.id);
            loadData();
          } catch (_) {
            Alert.alert('Error', 'No se pudo eliminar');
          }
        },
      },
    ]);
  };

  const toggleItem = (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const willBeAdded = !selectedIds.includes(id);
    if (willBeAdded) impact.light();
    else impact.light();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    if (willBeAdded) {
      const item = wardrobeItems.find((w) => w.id === id);
      const canvasW = width * 0.68;
      const initial = getInitialPosition(item?.category, canvasW);
      setItemSettings((prev) => ({
        ...prev,
        [id]: {
          scale: initial.scale,
          offsetX: initial.offsetX || 0,
          offsetY: initial.offsetY || 0,
          locked: false, // aparece desbloqueado para poder arrastrarlo
        },
      }));
      setSelectedLayerId(id); // auto-seleccionamos para mostrar controles
    } else {
      // Si se saca la prenda y estaba seleccionada, limpiar
      if (selectedLayerId === id) setSelectedLayerId(null);
    }
  };

  const handleSave = async () => {
    if (selectedIds.length === 0 || !outfitName.trim()) return;
    try {
      if (editingOutfit) {
        await updateOutfit(editingOutfit.id, {
          name: outfitName.trim(),
          itemIds: selectedIds,
          itemSettings,
        });
        Alert.alert('Listo', 'Outfit actualizado');
      } else {
        await addOutfit(user.id, {
          name: outfitName.trim(),
          itemIds: selectedIds,
          itemSettings,
        });
        Alert.alert('Listo', 'Outfit guardado');
      }
      notification.success();
      setMode('list');
      setEditingOutfit(null);
      setSelectedIds([]);
      setItemSettings({});
      setSelectedLayerId(null);
      setOutfitName('');
      loadData();
    } catch (_) {
      Alert.alert('Error', editingOutfit
        ? 'No se pudo actualizar el outfit'
        : 'No se pudo guardar el outfit');
    }
  };

  const enterBuilder = () => {
    setSelectedIds([]);
    setItemSettings({});
    setSelectedLayerId(null);
    setOutfitName('');
    setMode('builder');
  };

  const cancelBuilder = () => {
    setMode('list');
    setEditingOutfit(null);
    setSelectedIds([]);
    setItemSettings({});
    setSelectedLayerId(null);
    setOutfitName('');
  };

  // ─── Smart Match ─────────────────────────────────────────────

  const TOPS = ['Remera', 'Camisa', 'Blusa', 'Buzo', 'Sweater', 'Campera', 'Abrigo', 'Blazer'];
  const BOTTOMS = ['Pantalón', 'Short', 'Falda', 'Pollera'];
  const SHOES = ['Zapatos'];
  const ALL_OUTFIT_CATS = [...TOPS, ...BOTTOMS, ...SHOES];

  const handleSmartMatch = async () => {
    const selectedItemsList = wardrobeItems.filter((i) => selectedIds.includes(i.id));
    const available = wardrobeItems.filter((i) => !selectedIds.includes(i.id));

    if (available.length === 0) {
      Alert.alert('Sin sugerencias', 'No hay más prendas disponibles para sugerir.');
      return;
    }

    let targetCategories = [];

    if (selectedIds.length === 0) {
      // Sin nada en el lienzo — sugerir cualquier prenda principal
      targetCategories = ALL_OUTFIT_CATS;
    } else {
      const selectedCats = selectedItemsList.map((i) => i.category);
      const hasTop = selectedCats.some((c) => TOPS.includes(c));
      const hasBottom = selectedCats.some((c) => BOTTOMS.includes(c));
      const hasShoes = selectedCats.some((c) => SHOES.includes(c));

      if (!hasTop) targetCategories.push(...TOPS);
      if (!hasBottom) targetCategories.push(...BOTTOMS);
      if (!hasShoes) targetCategories.push(...SHOES);

      // Si ya tenemos outfit completo, sugerir accesorio
      if (targetCategories.length === 0) {
        targetCategories = ['Cartera', 'Accesorio'];
      }
    }

    // Filtrar candidatos por categoría
    let candidates = available.filter((i) => targetCategories.includes(i.category));

    if (candidates.length === 0) {
      Alert.alert('Sin coincidencias', '¡Probá cargando más prendas de esta temporada!');
      return;
    }

    // Preferir items de la misma temporada que lo ya seleccionado
    const existingSeasons = selectedItemsList.map((i) => i.season).filter(Boolean);
    if (existingSeasons.length > 0) {
      const seasonMatch = candidates.filter((i) => existingSeasons.includes(i.season));
      if (seasonMatch.length > 0) candidates = seasonMatch;
    }

    setSmartMatchLoading(true);
    // Pequeña pausa para sensación de "magia"
    await new Promise((r) => setTimeout(r, 500));

    const pick = candidates[Math.floor(Math.random() * Math.min(candidates.length, 3))];
    toggleItem(pick.id);
    notification.success();
    setSmartMatchLoading(false);
  };

  const H_PADDING = S(24);

  // ──────────────────────────────────────────────
  //  MODE: LIST — saved outfits
  // ──────────────────────────────────────────────

  if (mode === 'list') {
    if (loading && outfits.length === 0) {
      return (
        <ScreenWrapper horizontalPadding={false}>
          <View style={{ flex: 1, paddingHorizontal: S(24), paddingTop: VS(12) }}>
            <Skeleton width={180} height={28} borderRadius={6} style={{ marginBottom: S(24) }} />
            {[1, 2, 3, 4].map((_, i) => (
              <Skeleton.Card key={i} style={{ marginBottom: S(10) }} />
            ))}
          </View>
        </ScreenWrapper>
      );
    }

    if (error) {
      return (
        <ScreenWrapper>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: S(24) }}>
            <Ionicons name="cloud-offline-outline" size={S(56)} color="#E8E0D6" />
            <Text style={{ fontSize: FS(18), fontWeight: '600', color: '#1A1A1A', marginTop: S(16), marginBottom: S(8), textAlign: 'center' }}>{error}</Text>
            <TouchableOpacity
              style={{ backgroundColor: COLORS.primary, borderRadius: S(10), paddingVertical: S(12), paddingHorizontal: S(24) }}
              onPress={() => { setLoading(true); loadData(); }}
            >
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: FS(14) }}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        </ScreenWrapper>
      );
    }

    const renderOutfit = ({ item }) => {
      const itemIds = item.item_ids || [];
      const firstItemId = itemIds[0];
      const firstItem = wardrobeItems.find(w => w.id === firstItemId);

      // Items de este outfit
      const outfitItems = itemIds
        .map((id) => wardrobeItems.find((w) => w.id === id))
        .filter(Boolean);

      return (
        <TouchableOpacity
          style={{
            backgroundColor: COLORS.white,
            borderRadius: S(12),
            padding: S(16),
            marginBottom: S(10),
            shadowColor: '#000',
            shadowOffset: { width: 0, height: S(2) },
            shadowOpacity: 0.06,
            shadowRadius: S(6),
            elevation: 2,
            flexDirection: 'row',
            alignItems: 'center',
          }}
          onPress={() => navigation.navigate('OutfitDetail', {
            outfit: item,
            items: outfitItems,
          })}
          onLongPress={() => handleDeleteOutfit(item)}
          activeOpacity={0.85}
        >
          <View style={{ width: S(48), height: S(48), borderRadius: S(8), overflow: 'hidden', marginRight: S(12), backgroundColor: firstItem?.color || '#E8E0D6', justifyContent: 'center', alignItems: 'center' }}>
            {(firstItem?.imageUrl || firstItem?.image_url) ? (
              <Image source={{ uri: firstItem?.imageUrl || firstItem?.image_url }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
            ) : (
              <Ionicons name="shirt-outline" size={S(22)} color={COLORS.white} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: FS(15), fontWeight: '600', color: '#1A1A1A' }}>{item.name}</Text>
            <Text style={{ fontSize: FS(12), color: COLORS.textLight, marginTop: S(2) }}>
              {(item.item_count || itemIds.length)} {(item.item_count || itemIds.length) === 1 ? 'prenda' : 'prendas'}
            </Text>
          </View>
        </TouchableOpacity>
      );
    };

    return (
      <ScreenWrapper horizontalPadding={false}>
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: H_PADDING, paddingTop: VS(12), paddingBottom: S(16) }}>
            <Text style={{ fontSize: FS(24), fontWeight: '700', color: COLORS.primary }}>Mis Outfits</Text>
          </View>

          {outfits.length === 0 ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: H_PADDING }}>
              <Ionicons name="sparkles-outline" size={S(56)} color="#E8E0D6" />
              <Text style={{ fontSize: FS(18), fontWeight: '600', color: '#1A1A1A', marginTop: S(16), marginBottom: S(4) }}>
                Todavía no creaste outfits
              </Text>
              <Text style={{ fontSize: FS(14), color: COLORS.textLight, textAlign: 'center', lineHeight: FS(20) }}>
                Seleccioná prendas de tu guardarropas y combinalas para armar looks únicos.
              </Text>
            </View>
          ) : (
            <FlatList
              data={outfits}
              renderItem={renderOutfit}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: H_PADDING, paddingBottom: VS(100) }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            />
          )}

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
            onPress={enterBuilder}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={S(28)} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </ScreenWrapper>
    );
  }

  // ──────────────────────────────────────────────
  //  MODE: BUILDER — create a new outfit
  // ──────────────────────────────────────────────

  const selectedItems = wardrobeItems.filter((item) => selectedIds.includes(item.id));

  return (
    <ScreenWrapper horizontalPadding={false}>
      <View style={{ flex: 1 }}>
        {/* Header (fijo) */}
        <View style={{
          paddingHorizontal: H_PADDING,
          paddingTop: VS(12),
          paddingBottom: S(12),
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <Text style={{ fontSize: FS(20), fontWeight: '700', color: COLORS.primary }}>
            {editingOutfit ? 'Editar Outfit' : 'Nuevo Outfit'}
          </Text>
          <TouchableOpacity onPress={cancelBuilder}>
            <Text style={{ fontSize: FS(15), color: COLORS.textLight, fontWeight: '500' }}>Cancelar</Text>
          </TouchableOpacity>
        </View>

        {/* Canvas + controles (fijo — NO scrollea) */}
        <View style={{
          paddingHorizontal: H_PADDING,
          paddingVertical: S(8),
          alignItems: 'center',
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
        }}>
          <ViewShot ref={outfitPreviewRef} options={{ format: 'png', quality: 1.0 }}>
            <OutfitPreview
              items={selectedItems}
              itemSettings={itemSettings}
              onSelectItem={(id) => {
                if (itemSettings[id]?.locked) {
                  setItemSettings((prev) => ({
                    ...prev,
                    [id]: { ...prev[id], locked: false },
                  }));
                }
                setSelectedLayerId(selectedLayerId === id ? null : id);
              }}
              selectedItemId={selectedLayerId}
              onChangeItemSettings={(itemId, newSettings) => {
                setItemSettings((prev) => ({ ...prev, [itemId]: newSettings }));
                if (newSettings.locked) {
                  setSelectedLayerId(null);
                }
              }}
              canvasWidth={width * 0.68}
            />
          </ViewShot>

          {/* Controles de capa — escala + OK/Editar */}
          {selectedLayerId && itemSettings[selectedLayerId] && (
            <ItemLayerControls
              item={selectedItems.find((i) => i.id === selectedLayerId)}
              settings={itemSettings[selectedLayerId]}
              onChange={(newSettings) => {
                setItemSettings((prev) => ({ ...prev, [selectedLayerId]: newSettings }));
                if (newSettings.locked) {
                  setSelectedLayerId(null);
                }
              }}
              onRemove={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setSelectedIds((prev) => prev.filter((id) => id !== selectedLayerId));
                setSelectedLayerId(null);
              }}
            />
          )}

          {/* Mini chips de prendas seleccionadas */}
          {selectedItems.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S(6), marginTop: S(8), justifyContent: 'center' }}>
              {selectedItems.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: selectedLayerId === item.id ? COLORS.gold : COLORS.white,
                    borderRadius: S(20),
                    paddingVertical: S(4), paddingHorizontal: S(10),
                    borderWidth: 1,
                    borderColor: selectedLayerId === item.id ? COLORS.gold : COLORS.border,
                    gap: S(4),
                  }}
                  onPress={() => {
                    if (itemSettings[item.id]?.locked) {
                      setItemSettings((prev) => ({
                        ...prev,
                        [item.id]: { ...prev[item.id], locked: false },
                      }));
                    }
                    setSelectedLayerId(selectedLayerId === item.id ? null : item.id);
                  }}
                >
                  <View style={{
                    width: S(20), height: S(20), borderRadius: S(4),
                    overflow: 'hidden', backgroundColor: 'transparent',
                  }}>
                    {(item.imageUrl || item.image_url) && (
                      <Image source={{ uri: item.imageUrl || item.image_url }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
                    )}
                  </View>
                  <Text style={{
                    fontSize: FS(11), fontWeight: '500',
                    color: selectedLayerId === item.id ? '#fff' : COLORS.text,
                  }}>{item.category}</Text>
                  <TouchableOpacity
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    onPress={() => {
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      setSelectedIds((prev) => prev.filter((id) => id !== item.id));
                      if (selectedLayerId === item.id) setSelectedLayerId(null);
                    }}
                  >
                    <Ionicons
                      name="close-circle"
                      size={FS(14)}
                      color={selectedLayerId === item.id ? 'rgba(255,255,255,0.7)' : COLORS.textLight}
                    />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Available items — scrollean */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: selectedItems.length > 0 ? VS(200) : VS(100), paddingHorizontal: H_PADDING, paddingTop: S(12) }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Smart Match — sugerencia inteligente */}
          {wardrobeItems.filter(i => !selectedIds.includes(i.id)).length > 0 && (
            <View style={{ marginBottom: S(12) }}>
              <TouchableOpacity
                onPress={handleSmartMatch}
                disabled={smartMatchLoading}
                activeOpacity={0.85}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: S(8),
                  backgroundColor: '#F5F0FF',
                  borderRadius: S(12),
                  paddingVertical: S(12),
                  borderWidth: 1,
                  borderColor: '#D8CFF0',
                }}
              >
                {smartMatchLoading ? (
                  <ActivityIndicator size="small" color="#6B4FA0" />
                ) : (
                  <Ionicons name="wand-outline" size={FS(18)} color="#6B4FA0" />
                )}
                <Text style={{ fontSize: FS(14), fontWeight: '600', color: '#6B4FA0' }}>
                  {smartMatchLoading ? 'Buscando...' : 'Smart Match'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {wardrobeItems.filter(item => !selectedIds.includes(item.id)).length === 0 ? (
            <View style={{ paddingVertical: VS(40), alignItems: 'center' }}>
              <Ionicons name="checkmark-done-outline" size={S(40)} color={COLORS.success} />
              <Text style={{ fontSize: FS(14), color: COLORS.textLight, marginTop: S(12), textAlign: 'center' }}>
                Todas las prendas seleccionadas
              </Text>
            </View>
          ) : (
            wardrobeItems.filter(item => !selectedIds.includes(item.id)).map((item) => (
            <TouchableOpacity
              key={item.id}
              style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: COLORS.white,
                borderRadius: S(12), padding: S(14), marginBottom: S(8),
                shadowColor: '#000',
                shadowOffset: { width: 0, height: S(1) },
                shadowOpacity: 0.04,
                shadowRadius: S(4),
                elevation: 1,
              }}
              onPress={() => toggleItem(item.id)}
              activeOpacity={0.7}
            >
              <View style={{
                width: S(48), height: S(48), borderRadius: S(10),
                overflow: 'hidden', marginRight: S(14),
                backgroundColor: item.color || '#F5F0EB',
                justifyContent: 'center', alignItems: 'center',
              }}>
                {(item.imageUrl || item.image_url) ? (
                  <Image source={{ uri: item.imageUrl || item.image_url }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
                ) : (
                  <Ionicons name="shirt-outline" size={S(22)} color="#FFFFFF" style={{ opacity: 0.5 }} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: FS(14), fontWeight: '600', color: '#1A1A1A' }}>{item.category}</Text>
                {item.season && item.season !== 'Todas' && (
                  <Text style={{
                    fontSize: FS(11), color: COLORS.textLight, marginTop: S(2),
                  }}>
                    {item.season}
                  </Text>
                )}
              </View>
              <View style={{
                width: S(32), height: S(32), borderRadius: S(16),
                backgroundColor: COLORS.primary + '12',
                justifyContent: 'center', alignItems: 'center',
              }}>
                <Ionicons name="add" size={S(18)} color={COLORS.primary} />
              </View>
            </TouchableOpacity>
          )))}
        </ScrollView>

        {/* Bottom section — solo cuando hay prendas seleccionadas */}
        {selectedItems.length > 0 && (
          <View style={{
            paddingHorizontal: H_PADDING,
            paddingTop: S(14),
            paddingBottom: VS(28),
            backgroundColor: COLORS.white,
            borderTopWidth: 1,
            borderTopColor: COLORS.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -S(3) },
            shadowOpacity: 0.06,
            shadowRadius: S(8),
            elevation: 6,
          }}>
            <TextInput
              style={{
                backgroundColor: '#F8F6F3',
                borderRadius: S(12),
                paddingHorizontal: S(18),
                paddingVertical: S(14),
                fontSize: FS(15),
                color: '#1A1A1A',
                marginBottom: S(10),
              }}
              placeholder="Ponéle nombre a tu outfit"
              placeholderTextColor={COLORS.textLight}
              value={outfitName}
              onChangeText={setOutfitName}
            />
            <TouchableOpacity
              style={{
                backgroundColor: outfitName.trim()
                  ? COLORS.primary
                  : '#CCB6B9',
                borderRadius: S(12),
                paddingVertical: S(15),
                alignItems: 'center',
              }}
              onPress={handleSave}
              disabled={!outfitName.trim()}
              activeOpacity={0.85}
            >
              <Text style={{
                fontSize: FS(16), fontWeight: '700', color: COLORS.white,
                letterSpacing: 0.3,
              }}>
                {editingOutfit ? 'Guardar Cambios' : 'Guardar Outfit'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScreenWrapper>
  );
}
