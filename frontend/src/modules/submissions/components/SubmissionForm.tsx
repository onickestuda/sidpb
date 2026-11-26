"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { submissionsService } from "../services/submissions.service";
import { ArticleFields, EMPTY_ARTICLE, formToArticle, type ArticleFormValues } from "./ArticleFields";
import { PdfField, pdfProblem } from "./PdfField";
import { ApiError } from "@/lib/apiClient";

export function SubmissionForm({ onCreated }: { onCreated(): void }) {
  const { user } = useAuth();
  const queries = useQueryClient();
  const form = useForm<ArticleFormValues>({ defaultValues: EMPTY_ARTICLE });
  const [pdf, setPdf] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const mutation = useMutation({
    mutationFn: (values: ArticleFormValues) => submissionsService.create(user!.id, link.trim(), formToArticle(values), pdf!),
    onSuccess: () => {
      form.reset(EMPTY_ARTICLE); setLink(""); setPdf(null); setSuccess(true);
      onCreated();
      void queries.invalidateQueries({ queryKey: ["submissions"] });
      void queries.invalidateQueries({ queryKey: ["curation"] });
    },
    onError: cause => setError(cause instanceof ApiError ? cause.message : "Não foi possível enviar o artigo. Verifique a conexão e tente novamente."),
  });

  function submit(values: ArticleFormValues) {
    if (mutation.isPending || !user) return;
    setSuccess(false); setError(null);
    const problem = pdf ? pdfProblem(pdf) : "Selecione o PDF do artigo.";
    if (problem) { setError(problem); return; }
    mutation.mutate(values);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle><h2>Enviar artigo para análise</h2></CardTitle>
        <CardDescription>PDF, link original e título são obrigatórios. Preencha os demais dados que conhecer.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={form.handleSubmit(submit)} aria-busy={mutation.isPending}>
          <fieldset disabled={mutation.isPending} className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <PdfField value={pdf} onChange={file => { setPdf(file); setError(null); }} disabled={mutation.isPending} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="submission-link">Link da fonte original *</Label>
              <Input id="submission-link" type="url" maxLength={1000} required value={link} onChange={e => setLink(e.target.value)} placeholder="https://doi.org/..." />
            </div>
          </fieldset>
          <ArticleFields form={form} prefix="submission" disabled={mutation.isPending} />
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {success && <p role="status" className="text-sm text-green-800">Artigo enviado. A submissão está pendente de curadoria. {mutation.data && <Link className="underline" href={`/usuario/submissoes/${mutation.data.id}`}>Consultar submissão</Link>}</p>}
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Enviando..." : "Enviar para análise"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
