import { basePath } from "@/lib/publicConfig";
import type { AuthUser } from "@/entities/user/user.types";
export const AUTH_BASE = `${basePath}/api/auth`;
export const authService = {
  async logout(): Promise<void> {
    const response = await fetch(`${AUTH_BASE}/logout/`, { method: "POST", credentials: "same-origin" });
    if (!response.ok) throw new Error("Não foi possível encerrar a sessão. Tente novamente.");
    const result = await response.json(); window.location.assign(result.url);
  },
  async getCurrentUser(): Promise<AuthUser | null> {
    // Remove obsolete prototype state; it is never read as identity.
    try { window.localStorage.removeItem("sidpb-auth-user"); } catch {}
    const response = await fetch(`${AUTH_BASE}/session/`, { cache: "no-store", credentials: "same-origin" });
    if (!response.ok) throw new Error("Sessão indisponível.");
    return response.json();
  },
};
