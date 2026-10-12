import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  changePassword as apiChangePassword,
  getMe,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
} from "../services/api";
import type { Account, ChangePasswordRequest, LoginRequest, RegisterRequest } from "../lib/types";

interface AuthContextValue {
  account: Account | null;
  isLoading: boolean;
  login: (payload: LoginRequest) => Promise<void>;
  register: (payload: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  changePassword: (payload: ChangePasswordRequest) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await getMe();
      setAccount(me);
    } catch {
      setAccount(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setIsLoading(false));
  }, [refresh]);

  const login = useCallback(async (payload: LoginRequest) => {
    const me = await apiLogin(payload);
    setAccount(me);
  }, []);

  const register = useCallback(async (payload: RegisterRequest) => {
    const me = await apiRegister(payload);
    setAccount(me);
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setAccount(null);
  }, []);

  const changePassword = useCallback(async (payload: ChangePasswordRequest) => {
    const me = await apiChangePassword(payload);
    setAccount(me);
  }, []);

  return (
    <AuthContext.Provider value={{ account, isLoading, login, register, logout, refresh, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
