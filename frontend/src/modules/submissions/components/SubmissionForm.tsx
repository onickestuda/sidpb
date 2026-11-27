"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { submissionsService } from "../services/submissions.service";
import { ARTICLE_ONLY_FIELDS, ArticleFields, EMPTY_ARTICLE, formToArticle, type ArticleFormValues } from "./ArticleFields";
import { OccurrenceDraftForm, draftToUser, emptyDraft, isEmptyDraft, type OccurrenceDraft } from "./OccurrenceDraftForm";
import { PdfField, pdfProblem } from "./PdfField";
import { ApiError } from "@/lib/apiClient";

export function SubmissionForm({ onCreated }: { onCreated(): void }) {
  const { user } = useAuth();
  const queries = useQueryClient();
  const form = useForm<ArticleFormValues>({ defaultValues: EMPTY_ARTICLE });
  const [pdf, setPdf] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [occurrences, setOccurrences] = useState<OccurrenceDraft[]>(() => [emptyDraft()]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const mutation = useMutation({
    mutationFn: (values: ArticleFormValues) => {
      // Fully blank occurrence forms are dropped: sending only the source (PDF + data) is allowed.
      const filled = occurrences.filter((draft) => !isEmptyDraft(draft)).map(draftToUser);
      const source = formToArticle(values);
      const article = {
        ...source, disease: null, parasite: null, vector: null, host: null, state: null, municipality: null,
        latitude: null, longitude: null, occurrences: filled,
      };
      return submissionsService.create(user!.id, link.trim() || null, article, pdf);
    },
    onSuccess: () => {
      form.reset(EMPTY_ARTICLE); setLink(""); setPdf(null); setOccurrences([emptyDraft()]); setSuccess(true);
      onCreated();
      void queries.invalidateQueries({ queryKey: ["submissions"] });
      void queries.invalidateQueries({ queryKey: ["curation"] });
    },
    onError: cause => setError(cause instanceof ApiError ? cause.message : "Não foi possível enviar o artigo. Verifique a conexão e tente novamente."),
  });

  function submit(values: ArticleFormValues) {
    if (mutation.isPending || !user) return;
    setSuccess(false); setError(null);
    const problem = pdf ? pdfProblem(pdf) : !link.trim() ? "Envie o PDF do artigo ou o link da fonte original." : null;
    if (problem) { setError(problem); return; }
    const halfCoordinates = occurrences.findIndex((draft) => !draft.latitude.trim() !== !draft.longitude.trim());
    if (halfCoordinates >= 0) { setError(`Ocorrência ${halfCoordinates + 1}: informe latitude e longitude juntas ou deixe ambas vazias.`); return; }
    mutation.mutate(values);
  }

  const update = (key: string, next: OccurrenceDraft) => setOccurrences((list) => list.map((draft) => (draft.key === key ? next : draft)));
  const remove = (key: string) => setOccurrences((list) => list.filter((draft) => draft.key !== key));

  return (
    <Card>
      <CardHeader>
        <CardTitle><h2>Enviar artigo para análise</h2></CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-8" onSubmit={form.handleSubmit(submit)} aria-busy={mutation.isPending}>
          <section className="space-y-4" aria-labelledby="submission-source">
            <h3 id="submission-source" className="font-semibold">Dados da fonte</h3>
            <fieldset disabled={mutation.isPending} className="grid gap-4 md:grid-cols-2">
              <legend className="mb-2 text-sm font-medium">Fonte * <span className="font-normal text-muted-foreground">PDF, link ou ambos</span></legend>
              <div className="md:col-span-2">
                <PdfField value={pdf} onChange={file => { setPdf(file); setError(null); }} disabled={mutation.isPending} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="submission-link">Link da fonte original</Label>
                <Input id="submission-link" type="url" maxLength={1000} value={link} onChange={e => setLink(e.target.value)} placeholder="https://doi.org/..." />
              </div>
            </fieldset>
            <ArticleFields form={form} prefix="submission" fields={ARTICLE_ONLY_FIELDS} disabled={mutation.isPending} />
          </section>

          <section className="space-y-4" aria-labelledby="submission-occurrences">
            <h3 id="submission-occurrences" className="font-semibold">Ocorrências desta fonte</h3>
            <div className="grid gap-4 lg:grid-cols-2">
              {occurrences.map((draft, index) => (
                <OccurrenceDraftForm key={draft.key} draft={draft} title={`Ocorrência ${index + 1}`} disabled={mutation.isPending}
                  onChange={(next) => update(draft.key, next)} onRemove={() => remove(draft.key)} />
              ))}
            </div>
            {occurrences.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma ocorrência: será enviada apenas a fonte.</p>}
            <Button type="button" variant="outline" disabled={mutation.isPending} onClick={() => setOccurrences((list) => [...list, emptyDraft()])}>
              <Plus className="size-4" />Adicionar ocorrência
            </Button>
          </section>

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {success && <p role="status" className="text-sm text-green-800">Artigo enviado. A submissão está pendente de curadoria. {mutation.data && <Link className="underline" href={`/usuario/submissoes/${mutation.data.id}`}>Consultar submissão</Link>}</p>}
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Enviando..." : "Enviar para análise"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
