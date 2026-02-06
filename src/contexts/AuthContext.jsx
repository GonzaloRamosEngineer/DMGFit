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

// ... (mismos imports y useAuth)

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const resolveUserProfile = async (authUser) => {
    if (!authUser) return null;
    console.log("🔍 [Auth] Resolviendo perfil:", authUser.email);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, avatar_url')
        .eq('id', authUser.id)
        .maybeSingle();

      if (error || !data) {
        return {
          id: authUser.id,
          name: authUser.user_metadata?.full_name || authUser.email,
          email: authUser.email,
          role: 'atleta',
          avatar: authUser.user_metadata?.avatar_url || null
        };
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

      // Carga de datos extra simplificada
      if (baseProfile.role === 'profesor') {
        const { data: c } = await supabase.from('coaches').select('id').eq('profile_id', baseProfile.id).maybeSingle();
        if (c) baseProfile.coachId = c.id;
      } else if (baseProfile.role === 'atleta') {
        const { data: a } = await supabase.from('athletes').select('id, coach_id').eq('profile_id', baseProfile.id).maybeSingle();
        if (a) {
          baseProfile.athleteId = a.id;
          baseProfile.coachId = a.coach_id;
        }
      }

      return baseProfile;
    } catch (err) {
      console.error("❌ [Auth] Error critico:", err);
      return null;
    }
  };

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user && isMounted) {
        const profile = await resolveUserProfile(session.user);
        setCurrentUser(profile);
        setIsAuthenticated(!!profile);
      }
      if (isMounted) setIsLoading(false);
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setIsAuthenticated(false);
      } else if (event === 'PASSWORD_RECOVERY') {
        // Manejar recuperación si fuera necesario
      }
      // No re-buscamos perfil en SIGNED_IN porque la función login() ya lo hace
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async ({ email, password, expectedRole }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error };

    const profile = await resolveUserProfile(data.user);
    
    if (expectedRole && profile?.role !== expectedRole) {
      await supabase.auth.signOut();
      return { error: { message: "No tienes permisos para este acceso." } };
    }

    setCurrentUser(profile);
    setIsAuthenticated(true);
    return { user: profile };
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ currentUser, isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;