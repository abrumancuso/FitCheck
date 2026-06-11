/**
 * ProfileScreen — Perfil con estadísticas
 * ========================================
 */

import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { getClothingItems } from '../services/clothingService';
import { getOutfits } from '../services/outfitService';
import { COLORS } from '../constants/theme';
import { useAppScale } from '../utils/responsive';
import ScreenWrapper from '../components/ScreenWrapper';

export default function ProfileScreen() {
  const { scale, fontScale, verticalScale } = useAppScale();
  const { user, logout } = useAuth();
  const [items, setItems] = useState([]);
  const [outfits, setOutfits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [clothes, savedOutfits] = await Promise.all([
          getClothingItems(user.id),
          getOutfits(user.id),
        ]);
        setItems(clothes);
        setOutfits(savedOutfits);
      } catch (_) {} finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Estás segura?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const initials = (user?.email?.[0] || 'F').toUpperCase();
  const S = (n) => scale(n);
  const FS = (n) => fontScale(n);
  const VS = (n) => verticalScale(n);

  const categories = [...new Set(items.map((i) => i.category))];
  const daysActive = Math.floor(
    (Date.now() - new Date(user?.created_at || Date.now()).getTime())
    / (1000 * 60 * 60 * 24)
  );

  const STATS = [
    { icon: 'shirt-outline', number: items.length, label: 'Prendas', color: COLORS.primary },
    { icon: 'layers-outline', number: categories.length, label: 'Categorías', color: COLORS.secondary },
    { icon: 'sparkles-outline', number: outfits.length, label: 'Outfits', color: COLORS.gold },
    { icon: 'calendar-outline', number: daysActive, label: 'Días activo', color: '#6B4FA0' },
  ];

  return (
    <ScreenWrapper>
      <ScrollView contentContainerStyle={{ paddingBottom: VS(40) }}>
        {/* Header */}
        <View style={{ alignItems: 'center', paddingTop: VS(24) }}>
          <View style={{
            width: S(72), height: S(72), borderRadius: S(36),
            backgroundColor: COLORS.primary,
            justifyContent: 'center', alignItems: 'center',
            marginBottom: S(12),
          }}>
            <Text style={{ fontSize: FS(28), fontWeight: '700', color: '#fff' }}>{initials}</Text>
          </View>
          <Text style={{ fontSize: FS(15), color: '#1A1A1A', fontWeight: '500', marginBottom: S(4) }}>
            {user?.email}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S(4), marginBottom: S(24) }}>
            <Ionicons name="calendar-outline" size={FS(12)} color={COLORS.textLight} />
            <Text style={{ fontSize: FS(12), color: COLORS.textLight }}>
              Miembro desde {new Date(user?.created_at || Date.now()).toLocaleDateString('es-AR', { year: 'numeric', month: 'long' })}
            </Text>
          </View>
        </View>

        {/* ─── Estadísticas ────────────────────────── */}

        {loading ? (
          <View style={{ flexDirection: 'row', gap: S(10), marginBottom: S(24) }}>
            {[1, 2, 3, 4].map((_, i) => (
              <View key={i} style={{ flex: 1, height: VS(100), backgroundColor: '#F5F0EB', borderRadius: S(14) }} />
            ))}
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: S(10), marginBottom: S(24), flexWrap: 'wrap' }}>
            {STATS.map((stat, i) => (
              <View
                key={i}
                style={{
                  width: '47%',
                  backgroundColor: COLORS.white,
                  borderRadius: S(14),
                  paddingVertical: S(18),
                  paddingHorizontal: S(8),
                  alignItems: 'center',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: S(3) },
                  shadowOpacity: 0.07,
                  shadowRadius: S(8),
                  elevation: 3,
                }}
              >
                <View style={{
                  width: S(38), height: S(38), borderRadius: S(19),
                  backgroundColor: `${stat.color}15`,
                  justifyContent: 'center', alignItems: 'center',
                  marginBottom: S(8),
                }}>
                  <Ionicons name={stat.icon} size={FS(20)} color={stat.color} />
                </View>
                <Text style={{
                  fontSize: FS(22), fontWeight: '700', color: '#1A1A1A',
                }}>
                  {stat.number}
                </Text>
                <Text style={{
                  fontSize: FS(11), color: COLORS.textLight, marginTop: S(2),
                  textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center',
                }}>
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ─── Top categorías ──────────────────────── */}

        {categories.length > 0 && (
          <View style={{ marginBottom: S(24) }}>
            <Text style={{
              fontSize: FS(13), fontWeight: '700', color: COLORS.text,
              letterSpacing: 0.8, marginBottom: S(10), textTransform: 'uppercase',
            }}>
              Tus categorías
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: S(8) }}>
              {categories.map((cat) => {
                const count = items.filter((i) => i.category === cat).length;
                return (
                  <View
                    key={cat}
                    style={{
                      backgroundColor: COLORS.white,
                      borderRadius: S(10),
                      paddingVertical: S(8),
                      paddingHorizontal: S(14),
                      borderWidth: 1,
                      borderColor: COLORS.border,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: S(6),
                    }}
                  >
                    <Text style={{ fontSize: FS(13), fontWeight: '600', color: '#1A1A1A' }}>{cat}</Text>
                    <View style={{
                      backgroundColor: COLORS.primary + '15',
                      borderRadius: S(6),
                      paddingHorizontal: S(6),
                      paddingVertical: S(1),
                    }}>
                      <Text style={{ fontSize: FS(11), fontWeight: '600', color: COLORS.primary }}>{count}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ─── Cerrar sesión ──────────────────────── */}
        <TouchableOpacity
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            gap: S(6), paddingVertical: S(14), marginTop: S(12),
            borderWidth: 1, borderColor: COLORS.border, borderRadius: S(10),
          }}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={FS(16)} color={COLORS.error} />
          <Text style={{ color: COLORS.error, fontSize: FS(15), fontWeight: '500' }}>
            Cerrar sesión
          </Text>
        </TouchableOpacity>

        {/* Versión */}
        <Text style={{
          textAlign: 'center', fontSize: FS(12),
          color: COLORS.textLight, marginTop: VS(24),
        }}>
          FitCheck v1.0
        </Text>
      </ScrollView>
    </ScreenWrapper>
  );
}
