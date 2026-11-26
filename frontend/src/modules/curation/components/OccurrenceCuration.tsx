"use client";

import type { ReactNode } from "react";
import { CopyPlus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ExtractedOccurrence, ExtractionDetail, UserOccurrence } from "@/entities/submission/submission.types";
import { OccurrenceExtras } from "@/modules/occurrences/components/OccurrencePanel/OccurrenceProvenance";
import {
  OccurrenceDraftForm, draftFromExtraction, draftFromUser, emptyDraft, type OccurrenceDraft,
} from "@/modules/submissions/components/OccurrenceDraftForm";
import { ExtractionSummary } from "./ExtractionSummary";

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") return null;
  return <div className="contents"><dt className="text-muted-foreground">{label}:</dt><dd className="break-words">{value}</dd></div>;
}

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0 space-y-3" aria-label={title}>
      <header className="border-b border-border pb-2">
        <h5 className="text-sm font-semibold">{title}</h5>
      </header>
      {children}
    </section>
  );
}

/** Read-only card (user suggestion or LLM extraction) with a quick copy into the curator's column. */
function SourceCard({ title, onCopy, children }: { title: string; onCopy(): void; children: ReactNode }) {
  return (
    <article className="space-y-2 rounded-[2px] border border-border bg-muted/20 p-3">
      <div className="flex items-start justify-between gap-2">
        <h6 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h6>
        <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-xs" onClick={onCopy}>
          <CopyPlus className="size-3.5" />Copiar para curadoria
        </Button>
      </div>
      {children}
    </article>
  );
}

function UserCard({ occurrence, order, onCopy }: { occurrence: UserOccurrence; order: number; onCopy(): void }) {
  return (
    <SourceCard title={`Sugestão ${order}`} onCopy={onCopy}>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1 text-xs">
        <Field label="Doença" value={occurrence.disease} />
        <Field label="Hospedeiro" value={[occurrence.host, occurrence.hostCategory].filter(Boolean).join(" · ")} />
        <Field label="Parasito" value={occurrence.parasite} />
        <Field label="Agente etiológico" value={occurrence.vector} />
        <Field label="Local" value={[occurrence.municipality, occurrence.state].filter(Boolean).join(" / ")} />
        <Field label="Coordenadas" value={occurrence.latitude !== null && occurrence.longitude !== null ? `${occurrence.latitude}, ${occurrence.longitude}` : null} />
        <Field label="Ano do evento" value={occurrence.year} />
        <Field label="Observações" value={occurrence.notes} />
      </dl>
    </SourceCard>
  );
}

function ExtractedCard({ occurrence, order, onCopy }: { occurrence: ExtractedOccurrence; order: number; onCopy(): void }) {
  return (
    <SourceCard title={`Ocorrência ${order}`} onCopy={onCopy}>
      <p className="text-sm font-semibold">{occurrence.disease ?? "Doença não informada"}</p>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1 text-xs">
        <Field label="Hospedeiro" value={[occurrence.host, occurrence.hostCategory].filter(Boolean).join(" · ")} />
        <Field label="Parasito" value={occurrence.parasite} />
        <Field label="Agente etiológico" value={occurrence.vector} />
        <Field label="Local" value={[occurrence.municipality, occurrence.state].filter(Boolean).join(" / ") || occurrence.locationText} />
        <Field label="Ano do evento" value={occurrence.year} />
      </dl>
      <OccurrenceExtras extras={occurrence.others} />
    </SourceCard>
  );
}

interface OccurrenceCurationProps {
  /** Null when the submission came from the pipeline (no person suggested occurrences). */
  userSuggestions: UserOccurrence[] | null;
  extraction: ExtractionDetail | null;
  drafts: OccurrenceDraft[];
  onChange(drafts: OccurrenceDraft[]): void;
  disabled?: boolean;
}

/**
 * Three independent columns: what the user suggested, what the LLM extracted and what the curator
 * confirms. Only the third column is saved and published on approval; the other two can be copied in.
 */
export function OccurrenceCuration({ userSuggestions, extraction, drafts, onChange, disabled = false }: OccurrenceCurationProps) {
  const add = (draft: OccurrenceDraft) => onChange([...drafts, draft]);
  const update = (key: string, next: OccurrenceDraft) => onChange(drafts.map((draft) => (draft.key === key ? next : draft)));
  const remove = (key: string) => onChange(drafts.filter((draft) => draft.key !== key));
  const columns = userSuggestions === null ? "xl:grid-cols-2" : "xl:grid-cols-3";

  return (
    <div className={`grid items-start gap-6 ${columns}`}>
      {userSuggestions !== null && (
        <Column title="Submetidas">
          {userSuggestions.length === 0
            ? <p className="text-xs text-muted-foreground">Nenhuma ocorrência informada pelo usuário.</p>
            : userSuggestions.map((occurrence, index) => (
              <UserCard key={index} occurrence={occurrence} order={index + 1} onCopy={() => add(draftFromUser(occurrence))} />
            ))}
        </Column>
      )}

      <Column title="Extração automática">
        {extraction ? <ExtractionSummary extraction={extraction} /> : (
          <p className="text-xs text-muted-foreground">Sem extração automática para esta submissão.</p>
        )}
        {extraction?.occurrences.map((occurrence, index) => (
          <ExtractedCard key={occurrence.id} occurrence={occurrence} order={index + 1} onCopy={() => add(draftFromExtraction(occurrence))} />
        ))}
      </Column>

      <Column title="Registro final">
        {drafts.map((draft, index) => (
          <OccurrenceDraftForm key={draft.key} draft={draft} title={`Ocorrência ${index + 1}`} showSeal disabled={disabled}
            onChange={(next) => update(draft.key, next)} onRemove={() => remove(draft.key)} />
        ))}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {drafts.length === 0 ? "Nenhuma ocorrência será registrada." : `${drafts.length} ${drafts.length === 1 ? "será registrada" : "serão registradas"} ao aprovar.`}
          </p>
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => add(emptyDraft())}>
            <Plus className="size-4" />Adicionar ocorrência
          </Button>
        </div>
      </Column>
    </div>
  );
}
