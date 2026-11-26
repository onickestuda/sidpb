"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { submissionsService } from "../services/submissions.service";
import { SubmissionOverview } from "./SubmissionOverview";

export function UserSubmissionDetail({ id }: { id: number }) {
  const { user } = useAuth();
  const query = useQuery({ queryKey: ["submissions", "detail", user?.id, id],
    queryFn: ({ signal }) => submissionsService.get(id, user!.id, signal), enabled: Boolean(user), retry: false,
    staleTime: 0, refetchOnWindowFocus: true });
  return <div className="space-y-6">
    <Button asChild variant="outline"><Link href="/usuario">Voltar às minhas submissões</Link></Button>
    {query.isPending && <p role="status">Carregando submissão...</p>}
    {query.isError && <p role="alert" className="text-destructive">Não foi possível abrir esta submissão. Confira se ela pertence ao seu usuário.</p>}
    {query.data && <SubmissionOverview submission={query.data} pdfUrl={submissionsService.pdfUrl(id, user!.id)} showSuggestions />}
  </div>;
}
