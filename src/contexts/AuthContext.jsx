import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

// Helper: Timeout aumentado a 10s para redes lentas/móviles
const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Auth timeout')), ms)),
  ]);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Refs para acceder al estado actual dentro de listeners sin re-renderizar
  const isAuthenticatedRef = useRef(false);
  const currentUserRef = useRef(null); 
  const isRevalidatingRef = useRef(false);

  // Sincronización de Refs (Separados para claridad)
  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // A) LIMPIEZA TOTAL (Para Logout explícito o sesión corrupta confirmada)
  const clearAuthData = useCallback(() => {
    setCurrentUser(null);
    setIsAuthenticated(false);
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        localStorage.removeItem(key);
      }
    });
  }, []);

  // B) LIMPIEZA SUAVE (Para errores de red/timeout - NO borra storage)
  const resetAuthState = useCallback(() => {
    setCurrentUser(null);
    setIsAuthenticated(false);
  }, []);

  const fetchUserProfile = async (userId) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, avatar_url')
        .eq('id', userId)
        .single();

      if (error || !profile) return null;

      const userProfile = {
        id: profile.id,
        name: profile.full_name,
        email: profile.email,
        role: profile.role,
        avatar: profile.avatar_url,
        coachId: null,
        athleteId: null
      };

      if (profile.role === 'profesor') {
        const { data: coach } = await supabase
          .from('coaches')
          .select('id')
          .eq('profile_id', profile.id)
          .maybeSingle();
        if (coach) userProfile.coachId = coach.id;
        
      } else if (profile.role === 'atleta') {
        const { data: athlete } = await supabase
          .from('athletes')
          .select('id, coach_id')
          .eq('profile_id', profile.id)
          .maybeSingle();
        if (athlete) {
          userProfile.athleteId = athlete.id;
          userProfile.coachId = athlete.coach_id;
        }
      }

      return userProfile;
    } catch (err) {
      console.error('[Auth] Error fetching profile:', err);
      return null;
    }
  };

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      clearAuthData(); 
      window.location.href = '/login'; 
    }
  }, [clearAuthData]);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await withTimeout(supabase.auth.getSession(), 10000);

        if (error) throw error;

        if (session?.user) {
          const profile = await fetchUserProfile(session.user.id);
          
          if (mounted) {
            if (profile) {
              setCurrentUser(profile);
              setIsAuthenticated(true);
            } else {
              console.warn('[Auth] Session valid but no profile found.');
              await logout();
            }
          }
        }
      } catch (err) {
        console.warn('[Auth] Init warning:', err.message);
        if (mounted) {
            resetAuthState(); // Solo limpia memoria, no storage (fail-safe)
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        clearAuthData();
        setIsLoading(false);
      } 
      else if (['SIGNED_IN', 'TOKEN_REFRESHED', 'INITIAL_SESSION'].includes(event)) {
        if (session?.user) {
           // Condiciones para forzar recarga de perfil:
           // 1. Es un login nuevo.
           // 2. Es la sesión inicial.
           // 3. El contexto dice que no estamos autenticados.
           // 4. (CRITICO) Estamos autenticados pero NO tenemos perfil cargado (Zombie).
           const needsProfileReload = 
              event === 'SIGNED_IN' || 
              event === 'INITIAL_SESSION' || 
              !isAuthenticatedRef.current || 
              !currentUserRef.current;

           if (needsProfileReload) {
               const profile = await fetchUserProfile(session.user.id);
               
               if (mounted) {
                 if (profile) {
                   setCurrentUser(profile);
                   setIsAuthenticated(true);
                 } else {
                   // CORRECCIÓN FINAL: Si intentamos recargar y fallamos (perfil null),
                   // debemos salir para evitar el loader infinito en ProtectedRoute.
                   console.warn('[Auth] Token refreshed but profile load failed.');
                   await logout(); 
                 }
               }
           }
        }
        setIsLoading(false);
      }
    });

    const handleFocus = async () => {
        if (isRevalidatingRef.current || !isAuthenticatedRef.current) return;

        isRevalidatingRef.current = true;
        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error || !session?.user) {
                console.warn('[Auth] Session lost on focus revalidation.');
                await logout();
            }
        } catch (e) {
            console.error('[Auth] Revalidation error', e);
        } finally {
            isRevalidatingRef.current = false;
        }
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.removeEventListener('focus', handleFocus);
    };
  }, [clearAuthData, resetAuthState, logout]);

  const login = async ({ email, password }) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const profile = await fetchUserProfile(data.user.id);
      if (!profile) throw new Error('Perfil no encontrado.');

      setCurrentUser(profile);
      setIsAuthenticated(true);
      return { user: profile };
      
    } catch (err) {
      // Si falla login (credenciales), no tocamos estado global para no romper UX
      return { error: err };
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;