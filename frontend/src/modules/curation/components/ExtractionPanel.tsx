"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ExtractedOccurrence, ExtractionQuality } from "@/entities/submission/submission.types";
import { LOCATION_SEALS, OccurrenceExtras } from "@/modules/occurrences/components/OccurrencePanel/OccurrenceProvenance";
import { formatDate } from "@/modules/submissions/components/SubmissionTable";
import { curationService } from "../services/curation.service";

const QUALITY: Record<ExtractionQuality, { label: string; tone: string; help: string }> = {
  VALIDA: { label: "Leitura completa", tone: "border-primary/30 bg-primary/5 text-primary",
    help: "O JSON da extração foi lido por inteiro. Confira o conteúdo com a fonte." },
  PARCIAL: { label: "Leitura parcial", tone: "border-amber-300 bg-amber-50 text-amber-900",
    help: "O JSON veio com defeito; só as ocorrências completas foram aproveitadas. Pode haver dados faltando." },
  ILEGIVEL: { label: "Extração com falha", tone: "border-destructive/40 bg-destructive/5 text-destructive",
    help: "Não foi possível ler a extração automaticamente. Cure a partir da fonte." },
};
/** Curator's choice of the location seal shown on the map (kept after curation). */
function LocationSealSelect({ submissionId, occurrence }: { submissionId: number; occurrence: ExtractedOccurrence }) {
  const queries = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (seal: ExtractedOccurrence["locationPrecision"]) => curationService.setLocationSeal(submissionId, occurrence.id, seal),
    onSuccess: () => {
      setError(null);
      void queries.invalidateQueries({ queryKey: ["curation", "extraction", submissionId] });
      void queries.invalidateQueries({ queryKey: ["dashboard-occurrences"] });
    },
    onError: (cause) => setError(cause instanceof ApiError ? cause.message : "Não foi possível salvar o selo."),
  });
  return (
    <label className="mt-2 block text-xs">
      <span className="font-medium">Selo de localização</span>
      <select value={occurrence.locationPrecision} disabled={mutation.isPending}
        onChange={(event) => mutation.mutate(event.target.value as ExtractedOccurrence["locationPrecision"])}
        className="mt-1 block w-full border border-input bg-background px-2 py-1.5 text-sm">
        {(Object.keys(LOCATION_SEALS) as ExtractedOccurrence["locationPrecision"][]).map((seal) => (
          <option key={seal} value={seal}>{LOCATION_SEALS[seal]}</option>
        ))}
      </select>
      {error && <span role="alert" className="mt-1 block text-destructive">{error}</span>}
    </label>
  );
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") return null;
  return <div className="contents"><dt className="text-muted-foreground">{label}:</dt><dd className="break-words">{value}</dd></div>;
}

/** What the pipeline sent for this article: reading quality, each extracted occurrence and the raw JSON. */
export function ExtractionPanel({ submissionId }: { submissionId: number }) {
  const query = useQuery({
    queryKey: ["curation", "extraction", submissionId],
    queryFn: ({ signal }) => curationService.extraction(submissionId, signal),
    retry: false,
  });
  if (query.isPending) return <p role="status">Carregando extração...</p>;
  if (query.isError || !query.data) return <p role="alert" className="text-destructive">Não foi possível carregar a extração automática.</p>;
  const extraction = query.data;
  const quality = QUALITY[extraction.quality];

  return (
    <Card>
      <CardHeader className="space-y-2">
        <CardTitle><h3>Extração automática</h3></CardTitle>
        <div className={`border px-3 py-2 text-sm ${quality.tone}`}>
          <p className="font-semibold">{quality.label} · {extraction.occurrencesRead} {extraction.occurrencesRead === 1 ? "ocorrência" : "ocorrências"}</p>
          <p className="text-xs">{extraction.readingNote ?? quality.help}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Modelo: {extraction.model ?? "não informado"} · recebida em {formatDate(extraction.receivedAt)} · id {extraction.externalId}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {extraction.occurrences.map((occurrence) => (
          <article key={occurrence.id} className="border border-border p-3">
            <h4 className="text-sm font-semibold">Ocorrência {occurrence.order}: {occurrence.disease ?? "doença não informada"}</h4>
            <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1 text-xs">
              <Field label="Hospedeiro" value={[occurrence.host, occurrence.hostCategory].filter(Boolean).join(" · ")} />
              <Field label="Parasito" value={occurrence.parasite} />
              <Field label="Agente etiológico" value={occurrence.vector} />
              <Field label="Local" value={[occurrence.municipality, occurrence.state].filter(Boolean).join(" / ") || null} />
              <Field label="Ano do evento" value={occurrence.year} />
            </dl>
            <LocationSealSelect submissionId={submissionId} occurrence={occurrence} />
            <OccurrenceExtras extras={occurrence.others} />
          </article>
        ))}
        {extraction.occurrences.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma ocorrência pôde ser lida automaticamente. Preencha os dados a partir da fonte.</p>
        )}
        <details className="text-xs">
          <summary className="cursor-pointer font-medium">Ver conteúdo bruto enviado pelo pipeline</summary>
          <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words border border-border bg-muted/40 p-3">{extraction.rawContent}</pre>
        </details>
      </CardContent>
    </Card>
  );
}
