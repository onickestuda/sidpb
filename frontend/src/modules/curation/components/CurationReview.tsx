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
import { ArticleDataView } from "@/modules/submissions/components/ArticleDataView";
import { ARTICLE_ONLY_FIELDS, ArticleFields, EMPTY_ARTICLE, articleToForm, formToArticle, type ArticleFormValues } from "@/modules/submissions/components/ArticleFields";
import { curationService } from "../services/curation.service";
import { OccurrenceCuration } from "./OccurrenceCuration";
import { draftFromExtraction, draftFromUser, draftToCurated, type OccurrenceDraft } from "@/modules/submissions/components/OccurrenceDraftForm";
import { userOccurrences } from "@/entities/submission/submission.types";
import { ApiError } from "@/lib/apiClient";

export function CurationReview({ id }: { id: number }) {
  const { user } = useAuth();
  const router = useRouter();
  const queries = useQueryClient();
  const query = useQuery({ queryKey: ["curation", "detail", id], queryFn: ({ signal }) => curationService.get(id, signal), retry: false });
  const extraction = useQuery({
    queryKey: ["curation", "extraction", id], queryFn: ({ signal }) => curationService.extraction(id, signal),
    enabled: Boolean(query.data), retry: false,
  });
  const form = useForm<ArticleFormValues>({ defaultValues: EMPTY_ARTICLE });
  const [drafts, setDrafts] = useState<OccurrenceDraft[] | null>(null);
  const [reason, setReason] = useState("");
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (query.data) form.reset(articleToForm(query.data.userData)); }, [query.data, form]);
  // Forms start from what the extraction found (one per occurrence) or, without extraction, from the user's data.
  useEffect(() => {
    if (drafts !== null || !query.data || extraction.isPending) return;
    const found = extraction.data;
    // Start the curator's column from the extraction when there is one, otherwise from the user's suggestions.
    setDrafts(found?.occurrences.length ? found.occurrences.map(draftFromExtraction) : userOccurrences(query.data.userData).map(draftFromUser));
  }, [drafts, query.data, extraction.isPending, extraction.data]);

  const mutation = useMutation({
    mutationFn: (action: "approve" | "reject") => {
      if (action === "reject") return curationService.reject(id, user!.id, reason.trim());
      const occurrences = (drafts ?? []).map(draftToCurated);
      // The article keeps the first disease so the queue can still filter by it.
      const article = { ...formToArticle(form.getValues()), disease: occurrences.find((item) => item.disease)?.disease ?? null };
      return curationService.approve(id, user!.id, article, occurrences);
    },
    onSuccess: async () => {
      setDecision(null);
      await Promise.all([
        queries.invalidateQueries({ queryKey: ["curation"] }),
        queries.invalidateQueries({ queryKey: ["submissions"] }),
        queries.invalidateQueries({ queryKey: ["dashboard-occurrences"] }),
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

  const count = drafts?.length ?? 0;

  return <div className="space-y-6">
    <Button asChild variant="outline"><Link href="/curador">Voltar para a fila</Link></Button>
    {query.isPending && <p role="status">Carregando artigo...</p>}
    {query.isError && <p role="alert" className="text-destructive">Não foi possível abrir esta submissão.</p>}
    {query.data && <>
      <SubmissionOverview submission={query.data} pdfUrl={curationService.pdfUrl(id)} showSuggestions={false} showSourceData={query.data.status !== "PENDING"} />
      {query.data.status === "PENDING" && <Card>
        <CardHeader><CardTitle><h3>Decisão de curadoria</h3></CardTitle></CardHeader>
        <CardContent>
          <form className="space-y-8" onSubmit={form.handleSubmit(() => { setError(null); setDecision("approve"); })}>
            <section className="space-y-4" aria-labelledby="curation-article">
              <h4 id="curation-article" className="font-semibold">Dados da fonte</h4>
              <div className={`grid items-start gap-6 ${query.data.origin === "EXTRACAO" ? "" : "lg:grid-cols-2"}`}>
                {query.data.origin !== "EXTRACAO" && (
                  <div className="min-w-0 space-y-2">
                    <h5 className="border-b border-border pb-2 text-sm font-semibold">Submetida</h5>
                    <ArticleDataView data={query.data.userData} fields="source" />
                  </div>
                )}
                <div className="min-w-0 space-y-2">
                  <h5 className="border-b border-border pb-2 text-sm font-semibold">Registro final</h5>
                  <ArticleFields form={form} prefix="curated" fields={ARTICLE_ONLY_FIELDS} disabled={mutation.isPending} />
                </div>
              </div>
            </section>

            <section className="space-y-4" aria-labelledby="curation-occurrences">
              <div className="space-y-1">
                <h4 id="curation-occurrences" className="font-semibold">Comparação de ocorrências</h4>
              </div>
              {extraction.isError && <p role="alert" className="text-sm text-destructive">Não foi possível carregar a extração automática.</p>}
              {drafts === null
                ? <p role="status">Carregando ocorrências...</p>
                : <OccurrenceCuration
                    userSuggestions={query.data.origin === "EXTRACAO" ? null : userOccurrences(query.data.userData)}
                    extraction={extraction.data ?? null} drafts={drafts} onChange={setDrafts} disabled={mutation.isPending} />}
            </section>

            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Motivo da reprovação (obrigatório ao reprovar)</Label>
              <Textarea id="rejection-reason" value={reason} onChange={e => setReason(e.target.value)} maxLength={2000} disabled={mutation.isPending} rows={3} />
            </div>
            {error && !decision && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap justify-between gap-3">
              <Button type="button" variant="destructive" disabled={mutation.isPending} onClick={prepareReject}>Reprovar</Button>
              <Button type="submit" disabled={mutation.isPending || drafts === null}>
                Aprovar com {count} {count === 1 ? "ocorrência" : "ocorrências"}
              </Button>
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
            {decision === "approve"
              ? `Serão registradas ${count} ${count === 1 ? "ocorrência curada" : "ocorrências curadas"}, que substituem as da extração automática. A decisão fica no histórico.`
              : "A decisão e o motivo informado serão registrados no histórico, e as ocorrências desta fonte saem do mapa."}
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
