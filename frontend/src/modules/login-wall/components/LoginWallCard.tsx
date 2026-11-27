"use client";
import { basePath } from "@/lib/publicConfig";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { ROLE_ROUTES } from "@/modules/auth/constants/authRoutes";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { AUTH_BASE } from "@/modules/auth/services/auth.service";

export function LoginWallCard() {
  const { isInitializing, user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [deletionRequested, setDeletionRequested] = useState(false);
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("auth_error");
    setDeletionRequested(new URLSearchParams(window.location.search).get("account_deletion") === "requested");
    if (code) setError("Não foi possível concluir o acesso. Entre novamente para continuar.");
  }, []);
  return <Card className="w-full max-w-[420px] border-border/90 bg-card/95 shadow-md">
    <CardHeader className="items-center gap-3 px-6 text-center">
      <Image src={`${basePath}/logo.svg`} alt="SIDPB" width={150} height={150} priority className="mx-auto" />
      <CardDescription>Consulte ocorrências e dados sobre doenças parasitárias no Brasil.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4 px-6">
      <Button asChild className="h-11 w-full"><Link href="/dashboard">Acessar o mapa <ArrowRight className="size-4" /></Link></Button>
      {isInitializing && <p role="status">Restaurando sessão...</p>}
      {user && <Button asChild variant="outline" className="w-full"><Link href={ROLE_ROUTES[user.role]}>Voltar para minha área</Link></Button>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {deletionRequested && <p role="status">Pedido de exclusão recebido. Seu acesso foi encerrado; a remoção dos dados pessoais será concluída pelo serviço.</p>}
      {/* Sign-in options only for visitors: a logged-in user already has "Voltar para minha área". */}
      {!user && !isInitializing && <>
        <div className="space-y-2 border-t pt-4 text-center"><h1 className="text-lg font-semibold">Entre na sua conta</h1><p className="text-sm text-muted-foreground">Submeta artigos e acompanhe suas avaliações.</p></div>
        {([['login', 'Continuar com e-mail'], ['google', 'Continuar com Google']] as const).map(([action, label]) =>
          <form key={action} method="post" action={`${AUTH_BASE}/${action}/`}>
            <Button type="submit" variant="outline" className="h-11 w-full">{label}</Button>
          </form>)}
        <form method="post" action={`${AUTH_BASE}/register/`} className="text-center text-sm">
          Ainda não tem uma conta?{" "}<button type="submit" role="link" className="font-medium text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring">Cadastre-se</button>
        </form>
      </>}
    </CardContent>
  </Card>;
}
