import React, { createContext, useContext, useState, useEffect } from 'react';
import { getToken } from '../services/api';
import { signIn, signOut, signUp, User } from '../services/auth';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, passwordConfirmation: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, check if a token exists to restore session
  useEffect(() => {
    getToken()
      .then((token) => {
        // Token exists but we don't have a /me endpoint,
        // so just mark as loading done — screens handle unauthenticated state
        if (!token) setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const u = await signIn(email, password);
    setUser(u);
  };

  const register = async (
    email: string,
    password: string,
    passwordConfirmation: string,
  ) => {
    const u = await signUp(email, password, passwordConfirmation);
    setUser(u);
  };

  const logout = async () => {
    await signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
