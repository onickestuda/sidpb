import { create } from "zustand";

import type { AuthUser } from "@/entities/user/user.types";
import { authService } from "@/modules/auth/services/auth.service";

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  logout(): Promise<void>;
  refreshSession(): Promise<void>;
}

let sessionRevision = 0;
let pendingRefresh: { revision: number; promise: Promise<void> } | null = null;

// Cache/estado de UI. A fonte de autenticação fica exclusivamente no authService.
// Senha e password_hash nunca entram neste store.
export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isInitializing: true,
  logout: async () => {
    ++sessionRevision;
    set({ user: null, isAuthenticated: false, isInitializing: false });
    await authService.logout();
  },
  refreshSession: () => {
    // Compartilha o bootstrap concorrente, inclusive no StrictMode do React.
    if (pendingRefresh?.revision === sessionRevision) return pendingRefresh.promise;
    const revision = sessionRevision;
    // Only the first load blocks the page. Background re-checks (e.g. when the window regains focus
    // after the OS file picker) must not unmount forms and lose what the user already filled in.
    if (!get().user) set({ isInitializing: true });
    const promise = (async () => {
      let user: AuthUser | null = null;
      try {
        user = await authService.getCurrentUser();
      } catch {
        // Sessão ausente/indisponível: UI volta ao estado anônimo.
      }
      // Nunca restaurar uma sessão antiga sobre um login/logout mais recente.
      if (revision === sessionRevision) {
        set({ user, isAuthenticated: user !== null, isInitializing: false });
      }
    })().finally(() => {
      if (pendingRefresh?.promise === promise) pendingRefresh = null;
    });
    pendingRefresh = { revision, promise };
    return promise;
  },
}));
