import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, getTokens, setTokens } from '../api/client';
import type { Role, User } from '../api/types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (input: { name: string; email: string; password: string; departmentId?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getTokens()) {
      setLoading(false);
      return;
    }
    api
      .get<{ user: User }>('/auth/me')
      .then((res) => setUser(res.user))
      .catch(() => setTokens(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onExpired = () => {
      setTokens(null);
      setUser(null);
    };
    window.addEventListener('assetflow:session-expired', onExpired);
    return () => window.removeEventListener('assetflow:session-expired', onExpired);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<AuthResponse>('/auth/login', { email, password });
    setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
    setUser(res.user);
  }, []);

  const signup = useCallback(
    async (input: { name: string; email: string; password: string; departmentId?: string }) => {
      const res = await api.post<AuthResponse>('/auth/signup', input);
      setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
      setUser(res.user);
    },
    [],
  );

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => undefined);
    setTokens(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const res = await api.get<{ user: User }>('/auth/me');
    setUser(res.user);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, signup, logout, refreshUser }),
    [user, loading, login, signup, logout, refreshUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export function usePermissions() {
  const { user } = useAuth();
  const role: Role = user?.role ?? 'EMPLOYEE';
  return {
    role,
    isAdmin: role === 'ADMIN',
    manageOrg: role === 'ADMIN',
    registerAssets: role === 'ADMIN' || role === 'ASSET_MANAGER',
    allocate: role === 'ADMIN' || role === 'ASSET_MANAGER' || role === 'DEPARTMENT_HEAD',
    approveReturns: role === 'ADMIN' || role === 'ASSET_MANAGER',
    decideTransfers: role === 'ADMIN' || role === 'ASSET_MANAGER' || role === 'DEPARTMENT_HEAD',
    decideMaintenance: role === 'ADMIN' || role === 'ASSET_MANAGER',
    manageAudits: role === 'ADMIN',
    viewReports: role === 'ADMIN' || role === 'ASSET_MANAGER' || role === 'DEPARTMENT_HEAD',
  };
}
