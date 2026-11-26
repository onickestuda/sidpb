"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AuthUser } from "@/entities/user/user.types";
import { AUTH_BASE } from "@/modules/auth/services/auth.service";
import { useState } from "react";
export function AccountSettings({ user }: { user: AuthUser }) {
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
  return <Card className="max-w-2xl"><CardHeader><CardTitle>Configurações da conta</CardTitle></CardHeader>
    <CardContent className="space-y-4"><p>{user.name}</p><p>{user.email}</p>
      <p className="text-sm text-muted-foreground">Gerencie seus dados, senha e sessões no serviço de identidade do SIDPB.</p>
      <Button asChild><a href={`${AUTH_BASE}/account/`}>Gerenciar minha conta</a></Button>
      <p className="text-sm text-muted-foreground">Adicione uma senha ou vincule o Google à sua conta atual. Seus dados e histórico continuam na mesma conta. O serviço poderá pedir uma confirmação de identidade.</p>
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline"><a href={`${AUTH_BASE}/account/?section=password`}>Configurar senha</a></Button>
        <Button asChild variant="outline"><a href={`${AUTH_BASE}/account/?section=google`}>Vincular Google</a></Button>
      </div>
      <section className="space-y-3 border-t pt-4" aria-label="Excluir conta">
        <h2 className="font-semibold">Excluir minha conta</h2>
        <p>A exclusão é permanente. Seus dados pessoais serão removidos. Contribuições científicas e autoria bibliográfica serão preservadas, com seu vínculo de conta anonimizado. Um novo cadastro não recuperará esse histórico.</p>
        <p>O pedido encerra seu acesso e continua em processamento se algum serviço estiver indisponível.</p>
        <label className="block">Digite EXCLUIR para confirmar
          <input className="mt-1 block rounded border p-2" value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} autoComplete="off" />
        </label>
        <Button variant="destructive" disabled={busy || confirmation !== "EXCLUIR"} onClick={deleteAccount}>
          {busy ? "Enviando pedido..." : "Excluir permanentemente"}
        </Button>
        {error && <p role="alert">{error}</p>}
      </section>
    </CardContent></Card>;
}
