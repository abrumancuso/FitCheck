/**
 * AuthContext — Estado global de autenticación
 * =============================================
 *
 * Provee a TODA la app de:
 *   - user            → el usuario actual (o null si no hay sesión)
 *   - loading         → true mientras Supabase verifica si hay sesión
 *   - bodyPhotoUrl    → URL de la foto de cuerpo guardada en user_metadata
 *   - bodyPhotoVersion→ número de versión (cache-busting al reemplazarla)
 *   - syncUser()      → refresca el usuario después de actualizar metadata
 *   - login()         → inicia sesión con email + contraseña
 *   - register()      → crea una cuenta nueva
 *   - logout()        → cierra la sesión
 */

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../config/supabaseClient';
import { getBodyPhotoUrl, getBodyPhotoVersion } from '../services/bodyPhotoService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = (email, password) => {
    return supabase.auth.signInWithPassword({ email, password });
  };

  const register = async (email, password) => {
    const result = await supabase.auth.signUp({ email, password });
    // En la web el evento onAuthStateChange a veces no llega a tiempo.
    // Seteamos el usuario desde la propia respuesta para entrar igual.
    if (result.data?.session?.user) {
      setUser(result.data.session.user);
    }
    return result;
  };

  const logout = () => {
    return supabase.auth.signOut();
  };

  /**
   * Después de un `auth.updateUser` usamos el usuario que devuelve la propia
   * llamada (si viene) para no hacer otro request. Si no viene, lo buscamos.
   * De esta forma TODA la app ve la nueva foto sin recargar ni re-loguearse.
   */
  const syncUser = useCallback(async (freshUser) => {
    if (freshUser) {
      setUser(freshUser);
      return freshUser;
    }
    const { data: { user: current } } = await supabase.auth.getUser();
    if (current) setUser(current);
    return current;
  }, []);

  const bodyPhotoUrl = getBodyPhotoUrl(user);
  const bodyPhotoVersion = getBodyPhotoVersion(user);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      bodyPhotoUrl,
      bodyPhotoVersion,
      syncUser,
      login,
      register,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
}
