"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { SubmissionOverview } from "@/modules/submissions/components/SubmissionOverview";
import { ArticleFields, EMPTY_ARTICLE, articleToForm, formToArticle, type ArticleFormValues } from "@/modules/submissions/components/ArticleFields";
import { curationService } from "../services/curation.service";
import { ApiError } from "@/lib/apiClient";

export function CurationReview({ id }: { id: number }) {
  const { user } = useAuth();
  const router = useRouter();
  const queries = useQueryClient();
  const query = useQuery({ queryKey: ["curation", "detail", id], queryFn: ({ signal }) => curationService.get(id, signal), retry: false });
  const form = useForm<ArticleFormValues>({ defaultValues: EMPTY_ARTICLE });
  const [reason, setReason] = useState("");
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (query.data) form.reset(articleToForm(query.data.userData)); }, [query.data, form]);

  const mutation = useMutation({
    mutationFn: (action: "approve" | "reject") => action === "approve"
      ? curationService.approve(id, user!.id, formToArticle(form.getValues()))
      : curationService.reject(id, user!.id, reason.trim()),
    onSuccess: async () => {
      setDecision(null);
      await Promise.all([
        queries.invalidateQueries({ queryKey: ["curation"] }),
        queries.invalidateQueries({ queryKey: ["submissions"] }),
      ]);
      router.push("/curador");
    },
    onError: cause => setError(cause instanceof ApiError ? cause.message : "Não foi possível registrar a decisão. Tente novamente."),
  });

  function prepareReject() {
    setError(null);
    if (!reason.trim()) { setError("Informe o motivo da reprovação."); return; }
    setDecision("reject");
  }

  return <div className="space-y-6">
    <Button asChild variant="outline"><Link href="/curador">Voltar para a fila</Link></Button>
    {query.isPending && <p role="status">Carregando artigo...</p>}
    {query.isError && <p role="alert" className="text-destructive">Não foi possível abrir esta submissão.</p>}
    {query.data && <>
      <SubmissionOverview submission={query.data} pdfUrl={curationService.pdfUrl(id)} comparison />
      {query.data.status === "PENDING" && <Card>
        <CardHeader><CardTitle><h3>Decisão de curadoria</h3></CardTitle></CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={form.handleSubmit(() => { setError(null); setDecision("approve"); })}>
            <details>
              <summary className="cursor-pointer font-medium">Conferir e ajustar dados para aprovação</summary>
              <div className="mt-4 space-y-4">
                <p className="text-sm text-muted-foreground">Os dados informados pelo usuário são a base inicial. Ajuste os campos antes de aprovar.</p>
                <ArticleFields form={form} prefix="curated" disabled={mutation.isPending} />
              </div>
            </details>
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Motivo da reprovação (obrigatório ao reprovar)</Label>
              <Textarea id="rejection-reason" value={reason} onChange={e => setReason(e.target.value)} maxLength={2000} disabled={mutation.isPending} rows={3} />
            </div>
            {error && !decision && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap justify-between gap-3">
              <Button type="button" variant="destructive" disabled={mutation.isPending} onClick={prepareReject}>Reprovar</Button>
              <Button type="submit" disabled={mutation.isPending}>Aprovar</Button>
            </div>
          </form>
        </CardContent>
      </Card>}
    </>}
    <AlertDialog open={decision !== null} onOpenChange={open => { if (!open && !mutation.isPending) { setDecision(null); setError(null); } }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{decision === "approve" ? "Confirmar aprovação" : "Confirmar reprovação"}</AlertDialogTitle>
          <AlertDialogDescription>
            {decision === "approve" ? "A decisão e os dados revisados serão registrados no histórico." : "A decisão e o motivo informado serão registrados no histórico."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction disabled={mutation.isPending} onClick={event => {
            event.preventDefault(); if (decision && user && !mutation.isPending) mutation.mutate(decision);
          }}>{mutation.isPending ? "Registrando..." : decision === "approve" ? "Confirmar aprovação" : "Confirmar reprovação"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
