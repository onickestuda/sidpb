"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/layout/AppHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import type { UserRole } from "@/entities/user/user.types";
import { RoleGuard } from "./RoleGuard";
import { useAuth } from "@/modules/auth/hooks/useAuth";

export function ProfileLayout({ role, title, children, showIdentity = true }: { role: UserRole; title: string; children: ReactNode; showIdentity?: boolean }) {
  const { user, logout } = useAuth();

  return (
    <RoleGuard role={role}>
      <div className="min-h-svh bg-background">
        <AppHeader />
        <main>
          <PageContainer className="space-y-8 py-8">
            <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold">{title}</h1>
                {showIdentity && <>
                  <p>Olá, {user?.name}</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </>}
              </div>
              {/* <div className="flex gap-2">
                <Button asChild variant="outline"><Link href="/dashboard">Ir para o mapa</Link></Button>
                <Button variant="outline" onClick={() => void logout()}>Sair</Button>
              </div> */}
            </header>
            {children}
          </PageContainer>
        </main>
      </div>
    </RoleGuard>
  );
}
