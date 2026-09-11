/**
 * FitCheck — App Principal
 * =========================
 *
 * 1. AuthProvider envuelve toda la app con el estado de autenticación
 * 2. RootNavigator decide qué pantallas mostrar según la sesión
 * 3. En web: contenedor de 428px (el ancho y el centrado REAL los fuerza
 *    el CSS en public/index.html con !important — ver webTemplate.js)
 * 4. En mobile: sin cambios, la app ocupa todo el ancho nativo
 */

import { Platform, View } from 'react-native';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/AppNavigator';

// Backup en React Native (el CSS de public/index.html es el que manda en web)
const WEB_CONTAINER_STYLE = Platform.OS === 'web'
  ? {
      flex: 1,
      width: '100%',
      maxWidth: 428,
      alignSelf: 'center',
      backgroundColor: '#ffffff',
      overflow: 'hidden',
    }
  : undefined;

export default function App() {
  return (
    <AuthProvider>
      {Platform.OS === 'web' ? (
        <View style={WEB_CONTAINER_STYLE}>
          <RootNavigator />
        </View>
      ) : (
        <RootNavigator />
      )}
    </AuthProvider>
  );
}