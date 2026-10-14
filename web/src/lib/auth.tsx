"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import { api, ApiError } from "@/lib/api";

interface User {
  id: string;
  email: string | null;
  avatar: string | null;
  role: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const requestRef = useRef<AbortController | null>(null);

  const fetchUser = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const token = localStorage.getItem("token");
    setLoading(true);
    try {
      const u = await api.get<User>("/api/auth/me", { signal: controller.signal });
      if (!controller.signal.aborted && localStorage.getItem("token") === token) setUser(u);
    } catch (error) {
      if (!controller.signal.aborted && localStorage.getItem("token") === token && error instanceof ApiError && error.status === 401) {
        setUser(null);
        localStorage.removeItem("token");
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
    return () => requestRef.current?.abort();
  }, [fetchUser]);

  const login = (token: string) => {
    localStorage.setItem("token", token);
    fetchUser();
  };

  const logout = () => {
    requestRef.current?.abort();
    setLoading(false);
    localStorage.removeItem("token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
