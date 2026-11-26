"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { toast } from "sonner";

// API pública da autenticação. Componentes não conhecem store/storage/backend.
export function useAuth() {
  const { user, isAuthenticated, isInitializing, logout: endSession, refreshSession } = useAuthStore();
  const router = useRouter();
  const queries = useQueryClient();

  const logout = useCallback(async () => {
    const operation = endSession();
    // A mesma limpeza vale para sair do mapa, painel ou detalhe de submissão.
    for (const queryKey of [["submissions"], ["curation"]]) {
      void queries.cancelQueries({ queryKey });
      queries.removeQueries({ queryKey });
    }
    router.replace("/");
    try { await operation; } catch { toast.error("Não foi possível encerrar a sessão. Tente novamente."); await refreshSession(); }
  }, [endSession, queries, router, refreshSession]);

  return { user, isAuthenticated, isInitializing, logout, refreshSession };
}
