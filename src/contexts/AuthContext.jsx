// C:\Projects\DMG Fitness\src\contexts\AuthContext.jsx

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

// Helper: Timeout generoso de 15s para redes móviles/lentas
const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Auth timeout")), ms),
    ),
  ]);

// Helpers de persistencia (ultra-relaxed)
const LAST_KNOWN_PROFILE_KEY = "lastKnownProfile";

const loadLastKnownProfile = () => {
  try {
    const raw = localStorage.getItem(LAST_KNOWN_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const persistLastKnownProfile = (profile) => {
  try {
    if (!profile?.id) return;
    localStorage.setItem(LAST_KNOWN_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // ignore
  }
};

const clearLastKnownProfile = () => {
  try {
    localStorage.removeItem(LAST_KNOWN_PROFILE_KEY);
  } catch {
    // ignore
  }
};

// Fallback profile desde metadata (mejor que null)
const buildFallbackProfile = (user) => {
  const md = user?.user_metadata || {};
  return {
    id: user?.id || null,
    name: md.full_name || user?.email || "Usuario",
    email: user?.email || "",
    role: md.role || null, // OJO: null si no está, luego intentamos lastKnownProfile
    avatar: md.avatar_url || null,
    coachId: null,
    athleteId: null,
  };
};

// Buscar token local de Supabase (sb-*-auth-token)
const findSupabaseTokenKey = () =>
  Object.keys(localStorage).find(
    (key) => key.startsWith("sb-") && key.endsWith("-auth-token"),
  );

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Refs de estado
  const isAuthenticatedRef = useRef(false);
  const currentUserRef = useRef(null);
  const isRevalidatingRef = useRef(false);
  const lastFocusCheckRef = useRef(0);

  // Sincronización de Refs
  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // A) LIMPIEZA TOTAL (Solo para Logout explícito)
  const clearAuthData = useCallback(() => {
    setCurrentUser(null);
    setIsAuthenticated(false);
    clearLastKnownProfile();

    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
        localStorage.removeItem(key);
      }
    });
  }, []);

  // B) LIMPIEZA SUAVE (Solo memoria)
  const resetAuthState = useCallback(() => {
    setCurrentUser(null);
    setIsAuthenticated(false);
  }, []);

  const fetchUserProfile = async (userId) => {
    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, avatar_url")
        .eq("id", userId)
        .single();

      if (error || !profile) return null;

      const userProfile = {
        id: profile.id,
        name: profile.full_name,
        email: profile.email,
        role: profile.role,
        avatar: profile.avatar_url,
        coachId: null,
        athleteId: null,
      };

      if (profile.role === "profesor") {
        const { data: coach } = await supabase
          .from("coaches")
          .select("id")
          .eq("profile_id", profile.id)
          .maybeSingle();
        if (coach) userProfile.coachId = coach.id;
      } else if (profile.role === "atleta") {
        const { data: athlete } = await supabase
          .from("athletes")
          .select("id, coach_id")
          .eq("profile_id", profile.id)
          .maybeSingle();
        if (athlete) {
          userProfile.athleteId = athlete.id;
          userProfile.coachId = athlete.coach_id;
        }
      }

      return userProfile;
    } catch (err) {
      console.error("[Auth] Error fetching profile:", err);
      return null;
    }
  };

  // Helper interno para reintentar la carga del perfil (Grace Pattern)
  const fetchProfileWithRetry = useCallback(async (userId, retries = 2) => {
    for (let i = 0; i <= retries; i++) {
      const profile = await fetchUserProfile(userId);
      if (profile) return profile;
      if (i < retries) await new Promise((r) => setTimeout(r, 800));
    }
    return null;
  }, []);

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      clearAuthData();
      window.location.href = "/login";
    }
  }, [clearAuthData]);

  // Ultra-relaxed: hidratar desde (1) lastKnownProfile, (2) token local metadata
  const hydrateUltraRelaxedFromLocal = useCallback(
    async ({ mounted }) => {
      const tokenKey = findSupabaseTokenKey();
      if (!tokenKey) return false;

      try {
        const raw = localStorage.getItem(tokenKey);
        if (!raw) return false;

        const sessionData = JSON.parse(raw);
        const user = sessionData?.user;
        if (!user?.id) return false;

        // 1) Si tenemos lastKnownProfile del mismo user, usarlo para rol REAL
        const last = loadLastKnownProfile();
        if (last?.id === user.id && last?.role) {
          if (mounted) {
            setIsAuthenticated(true);
            setCurrentUser(last);
          }

          // background refresh
          fetchProfileWithRetry(user.id).then((fullProfile) => {
            if (mounted && fullProfile) {
              setCurrentUser(fullProfile);
              persistLastKnownProfile(fullProfile);
            }
          });

          return true;
        }

        // 2) Si no hay lastKnownProfile, usar metadata local como fallback
        const fallback = buildFallbackProfile(user);

        // Si metadata no trae role, último intento: conservar role previo en memoria
        // (por si hay refresh y currentUserRef aún tenía role)
        if (!fallback.role && currentUserRef.current?.role) {
          fallback.role = currentUserRef.current.role;
        }

        if (mounted) {
          setIsAuthenticated(true);
          setCurrentUser(fallback);
        }

        // background refresh (si viene, persistimos)
        fetchProfileWithRetry(user.id).then((fullProfile) => {
          if (mounted && fullProfile) {
            setCurrentUser(fullProfile);
            persistLastKnownProfile(fullProfile);
          }
        });

        return true;
      } catch (err) {
        console.warn("[Auth] hydrateUltraRelaxedFromLocal failed:", err?.message);
        return false;
      }
    },
    [fetchProfileWithRetry],
  );

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const {
          data: { session },
          error,
        } = await withTimeout(supabase.auth.getSession(), 15000);

        if (error) throw error;

        if (session?.user) {
          // Ultra-relaxed: marcar auth inmediato
          if (mounted) setIsAuthenticated(true);

          // 1) Hidratar inmediato: preferir lastKnownProfile para evitar "No autorizado" en F5
          const last = loadLastKnownProfile();
          if (last?.id === session.user.id && last?.role) {
            if (mounted) setCurrentUser(last);
          } else {
            // 2) Fallback desde metadata para no quedar null
            const fallback = buildFallbackProfile(session.user);
            // si metadata no trae role, mantener lo que hubiera en memoria
            if (!fallback.role && currentUserRef.current?.role) {
              fallback.role = currentUserRef.current.role;
            }
            if (mounted) setCurrentUser(fallback);
          }

          // 3) Perfil real en background con retry + persist
          fetchProfileWithRetry(session.user.id).then((profile) => {
            if (mounted && profile) {
              setCurrentUser(profile);
              persistLastKnownProfile(profile);
            }
          });
        } else {
          // No session: intentar hidratar desde token local (ultra-relaxed)
          const hydrated = await hydrateUltraRelaxedFromLocal({ mounted });
          if (!hydrated && mounted) {
            resetAuthState();
          }
        }
      } catch (err) {
        console.warn("[Auth] Init warning:", err?.message);

        // Ultra-relaxed: ante timeout/red -> hidratar desde local en vez de expulsar
        const hydrated = await hydrateUltraRelaxedFromLocal({ mounted });
        if (!hydrated && mounted) {
          resetAuthState();
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === "SIGNED_OUT" || event === "USER_DELETED") {
        clearAuthData();
        setIsLoading(false);
        return;
      }

      if (["SIGNED_IN", "TOKEN_REFRESHED", "INITIAL_SESSION"].includes(event)) {
        if (session?.user) {
          setIsAuthenticated(true);

          // Ultra-relaxed: fallback inmediato SIEMPRE para evitar null y evitar "No autorizado"
          const last = loadLastKnownProfile();
          if (
            last?.id === session.user.id &&
            last?.role &&
            (!currentUserRef.current || currentUserRef.current.id !== session.user.id)
          ) {
            setCurrentUser(last);
          } else if (
            !currentUserRef.current ||
            currentUserRef.current.id !== session.user.id ||
            !currentUserRef.current.role
          ) {
            const fallback = buildFallbackProfile(session.user);
            if (!fallback.role && currentUserRef.current?.role) {
              fallback.role = currentUserRef.current.role;
            }
            setCurrentUser(fallback);
          }

          // Perfil real en background + persist
          fetchProfileWithRetry(session.user.id).then((profile) => {
            if (mounted && profile) {
              setCurrentUser(profile);
              persistLastKnownProfile(profile);
            }
          });
        }

        setIsLoading(false);
      }
    });

    const handleFocus = async () => {
      // Cooldown 15s
      const now = Date.now();
      if (now - lastFocusCheckRef.current < 15000) return;
      lastFocusCheckRef.current = now;

      if (isRevalidatingRef.current || !isAuthenticatedRef.current) return;

      isRevalidatingRef.current = true;
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        // Ultra-relaxed: NO logout por errores transitorios
        if (error) throw error;

        if (!session) {
          // En ultra-relaxed, antes de logout intentamos hidratar desde local
          const hydrated = await hydrateUltraRelaxedFromLocal({ mounted });
          if (!hydrated) {
            // Si no hay sesión ni token local, ahí sí: reset (no logout agresivo)
            console.warn("[Auth] Session explicitly lost on focus. Resetting.");
            resetAuthState();
          }
        }
      } catch (e) {
        console.warn("[Auth] Revalidation check failed (network?):", e?.message);
        // no-op
      } finally {
        isRevalidatingRef.current = false;
      }
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.removeEventListener("focus", handleFocus);
    };
  }, [
    clearAuthData,
    resetAuthState,
    fetchProfileWithRetry,
    hydrateUltraRelaxedFromLocal,
  ]);

  const login = async ({ email, password }) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      // Ultra-relaxed: fallback inmediato (por si perfil tarda)
      const fallback = buildFallbackProfile(data.user);
      setCurrentUser(fallback);
      setIsAuthenticated(true);

      // Perfil real con retry
      const profile = await fetchProfileWithRetry(data.user.id);
      if (!profile)
        throw new Error("No se pudo cargar el perfil. Intente nuevamente.");

      setCurrentUser(profile);
      setIsAuthenticated(true);
      persistLastKnownProfile(profile);

      return { user: profile };
    } catch (err) {
      return { error: err };
    }
  };

  return (
    <AuthContext.Provider
      value={{ currentUser, isAuthenticated, isLoading, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
