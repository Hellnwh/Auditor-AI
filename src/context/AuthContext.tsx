import React, { createContext, useContext } from 'react';
import { User } from '../types';

interface AuthContextType {
  token: string | null;
  user: User | null;
  login: (t: string, u: User) => void;
  logout: () => void;
  refreshUser: () => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("Missing AuthContext");
  return ctx;
}
