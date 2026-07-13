"use client";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authService } from "./service";
import type { AuthState, LoginInput, RegisterInput, Session } from "./types";
import type { Result } from "@/shared/result";

type AuthContextValue = AuthState & { login(input: LoginInput): Promise<Result<Session>>; register(input: RegisterInput): Promise<Result<Session>>; logout(): Promise<void>; bootstrap(): Promise<void> };
const AuthContext = createContext<AuthContextValue | undefined>(undefined);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" }); const queryClient = useQueryClient();
  const bootstrap = useCallback(async () => { try { setState({ status: "authenticated", user: await authService.me() }); } catch { setState({ status: "anonymous" }); } }, []);
  useEffect(() => { queueMicrotask(() => void bootstrap()); }, [bootstrap]);
  const complete = async (result: Result<Session>) => { if (result.ok) setState({ status: "authenticated", user: result.data.user }); return result; };
  const value = useMemo<AuthContextValue>(() => ({ ...state, bootstrap, login: async (input) => complete(await authService.login(input)), register: async (input) => complete(await authService.register(input)), logout: async () => { await authService.logout().catch(() => undefined); queryClient.clear(); setState({ status: "anonymous" }); } }), [state, bootstrap, queryClient]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth(): AuthContextValue { const value = useContext(AuthContext); if (value === undefined) throw new Error("useAuth must be used inside AuthProvider"); return value; }
