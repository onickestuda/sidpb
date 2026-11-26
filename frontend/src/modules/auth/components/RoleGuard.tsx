"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import type { UserRole } from "@/entities/user/user.types";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { canAccessProfile } from "@/modules/auth/auth.permissions";
import { ROLE_ROUTES } from "@/modules/auth/constants/authRoutes";

interface RoleGuardProps {
  role: UserRole;
  children: ReactNode;
}

// Controle de UX; não protege dados ou endpoints.
// Anônimo vai ao login wall; perfil incorreto vai à própria área após o bootstrap.
export function RoleGuard({ role, children }: RoleGuardProps) {
  const router = useRouter();
  const { user, isAuthenticated, isInitializing } = useAuth();
  const allowed = isAuthenticated && canAccessProfile(user, role);

  useEffect(() => {
    if (!isInitializing && !allowed) router.replace(user ? ROLE_ROUTES[user.role] : "/");
  }, [isInitializing, allowed, user, router]);

  if (isInitializing) {
    return <p className="p-6 text-muted-foreground" role="status">Restaurando sessão...</p>;
  }

  if (!allowed) {
    return <p className="p-6 text-muted-foreground" role="status">Redirecionando...</p>;
  }

  return children;
}
