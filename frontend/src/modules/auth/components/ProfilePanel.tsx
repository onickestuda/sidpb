"use client";

import Link from "next/link";

import { AppHeader } from "@/components/layout/AppHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { UserRole } from "@/entities/user/user.types";
import { RoleGuard } from "@/modules/auth/components/RoleGuard";
import { useAuth } from "@/modules/auth/hooks/useAuth";

const PROFILE_TITLES: Record<UserRole, string> = {
  ADMIN: "Painel do Administrador",
  CURATOR: "Painel do Curador",
  USER: "Painel do Usuário",
};

export function ProfilePanel({ role }: { role: UserRole }) {
  const { user, logout } = useAuth();

  return (
    <RoleGuard role={role}>
      <div className="min-h-svh bg-background">
        <AppHeader />
        <main>
          <PageContainer className="py-10">
            <Card className="mx-auto max-w-xl">
              <CardHeader>
                <CardTitle>{PROFILE_TITLES[role]}</CardTitle>
                <CardDescription>Perfil: {role}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <p className="text-lg font-medium">Olá, {user?.name}</p>
                  <p className="break-all text-muted-foreground">{user?.email}</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Acesso provisório para desenvolvimento e testes. As funcionalidades deste perfil serão desenvolvidas posteriormente.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button asChild><Link href="/dashboard">Ir para o mapa</Link></Button>
                  <Button variant="outline" onClick={() => void logout()}>Sair</Button>
                </div>
              </CardContent>
            </Card>
          </PageContainer>
        </main>
      </div>
    </RoleGuard>
  );
}
