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
      // Si falló, esperamos un poco antes de reintentar (Backoff)
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

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Timeout de 15s (Relaxed Mode)
        const {
          data: { session },
          error,
        } = await withTimeout(supabase.auth.getSession(), 15000);

        if (error) throw error;

        if (session?.user) {
          // MICRO-CAMBIO A: Marcamos autenticado inmediatamente si hay sesión válida.
          // Esto evita que ProtectedRoute redirija a Login mientras cargamos el perfil.
          if (mounted) setIsAuthenticated(true);

          // Usamos Retry también en el init para ser más resilientes
          const profile = await fetchProfileWithRetry(session.user.id);

          if (mounted) {
            if (profile) {
              setCurrentUser(profile);
            } else {
              // Si falla el perfil tras reintentos, NO deslogueamos.
              // Dejamos isAuthenticated=true y currentUser=null.
              // ProtectedRoute mostrará "Cargando perfil..." indefinidamente o hasta un refresh,
              // en lugar de expulsar al usuario por un fallo de red.
              console.warn(
                "[Auth] Session valid but profile load failed. UI will show loader.",
              );
            }
          }
        }
        // ... dentro de initializeAuth ...
      } catch (err) {
        console.warn("[Auth] Init warning:", err.message);

        const isTimeout = String(err?.message || "")
          .toLowerCase()
          .includes("timeout");

        if (mounted) {
          // 1. Buscamos el token físico en el navegador
          const tokenKey = Object.keys(localStorage).find(
            (key) => key.startsWith("sb-") && key.endsWith("-auth-token"),
          );

          // 2. Lógica de Resiliencia (Optimistic Mode + Manual Hydration)
          if (isTimeout && tokenKey) {
            console.warn(
              "[Auth] Timeout but local token found. Forcing Optimistic Auth.",
            );
            setIsAuthenticated(true); // Dejamos pasar al usuario

// ... dentro del catch, bloque isTimeout && tokenKey ...

                // --- NUEVO: RESCATE MANUAL DEL PERFIL (MEJORADO) ---
                try {
                    // 1. Decodificamos el token local
                    const sessionData = JSON.parse(localStorage.getItem(tokenKey));
                    const userId = sessionData?.user?.id;
                    
                    if (userId) {
                        console.log('[Auth] Attempting to hydrate profile from local storage ID...');
                        
                        // 2. Buscamos el perfil
                        fetchProfileWithRetry(userId).then(profile => {
                            if (mounted) {
                                if (profile) {
                                    // EXITO: Tenemos perfil, completamos el login
                                    setCurrentUser(profile);
                                    console.log('[Auth] Hydration successful.');
                                } else {
                                    // FALLO: Si después de reintentar no hay perfil, nos rendimos.
                                    // Esto evita que te quedes en "Cargando perfil..." para siempre.
                                    console.warn('[Auth] Hydration failed (profile not found). Resetting.');
                                    resetAuthState();
                                }
                            }
                        });
                    } else {
                        // Token corrupto o sin ID -> Reset
                        resetAuthState();
                    }
                } catch (parseErr) {
                    console.error('[Auth] Failed to parse local token:', parseErr);
                    resetAuthState();
                }
                // ----------------------------------------
          } else {
            // Si no hay token o es un error crítico, reseteamos.
            console.warn(
              "[Auth] Init failed & No local token found. Resetting.",
            );
            resetAuthState();
          }
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
      } else if (
        ["SIGNED_IN", "TOKEN_REFRESHED", "INITIAL_SESSION"].includes(event)
      ) {
        if (session?.user) {
          const needsProfileReload =
            event === "SIGNED_IN" ||
            event === "INITIAL_SESSION" ||
            !isAuthenticatedRef.current ||
            !currentUserRef.current;

          if (needsProfileReload) {
            // Si es un evento de auth, aseguramos que el flag esté en true
            setIsAuthenticated(true);

            const profile = await fetchProfileWithRetry(session.user.id);

            if (mounted) {
              if (profile) {
                setCurrentUser(profile);
              } else {
                // Si falló tras reintentos y no tenemos nada en memoria...
                if (!currentUserRef.current) {
                  console.warn(
                    "[Auth] Critical: Profile load failed after retries. Keeping session active for retry.",
                  );
                  // En modo Relaxed, preferimos no hacer logout automático aquí tampoco,
                  // salvo que queramos ser estrictos. Con isAuthenticated=true,
                  // el usuario verá el loader y podrá refrescar la página manualmente.
                }
              }
            }
          }
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

        // MICRO-CAMBIO B: Lógica de logout precisa.
        if (error) throw error; // Si hay error (red/timeout), va al catch y se ignora.

        if (!session) {
          // Si la respuesta es exitosa (sin error) pero NO hay sesión,
          // significa que el token expiró o fue revocado. Logout.
          console.warn("[Auth] Session explicitly lost on focus.");
          await logout();
        }
      } catch (e) {
        // Si es error de red, timeout o fetch failed, lo ignoramos.
        // No expulsamos al usuario por tener mal internet al volver a la pestaña.
        console.warn("[Auth] Revalidation check failed (network?):", e.message);
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
  }, [clearAuthData, resetAuthState, logout, fetchProfileWithRetry]);

  const login = async ({ email, password }) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      // Usamos retry también en login para asegurar que entra bien
      const profile = await fetchProfileWithRetry(data.user.id);

      if (!profile)
        throw new Error("No se pudo cargar el perfil. Intente nuevamente.");

      setCurrentUser(profile);
      setIsAuthenticated(true);
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
