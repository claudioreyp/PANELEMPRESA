import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { api } from "./api";
import { supabase } from "./supabase";
import { CAN_USE_DEV_AUTH } from "./runtime";
import type { AdminIdentity } from "../types";
import { friendlyAuthError } from "./auth-errors";

type AuthState = {
  user: User | { id: string; email: string } | null;
  identity: AdminIdentity | null;
  loading: boolean;
  error: string | null;
  canUseDevMode: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInDev: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthState["user"]>(null);
  const [identity, setIdentity] = useState<AdminIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canUseDevMode = CAN_USE_DEV_AUTH;

  async function verify(nextUser: AuthState["user"]) {
    if (!nextUser) {
      setUser(null); setIdentity(null); setLoading(false); return;
    }
    setLoading(true);
    try {
      const nextIdentity = await api<AdminIdentity>("/me");
      if (nextIdentity.role !== "superadmin") throw new Error("Esta cuenta no tiene permisos de superadministrador.");
      setUser(nextUser); setIdentity(nextIdentity); setError(null);
    } catch (caught) {
      setUser(null); setIdentity(null);
      setError(caught instanceof Error ? caught.message : "No se pudo validar el acceso.");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    let active = true;
    if (localStorage.getItem("impulsa.adminAuthMode") === "dev" && canUseDevMode) {
      void verify({ id: "dev-superadmin", email: "superadmin@impulsa.local" });
      return () => { active = false; };
    }
    if (!supabase) { setLoading(false); return () => { active = false; }; }
    supabase.auth.getUser().then(({ data }) => { if (active) void verify(data.user); });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { if (active) void verify(session?.user || null); });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, [canUseDevMode]);

  async function signIn(email: string, password: string) {
    if (!supabase) throw new Error("Supabase Auth no está configurado.");
    setError(null);
    const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password }).catch((caught: unknown) => {
      throw new Error(friendlyAuthError(caught));
    });
    if (loginError) throw new Error(friendlyAuthError(loginError));
    localStorage.setItem("impulsa.adminAuthMode", "supabase");
    await verify(data.user);
  }

  async function signInDev() {
    if (!canUseDevMode) return;
    localStorage.setItem("impulsa.adminAuthMode", "dev");
    await verify({ id: "dev-superadmin", email: "superadmin@impulsa.local" });
  }

  async function signOut() {
    localStorage.removeItem("impulsa.adminAuthMode");
    if (supabase) await supabase.auth.signOut();
    setUser(null); setIdentity(null); setError(null);
  }

  return <AuthContext.Provider value={{ user, identity, loading, error, canUseDevMode, signIn, signInDev, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
