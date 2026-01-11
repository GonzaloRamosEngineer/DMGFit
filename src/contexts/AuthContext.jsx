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

  // Función auxiliar robusta para obtener perfil
  const resolveUserProfile = async (authUser) => {
    if (!authUser) return null;

    console.log("🔍 [AuthContext] Buscando perfil para:", authUser.email);

    try {
      // 1. Intentar buscar en tabla profiles
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, avatar_url')
        .eq('id', authUser.id)
        .maybeSingle(); // Usamos maybeSingle en lugar de single para evitar errores si no existe

      // Si hay error o no hay datos, creamos un perfil temporal basado en la info de auth
      if (error || !data) {
        console.warn("⚠️ [AuthContext] No se encontró perfil en DB o hubo error:", error?.message);
        return {
          id: authUser.id,
          name: authUser.user_metadata?.full_name || authUser.email,
          email: authUser.email,
          role: 'atleta', // Rol por defecto (fallback)
          avatar: authUser.user_metadata?.avatar_url || null
        };
      }

      // 2. Si encontramos perfil, construimos el objeto base
      const baseProfile = {
        id: data.id,
        name: data.full_name || authUser.email,
        email: data.email || authUser.email,
        role: data.role || 'atleta',
        avatar: data.avatar_url || null,
        coachId: null,
        athleteId: null
      };

      console.log("✅ [AuthContext] Perfil base encontrado. Rol:", baseProfile.role);

      // 3. Buscar datos extra según el rol (sin bloquear si falla)
      try {
        if (baseProfile.role === 'profesor') {
          const { data: coachData } = await supabase
            .from('coaches')
            .select('id')
            .eq('profile_id', baseProfile.id)
            .maybeSingle();
          
          if (coachData) baseProfile.coachId = coachData.id;
        } 
        else if (baseProfile.role === 'atleta') {
          const { data: athleteData } = await supabase
            .from('athletes')
            .select('id, coach_id')
            .eq('profile_id', baseProfile.id)
            .maybeSingle();

          if (athleteData) {
            baseProfile.athleteId = athleteData.id;
            baseProfile.coachId = athleteData.coach_id;
          }
        }
      } catch (extraError) {
        console.error("⚠️ [AuthContext] Error cargando datos extra de rol:", extraError);
        // No lanzamos error, simplemente devolvemos el perfil base
      }

      return baseProfile;

    } catch (criticalError) {
      console.error("❌ [AuthContext] Error CRÍTICO en resolveUserProfile:", criticalError);
      // Fallback de emergencia para que la app no se cuelgue
      return {
        id: authUser.id,
        email: authUser.email,
        role: 'atleta',
        name: authUser.email
      };
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initializeSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!isMounted) return;

        const sessionUser = data?.session?.user || null;
        if (sessionUser) {
          const profileUser = await resolveUserProfile(sessionUser);
          if (isMounted) {
            setCurrentUser(profileUser);
            setIsAuthenticated(true);
          }
        } else {
            if (isMounted) {
                setCurrentUser(null);
                setIsAuthenticated(false);
            }
        }
      } catch (err) {
        console.error("Error inicializando sesión:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    initializeSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`🔔 [Auth Event] ${event}`);
      const sessionUser = session?.user || null;
      
      // Solo resolvemos el perfil si hay usuario y NO es un evento de Login inicial
      // (para evitar doble fetch, ya que la función login() ya lo hace)
      if (sessionUser && event !== 'SIGNED_IN') {
        const profileUser = await resolveUserProfile(sessionUser);
        if (isMounted) {
            setCurrentUser(profileUser);
            setIsAuthenticated(Boolean(profileUser));
        }
      } else if (!sessionUser) {
        if (isMounted) {
            setCurrentUser(null);
            setIsAuthenticated(false);
        }
      }
    });

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const login = async ({ email, password, expectedRole }) => {
    console.log("🚀 [AuthContext] Iniciando login...");
    
    // 1. Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error("❌ [AuthContext] Error en signInWithPassword:", error.message);
      return { error };
    }

    console.log("✅ [AuthContext] Auth correcta. Recuperando perfil...");

    // 2. Resolver Perfil (Ahora blindado con try/catch interno)
    const profileUser = await resolveUserProfile(data?.user);

    // 3. Verificar Rol (si aplica)
    if (expectedRole && profileUser?.role && profileUser?.role !== expectedRole) {
      console.warn("⚠️ [AuthContext] Rol incorrecto.");
      await supabase.auth.signOut();
      return { error: new Error('role_mismatch') };
    }

    // 4. Actualizar estado
    setCurrentUser(profileUser);
    setIsAuthenticated(true);
    
    console.log("🎉 [AuthContext] Login completado exitosamente. Usuario:", profileUser);
    return { user: profileUser };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  const value = {
    currentUser,
    isAuthenticated,
    isLoading,
    login,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;