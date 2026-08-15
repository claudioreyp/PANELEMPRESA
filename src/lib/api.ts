import { supabase } from "./supabase";

export const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message: string, public status: number, public details?: unknown) {
    super(message);
  }
}

export async function authHeaders(): Promise<Record<string, string>> {
  if (localStorage.getItem("impulsa.adminAuthMode") === "dev" && import.meta.env.VITE_DEV_AUTH_TOKEN) {
    return {
      "X-Dev-Auth": import.meta.env.VITE_DEV_AUTH_TOKEN,
      "X-Dev-User": "dev-superadmin",
      "X-Dev-Role": "superadmin",
    };
  }
  const { data } = await supabase?.auth.getSession() || { data: { session: null } };
  return data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  Object.entries(await authHeaders()).forEach(([key, value]) => headers.set(key, value));
  if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const body = response.headers.get("content-type")?.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof body === "object" && body && "detail" in body ? String(body.detail) : `Error HTTP ${response.status}`;
    throw new ApiError(message, response.status, body);
  }
  return body as T;
}
