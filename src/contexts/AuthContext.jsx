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

/**
 * Ultra-relaxed mode:
 * - Nunca cerramos sesión automáticamente por fallos de red/timeout.
 * - Si existe token local o session.user, hidratamos un fallbackProfile inmediato (desde metadata).
 * - Intentamos cargar el perfil real en background; si falla, no bloquea ni desloguea.
 * - En focus, si getSession no devuelve sesión, NO hacemos logout (solo log).
 */
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
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
        localStorage.removeItem(key);
      }
    });
  }, []);

  // B) LIMPIEZA SUAVE (Solo memoria)
  // Nota: en modo ultra-relajado, la usamos sólo cuando NO hay token local o el token está corrupto.
  const resetAuthState = useCallback(() => {
    setCurrentUser(null);
    setIsAuthenticated(false);
  }, []);

  // Helper: encontrar tokenKey de Supabase en localStorage
  const findSupabaseTokenKey = useCallback(() => {
    return Object.keys(localStorage).find(
      (key) => key.startsWith("sb-") && key.endsWith("-auth-token"),
    );
  }, []);

  // Helper: construir fallbackProfile desde user/user_metadata
  const buildFallbackProfile = useCallback((user) => {
    const md = user?.user_metadata || {};
    return {
      id: user?.id,
      name: md.full_name || user?.email || "Usuario",
      email: user?.email || md.email || "",
      role: md.role || "atleta",
      avatar: md.avatar_url || null,
      coachId: null,
      athleteId: null,
    };
  }, []);

  // Helper: hidratar desde token local (instantáneo)
  const hydrateFromLocalToken = useCallback(
    async ({ mounted, reason = "unknown" } = {}) => {
      const tokenKey = findSupabaseTokenKey();
      if (!tokenKey) return false;

      try {
        const raw = localStorage.getItem(tokenKey);
        if (!raw) return false;

        const sessionData = JSON.parse(raw);
        const user = sessionData?.user;

        if (!user) return false;

        if (mounted) {
          console.log(
            `[Auth] Hydrating fallback profile from local token (${reason}).`,
          );
          setIsAuthenticated(true);
          setCurrentUser(buildFallbackProfile(user));
        }

        // Background: intentar cargar perfil completo (sin bloquear ni desloguear)
        fetchProfileWithRetry(user.id).then((fullProfile) => {
          if (mounted && fullProfile) {
            console.log("[Auth] Full profile loaded in background.");
            setCurrentUser(fullProfile);
          }
        });

        return true;
      } catch (e) {
        console.warn("[Auth] Failed to parse local token:", e?.message || e);
        return false;
      }
    },
    [findSupabaseTokenKey, buildFallbackProfile],
  );

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
  const fetchProfileWithRetry = useCallback(
    async (userId, retries = 2) => {
      for (let i = 0; i <= retries; i++) {
        const profile = await fetchUserProfile(userId);
        if (profile) return profile;
        if (i < retries) await new Promise((r) => setTimeout(r, 800));
      }
      return null;
    },
    [], // fetchUserProfile es estable por scope; si la movés a useCallback, agregala aquí.
  );

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

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // 1) Intentamos sesión inicial con timeout
        const {
          data: { session },
          error,
        } = await withTimeout(supabase.auth.getSession(), 15000);

        if (error) throw error;

        if (session?.user) {
          // Ultra-relaxed: marcamos auth true y ponemos fallback inmediato (sin esperar DB)
          if (mounted) {
            setIsAuthenticated(true);
            setCurrentUser(buildFallbackProfile(session.user));
          }

          // Background: perfil completo
          fetchProfileWithRetry(session.user.id).then((profile) => {
            if (mounted && profile) setCurrentUser(profile);
          });
        } else {
          // No session: igual intentamos token local (por si getSession no devolvió pero hay storage)
          const hydrated = await hydrateFromLocalToken({
            mounted,
            reason: "init-no-session",
          });

          // Si no hay nada en local, dejamos público
          if (!hydrated && mounted) {
            resetAuthState();
          }
        }
      } catch (err) {
        console.warn("[Auth] Init warning:", err?.message || err);

        const isTimeout = String(err?.message || "")
          .toLowerCase()
          .includes("timeout");

        // Ultra-relaxed: si hay token local, siempre hidratamos fallback (sea timeout o no)
        const hydrated = await hydrateFromLocalToken({
          mounted,
          reason: isTimeout ? "init-timeout" : "init-error",
        });

        // Si NO pudimos hidratar y no hay token, dejamos público
        if (!hydrated && mounted) {
          console.warn("[Auth] Init failed and no local token. Staying public.");
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
        // Estos sí son eventos reales: limpiamos (logout explícito o borrado)
        clearAuthData();
        setIsLoading(false);
        return;
      }

      if (["SIGNED_IN", "TOKEN_REFRESHED", "INITIAL_SESSION"].includes(event)) {
        if (session?.user) {
          // Ultra-relaxed: fallback inmediato (siempre)
          setIsAuthenticated(true);

          // Si ya teníamos usuario, no lo pisamos con null. Solo pisamos si no hay currentUser o cambia el id.
          const shouldSetFallback =
            !currentUserRef.current ||
            currentUserRef.current?.id !== session.user.id;

          if (shouldSetFallback) {
            setCurrentUser(buildFallbackProfile(session.user));
          }

          // Background: perfil completo
          fetchProfileWithRetry(session.user.id).then((profile) => {
            if (mounted && profile) setCurrentUser(profile);
          });
        } else {
          // Evento sin session.user: en ultra-relaxed, intentamos token local y si no, no hacemos nada agresivo.
          await hydrateFromLocalToken({
            mounted,
            reason: `listener-${event}-no-session`,
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

        if (error) throw error;

        if (!session) {
          // Ultra-relaxed: NO logout aunque session sea null.
          console.warn(
            "[Auth] Session not present on focus. Keeping relaxed session (no logout).",
          );

          // Intentamos re-hidratar desde storage por si el SDK no devolvió session
          await hydrateFromLocalToken({ mounted, reason: "focus-no-session" });

          // Importante: NO hacemos resetAuthState acá para no echarlo.
        }
      } catch (e) {
        // Si es error de red/timeout/fetch failed, lo ignoramos.
        console.warn("[Auth] Revalidation check failed (network?):", e?.message);
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
    logout,
    fetchProfileWithRetry,
    buildFallbackProfile,
    hydrateFromLocalToken,
  ]);

  const login = async ({ email, password }) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      // Ultra-relaxed: fallback inmediato
      setIsAuthenticated(true);
      setCurrentUser(buildFallbackProfile(data.user));

      // Background: perfil completo
      const profile = await fetchProfileWithRetry(data.user.id);
      if (profile) setCurrentUser(profile);

      return { user: profile || buildFallbackProfile(data.user) };
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
