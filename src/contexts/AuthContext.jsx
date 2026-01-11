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
    if (!authUser) {
      return null;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, avatar_url')
      .eq('id', authUser?.id)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return {
        id: authUser?.id,
        name: authUser?.user_metadata?.full_name || authUser?.email,
        email: authUser?.email,
        role: 'atleta',
        avatar: authUser?.user_metadata?.avatar_url || null
      };
    }

    return {
      id: data?.id,
      name: data?.full_name || authUser?.email,
      email: data?.email || authUser?.email,
      role: data?.role || 'atleta',
      avatar: data?.avatar_url || null
    };
  };

  useEffect(() => {
    let isMounted = true;

    const initializeSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) {
        return;
      }
      const sessionUser = data?.session?.user || null;
      if (sessionUser) {
        const profileUser = await resolveUserProfile(sessionUser);
        if (isMounted) {
          setCurrentUser(profileUser);
          setIsAuthenticated(true);
        }
      } else {
        setCurrentUser(null);
        setIsAuthenticated(false);
      }
      if (isMounted) {
        setIsLoading(false);
      }
    };

    initializeSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const sessionUser = session?.user || null;
      const profileUser = await resolveUserProfile(sessionUser);
      if (isMounted) {
        setCurrentUser(profileUser);
        setIsAuthenticated(Boolean(profileUser));
      }
    });

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const login = async ({ email, password, expectedRole }) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return { error };
    }

    const profileUser = await resolveUserProfile(data?.user);
    if (expectedRole && profileUser?.role && profileUser?.role !== expectedRole) {
      await supabase.auth.signOut();
      return { error: new Error('role_mismatch') };
    }

    setCurrentUser(profileUser);
    setIsAuthenticated(true);
    return { user: profileUser };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  const switchRole = (newRole) => {
    if (currentUser) {
      const updatedUser = { ...currentUser, role: newRole };
      setCurrentUser(updatedUser);
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
    }
  };

  const value = {
    currentUser,
    isAuthenticated,
    isLoading,
    login,
    logout,
    switchRole
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
