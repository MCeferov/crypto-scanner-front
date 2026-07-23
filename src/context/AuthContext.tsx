import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  type AuthUser,
  clearStoredToken,
  fetchMe,
  getStoredToken,
  login as apiLogin,
  logout as apiLogout,
  setAuthFailureHandler,
  setStoredToken,
  signup as apiSignup,
  AuthApiError,
} from '../services/authApi';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** JWT exp yoxlaması — mid-session timeout üçün */
function tokenExpiresAtMs(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1] ?? ''));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export function mapAuthError(err: unknown): string {
  if (err instanceof AuthApiError) {
    if (err.status === 401) return 'Session expired — please sign in again';
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = useCallback(() => {
    clearStoredToken();
    setUser(null);
  }, []);

  useEffect(() => {
    setAuthFailureHandler(() => setUser(null));
    return () => setAuthFailureHandler(null);
  }, []);

  const restoreSession = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    const exp = tokenExpiresAtMs(token);
    if (exp !== null && Date.now() >= exp) {
      clearSession();
      setIsLoading(false);
      return;
    }
    try {
      const me = await fetchMe();
      setUser(me);
    } catch {
      clearSession();
    } finally {
      setIsLoading(false);
    }
  }, [clearSession]);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  // JWT timeout: exp-ə yaxın /me yoxla (1m test və production üçün)
  useEffect(() => {
    if (!user) return;
    const token = getStoredToken();
    if (!token) return;

    const exp = tokenExpiresAtMs(token);
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    let interval: ReturnType<typeof setInterval> | null = null;

    const revalidate = async () => {
      try {
        setUser(await fetchMe());
      } catch {
        clearSession();
      }
    };

    if (exp !== null) {
      const msLeft = exp - Date.now();
      if (msLeft <= 0) {
        clearSession();
        return;
      }
      timeouts.push(setTimeout(revalidate, Math.max(1_000, msLeft - 2_000)));
      timeouts.push(setTimeout(clearSession, msLeft + 250));
    } else {
      interval = setInterval(revalidate, 30_000);
    }

    return () => {
      timeouts.forEach(clearTimeout);
      if (interval) clearInterval(interval);
    };
  }, [user, clearSession]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiLogin(email.trim().toLowerCase(), password);
    setStoredToken(res.token);
    setUser(res.user);
  }, []);

  const signup = useCallback(async (username: string, email: string, password: string) => {
    const res = await apiSignup(username.trim(), email.trim().toLowerCase(), password);
    setStoredToken(res.token);
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    clearSession();
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    signup,
    logout,
  }), [user, isLoading, login, signup, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
