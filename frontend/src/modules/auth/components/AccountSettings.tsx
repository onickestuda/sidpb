"use client";

import { useState } from "react";
import { ChevronRight, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AuthUser, UserRole } from "@/entities/user/user.types";
import { AUTH_BASE } from "@/modules/auth/services/auth.service";

const ROLE_LABELS: Record<UserRole, string> = { USER: "Usuário", CURATOR: "Curador", ADMIN: "Administrador" };

// Sections of the identity service (Keycloak account console, with the SIDPB theme).
const accountUrl = (section?: string) => `${AUTH_BASE}/account/${section ? `?section=${section}` : ""}`;

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "?";
}

function SettingRow({ title, href, action }: { title: string; href: string; action: string }) {
  return (
    <a href={href} className="group flex items-center gap-4 px-6 py-4 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none">
      <span className="min-w-0 flex-1 text-sm font-medium">{title}</span>
      <span className="hidden items-center gap-1 text-sm font-medium text-primary sm:flex">
        {action}<ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </span>
      <ChevronRight className="size-4 text-muted-foreground sm:hidden" />
    </a>
  );
}

export function AccountSettings({ user }: { user: AuthUser }) {
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function deleteAccount() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`${AUTH_BASE}/delete-account/`, { method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation }) });
      const result = await response.json();
      if (response.status !== 202) throw new Error(result.message || "Não foi possível confirmar a exclusão.");
      window.location.assign(result.url);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Serviço indisponível."); setBusy(false); }
  }

  return (
    <div className="grid max-w-4xl gap-6">
      <Card className="gap-0 py-0">
        <CardContent className="flex flex-wrap items-center gap-5 px-6 py-6">
          <span aria-hidden className="flex size-16 shrink-0 items-center justify-center bg-primary text-xl font-semibold text-primary-foreground">
            {initials(user.name)}
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate text-lg font-semibold">{user.name}</p>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            {user.code && <p className="text-xs text-muted-foreground" title="Código público da conta">CUR-{user.code}</p>}
          </div>
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <CardHeader className="border-b px-6 py-4">
          <CardTitle><h2 className="text-base">Dados pessoais</h2></CardTitle>
        </CardHeader>
        <dl className="divide-y text-sm">
          <div className="grid gap-1 px-6 py-3 sm:grid-cols-[160px_1fr]"><dt className="text-muted-foreground">Nome</dt><dd className="font-medium">{user.name}</dd></div>
          <div className="grid gap-1 px-6 py-3 sm:grid-cols-[160px_1fr]"><dt className="text-muted-foreground">E-mail</dt><dd className="font-medium break-all">{user.email}</dd></div>
          <div className="grid gap-1 px-6 py-3 sm:grid-cols-[160px_1fr]"><dt className="text-muted-foreground">Perfil de acesso</dt><dd className="font-medium">{ROLE_LABELS[user.role]}</dd></div>
        </dl>
        <div className="border-t px-6 py-3">
          <Button asChild variant="outline" size="sm"><a href={accountUrl("profile")}><UserRound className="size-4" />Editar dados pessoais</a></Button>
        </div>
      </Card>

      <Card className="gap-0 py-0">
        <CardHeader className="border-b px-6 py-4">
          <CardTitle><h2 className="text-base">Acesso e segurança</h2></CardTitle>
        </CardHeader>
        <div className="divide-y">
          <SettingRow title="Senha" href={accountUrl("password")} action="Configurar" />
          <SettingRow title="Conta Google" href={accountUrl("google")} action="Vincular" />
          <SettingRow title="Sessões e dispositivos" href={accountUrl("sessions")} action="Ver sessões" />
        </div>
      </Card>

      <Card className="gap-0 border-destructive/40 py-0">
        <CardHeader className="px-6 py-4">
          <CardTitle><h2 className="text-base text-destructive">Excluir conta</h2></CardTitle>
          <CardDescription>
            A exclusão é permanente: seus dados pessoais são removidos e o acesso é encerrado. Contribuições científicas e
            autoria bibliográfica são preservadas, com o vínculo de conta anonimizado. Um novo cadastro não recupera esse histórico.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          {!deleting ? (
            <Button variant="outline" className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setDeleting(true)}>Quero excluir minha conta</Button>
          ) : (
            <section className="space-y-3 border border-destructive/30 bg-destructive/5 p-4" aria-label="Confirmar exclusão da conta">
              <p className="text-sm">O pedido encerra seu acesso e continua em processamento mesmo se algum serviço estiver indisponível.</p>
              <label className="block text-sm font-medium">Digite <strong>EXCLUIR</strong> para confirmar
                <input className="mt-1 block w-full max-w-xs border border-input bg-background px-3 py-2 text-sm" value={confirmation}
                  onChange={event => setConfirmation(event.target.value)} disabled={busy} autoComplete="off" />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button variant="destructive" disabled={busy || confirmation !== "EXCLUIR"} onClick={deleteAccount}>
                  {busy ? "Enviando pedido..." : "Excluir permanentemente"}
                </Button>
                <Button variant="ghost" disabled={busy} onClick={() => { setDeleting(false); setConfirmation(""); setError(""); }}>Cancelar</Button>
              </div>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            </section>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
