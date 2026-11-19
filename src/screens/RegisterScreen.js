/**
 * RegisterScreen — Registro responsive con ScreenWrapper
 * ======================================================
 */

import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../constants/theme';
import { useAppScale } from '../utils/responsive';
import ScreenWrapper from '../components/ScreenWrapper';

export default function RegisterScreen({ navigation }) {
  const { scale, fontScale, verticalScale } = useAppScale();
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleRegister = async () => {
    setErrorMsg('');
    if (!email.trim() || !password.trim() || !confirm.trim()) {
      setErrorMsg('Completá todos los campos');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (password !== confirm) {
      setErrorMsg('Las contraseñas no coinciden');
      return;
    }
    setLoading(true);
    try {
      const { error } = await register(email.trim(), password);
      if (error) throw error;
    } catch (e) {
      const msgs = {
        'User already registered': 'Ya hay una cuenta con ese email. Iniciá sesión.',
        'Password should be at least 6 characters': 'Contraseña muy débil',
        'Invalid email': 'Email inválido',
      };
      setErrorMsg(msgs[e.message] || e.message || 'No se pudo crear la cuenta');
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
          {/* Back button */}
          <TouchableOpacity
            style={{ position: 'absolute', top: VS(16), left: S(8), zIndex: 10, padding: S(8) }}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={FS(24)} color={COLORS.primary} />
          </TouchableOpacity>

          <Text style={{ fontSize: FS(32), fontWeight: '700', color: COLORS.primary, textAlign: 'center' }}>
            Crear cuenta
          </Text>
          <Text style={{ fontSize: FS(14), color: COLORS.textLight, textAlign: 'center', marginBottom: VS(36), letterSpacing: 0.8 }}>
            Unite a FitCheck
          </Text>

          {/* Email */}
          <View style={{ marginBottom: S(16) }}>
            <Text style={{ fontSize: FS(12), fontWeight: '600', color: COLORS.text, marginBottom: S(4), letterSpacing: 0.5, textTransform: 'uppercase' }}>EMAIL</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderWidth: 1, borderColor: '#E8E0D6', borderRadius: S(12), paddingHorizontal: S(16) }}>
              <Ionicons name="mail-outline" size={FS(18)} color="#8A8A8A" style={{ marginRight: S(8) }} />
              <TextInput
                style={{ flex: 1, paddingVertical: S(16), fontSize: FS(15), color: '#1A1A1A' }}
                placeholder="tucorreo@ejemplo.com"
                placeholderTextColor="#8A8A8A"
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
              <Ionicons name="lock-closed-outline" size={FS(18)} color="#8A8A8A" style={{ marginRight: S(8) }} />
              <TextInput
                style={{ flex: 1, paddingVertical: S(16), fontSize: FS(15), color: '#1A1A1A' }}
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor="#8A8A8A"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Confirmar */}
          <View style={{ marginBottom: S(16) }}>
            <Text style={{ fontSize: FS(12), fontWeight: '600', color: COLORS.text, marginBottom: S(4), letterSpacing: 0.5, textTransform: 'uppercase' }}>CONFIRMAR CONTRASEÑA</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderWidth: 1, borderColor: '#E8E0D6', borderRadius: S(12), paddingHorizontal: S(16) }}>
              <Ionicons name="lock-open-outline" size={FS(18)} color="#8A8A8A" style={{ marginRight: S(8) }} />
              <TextInput
                style={{ flex: 1, paddingVertical: S(16), fontSize: FS(15), color: '#1A1A1A' }}
                placeholder="Repetí la contraseña"
                placeholderTextColor="#8A8A8A"
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>
          </View>

          {errorMsg ? (
            <View style={{
              backgroundColor: '#FDECEE', borderWidth: 1, borderColor: '#E6B7BE',
              borderRadius: S(10), padding: S(12), marginBottom: S(12),
            }}>
              <Text style={{ color: COLORS.primary, fontSize: FS(13), textAlign: 'center' }}>
                {errorMsg}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={{
              backgroundColor: COLORS.primary, borderRadius: S(12), paddingVertical: S(16),
              alignItems: 'center', marginTop: S(4),
              shadowColor: COLORS.primary, shadowOffset: { width: 0, height: VS(4) },
              shadowOpacity: 0.2, shadowRadius: FS(8), elevation: 4,
            }}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: S(8) }}>
                <Text style={{ color: '#fff', fontSize: FS(16), fontWeight: '600' }}>Crear cuenta</Text>
                <Ionicons name="arrow-forward" size={FS(18)} color="#fff" />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.goBack()} style={{ alignItems: 'center', marginTop: S(24) }}>
            <Text style={{ color: COLORS.primary, fontSize: FS(14), fontWeight: '500' }}>
              ¿Ya tenés cuenta? Iniciá sesión
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}
