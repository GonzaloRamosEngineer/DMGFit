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

      // AJUSTE: Si hay error o no existe el perfil, no permitimos el acceso
      // En un sistema cerrado, el perfil DEBE existir antes del login.
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

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user && isMounted) {
        const profile = await resolveUserProfile(session.user);
        
        if (profile) {
          setCurrentUser(profile);
          setIsAuthenticated(true);
        } else {
          // Si hay sesión pero no hay perfil, forzamos el cierre de sesión
          await supabase.auth.signOut();
          setCurrentUser(null);
          setIsAuthenticated(false);
        }
      }
      
      if (isMounted) setIsLoading(false);
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setIsAuthenticated(false);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user && isMounted) {
          const profile = await resolveUserProfile(session.user);
          setCurrentUser(profile);
          setIsAuthenticated(!!profile);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async ({ email, password }) => {
    // 1. Intentar login en Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error };

    // 2. Resolver el perfil vinculado
    const profile = await resolveUserProfile(data.user);
    
    // 3. Si no hay perfil vinculado, impedimos el acceso aunque la contraseña sea correcta
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