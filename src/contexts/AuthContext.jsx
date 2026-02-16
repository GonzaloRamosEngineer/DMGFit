import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const resolveUserProfile = async (authUser) => {
    if (!authUser) return null;
    
    try {
      // Optimizamos: Pedimos el perfil
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, avatar_url')
        .eq('id', authUser.id)
        .maybeSingle();

      if (error || !profile) return null;

      const baseProfile = {
        id: profile.id,
        name: profile.full_name,
        email: profile.email,
        role: profile.role,
        avatar: profile.avatar_url,
        coachId: null,
        athleteId: null
      };

      // Carga paralela de datos extra para no "trabar" la sesión
      if (baseProfile.role === 'profesor') {
        const { data: c } = await supabase.from('coaches').select('id').eq('profile_id', profile.id).maybeSingle();
        if (c) baseProfile.coachId = c.id;
      } else if (baseProfile.role === 'atleta') {
        const { data: a } = await supabase.from('athletes').select('id, coach_id').eq('profile_id', profile.id).maybeSingle();
        if (a) {
          baseProfile.athleteId = a.id;
          baseProfile.coachId = a.coach_id;
        }
      }

      return baseProfile;
    } catch (err) {
      console.error("❌ [Auth] Error en resolución:", err);
      return null;
    }
  };

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        // Obtenemos la sesión actual
        const { data: { session }, error } = await supabase.auth.getSession();
        
        // Si hay error de sesión (token corrupto), limpiamos localmente
        if (error) {
          console.warn("⚠️ [Auth] Sesión corrupta detectada, limpiando...");
          await logout();
          return;
        }

        if (session?.user && isMounted) {
          const profile = await resolveUserProfile(session.user);
          if (profile && isMounted) {
            setCurrentUser(profile);
            setIsAuthenticated(true);
          } else if (isMounted) {
            await logout(); // Si no hay perfil, fuera
          }
        }
      } catch (err) {
        console.error("Error inicializando auth:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setIsAuthenticated(false);
        // Limpieza forzada de cualquier rastro en localStorage
        Object.keys(localStorage).forEach(key => {
          if (key.includes('sb-') && key.includes('-auth-token')) localStorage.removeItem(key);
        });
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
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
  }, []); 

  const login = async ({ email, password }) => {
    // Intentamos login
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error };

    const profile = await resolveUserProfile(data.user);
    if (!profile) {
      await logout();
      return { error: { message: "No se encontró un perfil vinculado." } };
    }

    setCurrentUser(profile);
    setIsAuthenticated(true);
    return { user: profile };
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Error en signOut:", err);
    } finally {
      // Limpieza manual definitiva para evitar el problema del Modo Incógnito
      setCurrentUser(null);
      setIsAuthenticated(false);
      localStorage.clear(); // Borra todo para asegurar sesión limpia en el próximo login
      window.location.href = '/login-role-selection'; // Redirección física para resetear estado de React
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;