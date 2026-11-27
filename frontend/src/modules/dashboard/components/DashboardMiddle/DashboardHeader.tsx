"use client";
import { basePath } from "@/lib/publicConfig";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";

import { SearchForm } from "@/modules/search/components/SearchForm";
import { AuthUserMenu } from "@/modules/auth/components/AuthUserMenu";

export function DashboardHeader() {
  const [search, setSearch] = useQueryState(
    "search",
    parseAsString.withDefault("")
  );

  function handleSearch(value: string) {
    const nextSearch = value.trim();
    void setSearch(nextSearch.length > 0 ? nextSearch : null);
  }

  return (
    <header className="grid h-16 grid-cols-[15rem_minmax(0,1fr)_auto] items-center border-b border-border bg-background">
      {/* First column = the left sidebar width (w-60), so the search box lines up with the map. */}
      <div className="flex items-center px-6">
        <Link href="/dashboard" aria-label="SIDPB: ir para o mapa">
          <Image
            src={`${basePath}/logo.svg`}
            alt="SIDPB"
            width={120}
            height={42}
            priority
          />
        </Link>
      </div>

      <div className="flex justify-center px-4">
        <div className="w-full max-w-3xl">
          <SearchForm
            initialValue={search}
            onSearch={handleSearch}
            placeholder="Pesquise por doença, agente etiológico, hospedeiro..."
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 px-4">
        <Link
          href="/"
          className="hidden items-center gap-2 whitespace-nowrap text-sm font-medium text-muted-foreground transition-colors hover:text-foreground lg:flex"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para início
        </Link>
        <AuthUserMenu />
      </div>
    </header>
  );
}
