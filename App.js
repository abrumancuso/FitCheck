/**
 * FitCheck — App Principal
 * =========================
 *
 * 1. AuthProvider envuelve toda la app con el estado de autenticación
 * 2. RootNavigator decide qué pantallas mostrar según la sesión
 */

import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
