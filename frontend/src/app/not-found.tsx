import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6">
      <div className="space-y-4 text-center">
        <p className="text-sm font-medium text-muted-foreground">Erro 404</p>
        <h1 className="text-2xl font-semibold">Página não encontrada</h1>
        <Button asChild><Link href="/dashboard">Ir para o mapa</Link></Button>
      </div>
    </main>
  );
}
