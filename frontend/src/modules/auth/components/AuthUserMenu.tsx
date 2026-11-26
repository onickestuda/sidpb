"use client";

import Link from "next/link";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { can } from "@/modules/auth/auth.permissions";
import { useAuth } from "@/modules/auth/hooks/useAuth";

export function AuthUserMenu() {
  const { user, isAuthenticated, isInitializing, logout } = useAuth();
  if (isInitializing) {
    return <span className="h-8 w-8 animate-pulse bg-muted" role="status" aria-label="Restaurando sessão" />;
  }
  if (!isAuthenticated || !user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Menu do usuário" className="gap-2">
          <UserRound className="size-4" />
          <span className="hidden max-w-24 truncate xl:inline">{user.name}</span>
          <ChevronDown className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">{user.name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link href="/conta">Conta</Link></DropdownMenuItem>
        {can(user, "submission.viewOwn") && (
          <DropdownMenuItem asChild><Link href="/usuario">Submissões</Link></DropdownMenuItem>
        )}
        {can(user, "curation.view") && (
          <DropdownMenuItem asChild><Link href="/curador">Curadoria</Link></DropdownMenuItem>
        )}
        {can(user, "admin.access") && (
          <DropdownMenuItem asChild><Link href="/admin/usuarios">Usuários e permissões</Link></DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void logout()}>
          <LogOut className="size-4" />Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
