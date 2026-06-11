/**
 * ProfileScreen — Perfil responsive con ScreenWrapper
 * ====================================================
 */

import { View, Text, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../constants/theme';
import { useAppScale } from '../utils/responsive';
import ScreenWrapper from '../components/ScreenWrapper';

export default function ProfileScreen() {
  const { scale, fontScale, verticalScale } = useAppScale();
  const { user, logout } = useAuth();

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
