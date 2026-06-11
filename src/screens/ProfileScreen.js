/**
 * ProfileScreen — Perfil responsive con ScreenWrapper
 * ====================================================
 * SafeArea + padding horizontal resuelto por el wrapper.
 * Sin margins manuales truchos (adiós paddingTop: VS(80)).
 */

import { View, Text, TouchableOpacity, Alert } from 'react-native';
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
      <View style={{ flex: 1, alignItems: 'center', paddingTop: VS(32) }}>
        {/* Avatar */}
        <View style={{ width: S(72), height: S(72), borderRadius: S(36), backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginBottom: S(16) }}>
          <Text style={{ fontSize: FS(28), fontWeight: '700', color: '#fff' }}>{initials}</Text>
        </View>
        <Text style={{ fontSize: FS(15), color: '#1A1A1A', fontWeight: '500', marginBottom: S(24) }}>{user?.email}</Text>

        {/* Info card */}
        <View style={{ width: '100%', backgroundColor: COLORS.white, borderRadius: S(12), padding: S(16), shadowColor: '#000', shadowOffset: { width: 0, height: S(2) }, shadowOpacity: 0.05, shadowRadius: S(4), elevation: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: S(8) }}>
            <Ionicons name="calendar-outline" size={FS(16)} color={COLORS.textLight} />
            <Text style={{ flex: 1, fontSize: FS(14), color: COLORS.textLight }}>Miembro desde</Text>
            <Text style={{ fontSize: FS(14), fontWeight: '600', color: '#1A1A1A' }}>
              {new Date(user?.created_at || Date.now()).toLocaleDateString('es-AR', { year: 'numeric', month: 'long' })}
            </Text>
          </View>
        </View>

        {/* Cerrar sesión */}
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', gap: S(8), marginTop: S(32), paddingVertical: S(16), paddingHorizontal: S(24) }}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={FS(16)} color={COLORS.error} />
          <Text style={{ color: COLORS.error, fontSize: FS(15), fontWeight: '500' }}>Cerrar sesión</Text>
        </TouchableOpacity>

        {/* Versión */}
        <Text style={{ position: 'absolute', bottom: VS(40), fontSize: FS(12), color: COLORS.textLight }}>FitCheck v1.0</Text>
      </View>
    </ScreenWrapper>
  );
}
