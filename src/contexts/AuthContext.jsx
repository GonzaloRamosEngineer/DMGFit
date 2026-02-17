import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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

  const clearSupabaseAuthStorage = useCallback(() => {
    Object.keys(localStorage).forEach((key) => {
      if (key.includes('sb-') && key.includes('-auth-token')) {
        localStorage.removeItem(key);
      }
    });
  }, []);

  const resolveUserProfile = async (authUser) => {
    if (!authUser) return null;

    try {
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

      if (baseProfile.role === 'profesor') {
        const { data: c } = await supabase
          .from('coaches')
          .select('id')
          .eq('profile_id', profile.id)
          .maybeSingle();
        if (c) baseProfile.coachId = c.id;
      } else if (baseProfile.role === 'atleta') {
        const { data: a } = await supabase
          .from('athletes')
          .select('id, coach_id')
          .eq('profile_id', profile.id)
          .maybeSingle();
        if (a) {
          baseProfile.athleteId = a.id;
          baseProfile.coachId = a.coach_id;
        }
      }

      return baseProfile;
    } catch (err) {
      console.error('❌ [Auth] Error en resolución:', err);
      return null;
    }
  };

  const forceClientLogoutState = useCallback(() => {
    setCurrentUser(null);
    setIsAuthenticated(false);
    clearSupabaseAuthStorage();
  }, [clearSupabaseAuthStorage]);

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Error en signOut:', err);
    } finally {
      forceClientLogoutState();
      window.location.href = '/login';
    }
  };

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        const {
          data: { session },
          error
        } = await supabase.auth.getSession();

        if (error) {
          console.warn('⚠️ [Auth] Sesión corrupta detectada, limpiando...');
          forceClientLogoutState();
          return;
        }

        if (session?.user && isMounted) {
          const profile = await resolveUserProfile(session.user);
          if (profile && isMounted) {
            setCurrentUser(profile);
            setIsAuthenticated(true);
          } else if (isMounted) {
            forceClientLogoutState();
          }
        } else if (isMounted) {
          setCurrentUser(null);
          setIsAuthenticated(false);
        }
      } catch (err) {
        console.error('Error inicializando auth:', err);
        if (isMounted) forceClientLogoutState();
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    const revalidateOnFocus = async () => {
      if (!isMounted) return;

      const {
        data: { session },
        error
      } = await supabase.auth.getSession();

      if (error || !session?.user) {
        // Si estaba autenticado y perdió sesión (expirada / inválida), redirigir limpio
        if (isMounted && isAuthenticated) {
          await logout();
        } else {
          forceClientLogoutState();
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        revalidateOnFocus();
      }
    };

    init();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === 'SIGNED_OUT') {
        forceClientLogoutState();
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          const profile = await resolveUserProfile(session.user);
          if (isMounted) {
            setCurrentUser(profile);
            setIsAuthenticated(!!profile);
          }
        } else {
          forceClientLogoutState();
        }
      }
    });

    window.addEventListener('focus', revalidateOnFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      window.removeEventListener('focus', revalidateOnFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [forceClientLogoutState, isAuthenticated]);

  const login = async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error };

    const profile = await resolveUserProfile(data.user);
    if (!profile) {
      await logout();
      return { error: { message: 'No se encontró un perfil vinculado.' } };
    }

    setCurrentUser(profile);
    setIsAuthenticated(true);
    return { user: profile };
  };

  return (
    <AuthContext.Provider value={{ currentUser, isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
