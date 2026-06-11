/**
 * ScreenWrapper — Contenedor global para TODAS las pantallas
 * ===========================================================
 *
 * Uso básico:
 *   <ScreenWrapper><Text>Hola</Text></ScreenWrapper>
 *
 * Con ScrollView:
 *   <ScreenWrapper scrollable>
 *     <Text>Scroll infinito</Text>
 *   </ScreenWrapper>
 *
 * Sin padding horizontal (para pantallas tipo galería):
 *   <ScreenWrapper horizontalPadding={false}>
 *     <FlatList ... />
 *   </ScreenWrapper>
 *
 * ¿Qué hace automáticamente?
 *   ✅ SafeAreaView superior (respeta notch + barra de estado)
 *   ✅ Padding horizontal responsive con scale()
 *   ✅ Background color consistente
 *   ✅ ScrollView opcional integrado
 *   ✅ RefreshControl opcional
 *   ✅ Sin margins manuales harcodeados
 */

import { ScrollView, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/theme';
import { useAppScale } from '../utils/responsive';

export default function ScreenWrapper({
  children,
  /** Array de edges para SafeAreaView. Por defecto solo top. */
  edges = ['top'],
  /** Si true, envuelve children en un ScrollView */
  scrollable = false,
  /** Si true, agrega padding horizontal responsive */
  horizontalPadding = true,
  /** Props para RefreshControl (solo si scrollable) */
  refreshing,
  onRefresh,
  /** Estilos adicionales para el contenedor interno */
  style,
}) {
  const { scale } = useAppScale();
  const s = (n) => scale(n);

  const paddingHorizontal = horizontalPadding ? s(24) : 0;
  const containerStyle = [
    { flex: 1, backgroundColor: COLORS.background },
    style,
  ];

  // Modo con ScrollView
  if (scrollable) {
    return (
      <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: COLORS.background }}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal,
            paddingBottom: s(40),
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            refreshing !== undefined ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Modo plano (FlatList, contenido estático, etc.)
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View style={[{ flex: 1, paddingHorizontal }, containerStyle]}>
        {children}
      </View>
    </SafeAreaView>
  );
}
