/**
 * OutfitsScreen — List/Build outfit builder
 * ===========================================
 * Two-mode screen: list saved outfits or build a new one.
 */

import { useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image,
  TextInput, Alert, ActivityIndicator, RefreshControl,
  Share,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import ViewShot from 'react-native-view-shot';
import { useAuth } from '../context/AuthContext';
import { getClothingItems } from '../services/clothingService';
import { addOutfit, getOutfits, deleteOutfit } from '../services/outfitService';
import { COLORS } from '../constants/theme';
import { useAppScale } from '../utils/responsive';
import ScreenWrapper from '../components/ScreenWrapper';
import OutfitPreview, { getInitialPosition, SKIN_TONES } from '../components/OutfitPreview';
import ItemLayerControls from '../components/ItemLayerControls';

export default function OutfitsScreen() {
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
  const [skinTone, setSkinTone] = useState(2); // default: Natural
  const outfitPreviewRef = useRef(null);

  const [outfitName, setOutfitName] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

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
    const willBeAdded = !selectedIds.includes(id);
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
          locked: false,
        },
      }));
      // Auto-seleccionar la prenda recién agregada para ajustarla
      setSelectedLayerId(id);
    } else {
      // Si se saca la prenda y estaba seleccionada, limpiar
      if (selectedLayerId === id) setSelectedLayerId(null);
    }
  };

  const handleSave = async () => {
    if (selectedIds.length === 0 || !outfitName.trim()) return;
    try {
      await addOutfit(user.id, { name: outfitName.trim(), itemIds: selectedIds });
      Alert.alert('Listo', 'Outfit guardado');
      setMode('list');
      setSelectedIds([]);
      setItemSettings({});
      setSelectedLayerId(null);
      setOutfitName('');
      loadData();
    } catch (_) {
      Alert.alert('Error', 'No se pudo guardar el outfit');
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
    setSelectedIds([]);
    setItemSettings({});
    setSelectedLayerId(null);
    setOutfitName('');
  };

  const handleShare = async () => {
    if (!outfitPreviewRef.current || selectedItems.length === 0) return;
    try {
      const uri = await outfitPreviewRef.current.capture();
      await Share.share({ url: uri, message: 'Mirá el outfit que armé en FitCheck 👗' });
    } catch (err) {
      if (err.message !== 'User did not share') {
        Alert.alert('Error', 'No se pudo compartir');
      }
    }
  };

  const H_PADDING = S(24);

  // ──────────────────────────────────────────────
  //  MODE: LIST — saved outfits
  // ──────────────────────────────────────────────

  if (mode === 'list') {
    if (loading && outfits.length === 0) {
      return (
        <ScreenWrapper>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={COLORS.primary} />
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
        {/* Header */}
        <View style={{
          paddingHorizontal: H_PADDING,
          paddingTop: VS(12),
          paddingBottom: S(12),
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <Text style={{ fontSize: FS(20), fontWeight: '700', color: COLORS.primary }}>Nuevo Outfit</Text>
          <TouchableOpacity onPress={cancelBuilder}>
            <Text style={{ fontSize: FS(15), color: COLORS.textLight, fontWeight: '500' }}>Cancelar</Text>
          </TouchableOpacity>
        </View>

        {/* Outfit Preview + controles */}
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
              skinTone={skinTone}
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

          {/* ─── Selector de tono de piel ─────────────────── */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S(6), marginTop: S(10), marginBottom: S(4) }}>
            <Text style={{ fontSize: FS(11), color: COLORS.textLight }}>Piel:</Text>
            {SKIN_TONES.map((tone, idx) => (
              <TouchableOpacity
                key={idx}
                style={{
                  width: S(22), height: S(22),
                  borderRadius: S(11),
                  backgroundColor: tone.light,
                  borderWidth: skinTone === idx ? 2.5 : 1,
                  borderColor: skinTone === idx ? COLORS.primary : COLORS.border,
                }}
                onPress={() => setSkinTone(idx)}
                activeOpacity={0.7}
              />
            ))}
          </View>
        </View>

        {/* Available items — tap to select */}
        <FlatList
          style={{ flex: 1 }}
          data={wardrobeItems.filter(item => !selectedIds.includes(item.id))}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: COLORS.white,
                borderRadius: S(10), padding: S(12), marginBottom: S(6),
                borderWidth: 1, borderColor: COLORS.border,
              }}
              onPress={() => toggleItem(item.id)}
              activeOpacity={0.7}
            >
              <View style={{ width: S(44), height: S(44), borderRadius: S(8), overflow: 'hidden', marginRight: S(12), backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center' }}>
                {(item.imageUrl || item.image_url) ? (
                  <Image source={{ uri: item.imageUrl || item.image_url }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
                ) : (
                  <Ionicons name="shirt-outline" size={S(20)} color={COLORS.white} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: FS(14), fontWeight: '500', color: '#1A1A1A' }}>{item.category}</Text>
              </View>
              <Ionicons name="add-circle-outline" size={S(22)} color={COLORS.primary} />
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: H_PADDING, paddingTop: S(12), paddingBottom: VS(200) }}
          ListEmptyComponent={
            <View style={{ paddingTop: VS(40), alignItems: 'center' }}>
              <Text style={{ fontSize: FS(14), color: COLORS.textLight }}>Todas las prendas seleccionadas</Text>
            </View>
          }
        />

        {/* Bottom section — name input + save */}
        <View style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: H_PADDING,
          paddingTop: S(12),
          paddingBottom: VS(24),
          backgroundColor: COLORS.background,
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
        }}>
          <TextInput
            style={{
              backgroundColor: COLORS.white,
              borderRadius: S(10),
              paddingHorizontal: S(16),
              paddingVertical: S(12),
              fontSize: FS(15),
              color: '#1A1A1A',
              borderWidth: 1,
              borderColor: COLORS.border,
              marginBottom: S(10),
            }}
            placeholder="Nombre del outfit"
            placeholderTextColor={COLORS.textLight}
            value={outfitName}
            onChangeText={setOutfitName}
          />
          <TouchableOpacity
            style={{
              backgroundColor: selectedIds.length > 0 && outfitName.trim()
                ? COLORS.primary
                : '#CCB6B9',
              borderRadius: S(10),
              paddingVertical: S(14),
              alignItems: 'center',
              marginBottom: S(8),
            }}
            onPress={handleSave}
            disabled={selectedIds.length === 0 || !outfitName.trim()}
            activeOpacity={0.85}
          >
            <Text style={{ fontSize: FS(16), fontWeight: '600', color: COLORS.white }}>
              Guardar Outfit
            </Text>
          </TouchableOpacity>

          {/* Compartir */}
          {selectedItems.length > 0 && (
            <TouchableOpacity
              style={{
                borderRadius: S(10),
                paddingVertical: S(10),
                alignItems: 'center',
                borderWidth: 1,
                borderColor: COLORS.border,
                backgroundColor: COLORS.white,
              }}
              onPress={handleShare}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S(6) }}>
                <Ionicons name="share-outline" size={FS(16)} color={COLORS.primary} />
                <Text style={{ fontSize: FS(14), fontWeight: '500', color: COLORS.text }}>
                  Compartir
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </ScreenWrapper>
  );
}
