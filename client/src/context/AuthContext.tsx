import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, getToken, setToken, type Role, type User } from '../lib/api';

export type RegisterInput = {
  email: string;
  password: string;
  name: string;
  rank?: string;
  role: 'BASE_COMMANDER' | 'LOGISTICS_OFFICER';
  baseId: string;
};

export type ChangePasswordInput = {
  email: string;
  currentPassword: string;
  newPassword: string;
};

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  changePassword: (input: ChangePasswordInput) => Promise<void>;
  logout: () => void;
  canPurchaseOrTransfer: boolean;
  canAssignOrExpend: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function applySession(token: string, user: User, setUser: (u: User) => void) {
  setToken(token);
  setUser(user);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api<User>('/api/auth/me')
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    applySession(res.token, res.user, setUser);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const res = await api<{ token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    applySession(res.token, res.user, setUser);
  }, []);

  const changePassword = useCallback(async (input: ChangePasswordInput) => {
    const res = await api<{ token: string; user: User; message: string }>(
      '/api/auth/change-password',
      {
        method: 'POST',
        body: JSON.stringify(input),
      }
    );
    applySession(res.token, res.user, setUser);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(() => {
    const role = user?.role as Role | undefined;
    return {
      user,
      loading,
      login,
      register,
      changePassword,
      logout,
      isAdmin: role === 'ADMIN',
      canPurchaseOrTransfer:
        role === 'ADMIN' ||
        role === 'BASE_COMMANDER' ||
        role === 'LOGISTICS_OFFICER',
      canAssignOrExpend: role === 'ADMIN' || role === 'BASE_COMMANDER',
    };
  }, [user, loading, login, register, changePassword, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
