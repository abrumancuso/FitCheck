/**
 * LoginScreen — Auth responsive con ScreenWrapper
 * ================================================
 * ScreenWrapper da SafeArea + background.
 * KeyboardAvoidingView maneja el teclado.
 */

import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../constants/theme';
import { useAppScale } from '../utils/responsive';
import ScreenWrapper from '../components/ScreenWrapper';

export default function LoginScreen({ navigation }) {
  const { scale, fontScale, verticalScale } = useAppScale();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      return Alert.alert('Atención', 'Completá todos los campos');
    }
    setLoading(true);
    try {
      const { error } = await login(email.trim(), password);
      if (error) throw error;
    } catch (e) {
      const msgs = {
        'Invalid login credentials': 'Email o contraseña incorrectos',
        'Email not confirmed': 'Confirmá tu email antes de iniciar sesión',
        'Invalid email': 'Email inválido',
      };
      Alert.alert('Error', msgs[e.message] || e.message);
    } finally {
      setLoading(false);
    }
  };

  const S = (n) => scale(n);
  const FS = (n) => fontScale(n);
  const VS = (n) => verticalScale(n);

  return (
    <ScreenWrapper horizontalPadding={false}>
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'center', paddingHorizontal: S(32) }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={{ width: '100%' }}>
          <Text style={{ fontSize: FS(40), fontWeight: '700', color: COLORS.primary, textAlign: 'center', letterSpacing: 1.5 }}>
            FitCheck
          </Text>
          <Text style={{ fontSize: FS(14), color: COLORS.textLight, textAlign: 'center', marginBottom: VS(48), letterSpacing: 0.8 }}>
            Tu guardarropas inteligente
          </Text>

          {/* Email */}
          <View style={{ marginBottom: S(16) }}>
            <Text style={{ fontSize: FS(12), fontWeight: '600', color: COLORS.text, marginBottom: S(4), letterSpacing: 0.5, textTransform: 'uppercase' }}>EMAIL</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderWidth: 1, borderColor: '#E8E0D6', borderRadius: S(12), paddingHorizontal: S(16) }}>
              <Ionicons name="mail-outline" size={FS(18)} color={COLORS.textLight} style={{ marginRight: S(8) }} />
              <TextInput
                style={{ flex: 1, paddingVertical: S(16), fontSize: FS(15), color: COLORS.text }}
                placeholder="tucorreo@ejemplo.com"
                placeholderTextColor={COLORS.textLight}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Contraseña */}
          <View style={{ marginBottom: S(16) }}>
            <Text style={{ fontSize: FS(12), fontWeight: '600', color: COLORS.text, marginBottom: S(4), letterSpacing: 0.5, textTransform: 'uppercase' }}>CONTRASEÑA</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderWidth: 1, borderColor: '#E8E0D6', borderRadius: S(12), paddingHorizontal: S(16) }}>
              <Ionicons name="lock-closed-outline" size={FS(18)} color={COLORS.textLight} style={{ marginRight: S(8) }} />
              <TextInput
                style={{ flex: 1, paddingVertical: S(16), fontSize: FS(15), color: COLORS.text }}
                placeholder="••••••••"
                placeholderTextColor={COLORS.textLight}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>
          </View>

          <TouchableOpacity
            style={{
              backgroundColor: COLORS.primary, borderRadius: S(12), paddingVertical: S(16),
              alignItems: 'center', marginTop: S(4),
              shadowColor: COLORS.primary, shadowOffset: { width: 0, height: VS(4) },
              shadowOpacity: 0.2, shadowRadius: FS(8), elevation: 4,
            }}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S(8) }}>
                <Text style={{ color: '#fff', fontSize: FS(16), fontWeight: '600' }}>Iniciar sesión</Text>
                <Ionicons name="arrow-forward" size={FS(18)} color="#fff" />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Register')} style={{ alignItems: 'center', marginTop: S(24) }}>
            <Text style={{ color: COLORS.primary, fontSize: FS(14), fontWeight: '500' }}>
              ¿No tenés cuenta? Registrate
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}
