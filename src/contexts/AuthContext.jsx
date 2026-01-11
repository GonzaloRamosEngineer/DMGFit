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

  useEffect(() => {
    let isMounted = true;

    const fetchProfile = async (userId) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, role, full_name, avatar_url, coach_id, athlete_id')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
      }

      return data;
    };

    const buildUser = (sessionUser, profile) => ({
      id: profile?.id ?? sessionUser?.id,
      email: sessionUser?.email,
      role: profile?.role ?? sessionUser?.user_metadata?.role,
      name: profile?.full_name ?? sessionUser?.user_metadata?.full_name ?? sessionUser?.email,
      avatar: profile?.avatar_url ?? sessionUser?.user_metadata?.avatar_url,
      coach_id: profile?.coach_id ?? sessionUser?.user_metadata?.coach_id,
      coachId: profile?.coach_id ?? sessionUser?.user_metadata?.coach_id,
      athlete_id: profile?.athlete_id ?? sessionUser?.user_metadata?.athlete_id,
      athleteId: profile?.athlete_id ?? sessionUser?.user_metadata?.athlete_id
    });

    const loadSession = async () => {
      setIsLoading(true);
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error('Error loading session:', error);
      }

      const sessionUser = data?.session?.user;

      if (sessionUser) {
        const profile = await fetchProfile(sessionUser.id);
        if (!isMounted) {
          return;
        }
        setCurrentUser(buildUser(sessionUser, profile));
        setIsAuthenticated(true);
      } else if (isMounted) {
        setCurrentUser(null);
        setIsAuthenticated(false);
      }

      if (isMounted) {
        setIsLoading(false);
      }
    };

    loadSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const sessionUser = session?.user;

      if (sessionUser) {
        const profile = await fetchProfile(sessionUser.id);
        if (!isMounted) {
          return;
        }
        setCurrentUser(buildUser(sessionUser, profile));
        setIsAuthenticated(true);
      } else if (isMounted) {
        setCurrentUser(null);
        setIsAuthenticated(false);
      }

      if (isMounted) {
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  const value = {
    currentUser,
    isAuthenticated,
    isLoading,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
