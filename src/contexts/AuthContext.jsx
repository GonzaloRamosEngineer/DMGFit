import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const resolveUserProfile = async (authUser) => {
    if (!authUser) return null;
    console.log("🔍 [Auth] Resolviendo perfil:", authUser.email);

    try {
      // 1. Buscamos el perfil en la tabla 'profiles' por ID de Auth
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, avatar_url')
        .eq('id', authUser.id)
        .maybeSingle();

      if (error || !data) {
        console.warn("⚠️ [Auth] Usuario autenticado pero sin perfil en la tabla 'profiles'.");
        return null;
      }

      const baseProfile = {
        id: data.id,
        name: data.full_name,
        email: data.email,
        role: data.role,
        avatar: data.avatar_url,
        coachId: null,
        athleteId: null
      };

      // 2. Carga de datos extra según el rol
      if (baseProfile.role === 'profesor') {
        const { data: c } = await supabase
          .from('coaches')
          .select('id')
          .eq('profile_id', baseProfile.id)
          .maybeSingle();
        if (c) baseProfile.coachId = c.id;
      } else if (baseProfile.role === 'atleta') {
        const { data: a } = await supabase
          .from('athletes')
          .select('id, coach_id')
          .eq('profile_id', baseProfile.id)
          .maybeSingle();
        if (a) {
          baseProfile.athleteId = a.id;
          baseProfile.coachId = a.coach_id;
        }
      }

      return baseProfile;
    } catch (err) {
      console.error("❌ [Auth] Error critico en resolución de perfil:", err);
      return null;
    }
  };

  useEffect(() => {
    let isMounted = true;

    // 1. Carga inicial de la sesión
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && isMounted) {
          const profile = await resolveUserProfile(session.user);
          if (profile && isMounted) {
            setCurrentUser(profile);
            setIsAuthenticated(true);
          } else if (isMounted) {
            // Si hay sesión pero no hay perfil, cerramos sesión por seguridad
            await supabase.auth.signOut();
            setCurrentUser(null);
            setIsAuthenticated(false);
          }
        }
      } catch (err) {
        console.error("Error inicializando auth:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    init();

    // 2. Escuchar cambios de estado de Auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setIsAuthenticated(false);
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          // RESOLUCIÓN DE BUCLE: Solo actualizamos si realmente es un cambio de usuario
          // El listener de Supabase se encarga de disparar esto solo cuando es necesario.
          const profile = await resolveUserProfile(session.user);
          
          if (isMounted) {
            setCurrentUser(profile);
            setIsAuthenticated(!!profile);
          }
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
    // Array de dependencias vacío para evitar re-suscripciones innecesarias
  }, []); 

  const login = async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error };

    const profile = await resolveUserProfile(data.user);
    
    if (!profile) {
      await supabase.auth.signOut();
      return { 
        error: { message: "No se encontró un perfil vinculado a esta cuenta. Contacta al administrador." } 
      };
    }

    setCurrentUser(profile);
    setIsAuthenticated(true);
    return { user: profile };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ currentUser, isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;