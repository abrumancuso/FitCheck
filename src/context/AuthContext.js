/**
 * AuthContext — Estado global de autenticación
 * =============================================
 *
 * Provee a TODA la app de:
 *   - user        → el usuario actual (o null si no hay sesión)
 *   - loading     → true mientras Supabase verifica si hay sesión
 *   - login()     → inicia sesión con email + contraseña
 *   - register()  → crea una cuenta nueva
 *   - logout()    → cierra la sesión
 */

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../config/supabaseClient';

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

  const register = (email, password) => {
    return supabase.auth.signUp({ email, password });
  };

  const logout = () => {
    return supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
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
