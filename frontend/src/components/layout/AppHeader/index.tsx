"use client"
import { basePath } from "@/lib/publicConfig";

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { AuthUserMenu } from "@/modules/auth/components/AuthUserMenu"

interface AppHeaderProps {
  compact?: boolean
  action?: "dashboard" | "home"
}

export function AppHeader({ compact = false, action = "dashboard" }: AppHeaderProps) {
  return (
    <header className="shrink-0 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className={compact ? "px-4 h-12 flex items-center justify-between gap-2" : "container mx-auto px-4 h-16 flex items-center justify-between gap-2"}>
        <Link href="/dashboard" className="flex shrink-0 items-center" aria-label="SIDPB: ir para o mapa">
          <Image
            src={`${basePath}/logo.svg`}
            alt="SIDPB"
            width={829}
            height={222}
            className={compact ? "h-6 w-auto sm:h-8" : "h-6 w-auto sm:h-10"}
            priority
          />
        </Link>

        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          {action === "dashboard" ? (
            <Button asChild className="px-2 sm:px-4">
              <Link href="/dashboard">Ir para o mapa</Link>
            </Button>
          ) : (
            <Button asChild variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground">
              <Link href="/">Início</Link>
            </Button>
          )}
          <AuthUserMenu />
        </div>
      </div>
    </header>
  )
}
