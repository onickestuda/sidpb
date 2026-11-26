"use client";

import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ArticleData, CuratedOccurrence, ExtractedOccurrence, LocationSeal } from "@/entities/submission/submission.types";
import { LOCATION_SEALS, OccurrenceExtras } from "@/modules/occurrences/components/OccurrencePanel/OccurrenceProvenance";

/** Editable form state for one occurrence (strings while typing). */
export interface OccurrenceDraft {
  key: string;
  sourceId: number | null;
  disease: string; parasite: string; vector: string; host: string; hostCategory: string;
  municipality: string; state: string; latitude: string; longitude: string; year: string;
  locationSeal: LocationSeal; notes: string;
}

let draftCounter = 0;
const nextKey = () => `draft-${++draftCounter}`;
const text = (value: string | number | null | undefined) => (value === null || value === undefined ? "" : String(value));

export function draftFromExtraction(occurrence: ExtractedOccurrence): OccurrenceDraft {
  return {
    key: nextKey(), sourceId: occurrence.id,
    disease: text(occurrence.disease), parasite: text(occurrence.parasite), vector: text(occurrence.vector),
    host: text(occurrence.host), hostCategory: text(occurrence.hostCategory),
    municipality: text(occurrence.municipality), state: text(occurrence.state),
    // Municipality-level rows carry the centroid: never prefill it as if it were an exact point.
    latitude: occurrence.locationPrecision === "EXATA" ? text(occurrence.latitude) : "",
    longitude: occurrence.locationPrecision === "EXATA" ? text(occurrence.longitude) : "",
    year: text(occurrence.year), locationSeal: occurrence.locationPrecision, notes: "",
  };
}

export function draftFromUserData(data: ArticleData): OccurrenceDraft {
  const exact = data.latitude !== null && data.longitude !== null;
  return {
    ...emptyDraft(), disease: text(data.disease), parasite: text(data.parasite), vector: text(data.vector),
    host: text(data.host), municipality: text(data.municipality), state: text(data.state),
    latitude: text(data.latitude), longitude: text(data.longitude), year: text(data.year),
    locationSeal: exact ? "EXATA" : data.municipality ? "MUNICIPIO" : data.state ? "ESTADO" : "SEM_LOCAL",
  };
}

export function emptyDraft(): OccurrenceDraft {
  return {
    key: nextKey(), sourceId: null, disease: "", parasite: "", vector: "", host: "", hostCategory: "",
    municipality: "", state: "", latitude: "", longitude: "", year: "", locationSeal: "MUNICIPIO", notes: "",
  };
}

export function draftToCurated(draft: OccurrenceDraft): CuratedOccurrence {
  const value = (input: string) => input.trim() || null;
  const number = (input: string) => (input.trim() ? Number(input) : null);
  return {
    sourceId: draft.sourceId, disease: value(draft.disease), parasite: value(draft.parasite), vector: value(draft.vector),
    host: value(draft.host), hostCategory: value(draft.hostCategory), municipality: value(draft.municipality),
    state: value(draft.state), latitude: number(draft.latitude), longitude: number(draft.longitude),
    year: number(draft.year), locationSeal: draft.locationSeal, notes: value(draft.notes),
  };
}

const FIELDS: { key: keyof OccurrenceDraft; label: string; type?: string; wide?: boolean }[] = [
  { key: "disease", label: "Doença" },
  { key: "parasite", label: "Parasito" },
  { key: "vector", label: "Agente etiológico" },
  { key: "host", label: "Hospedeiro" },
  { key: "hostCategory", label: "Categoria do hospedeiro" },
  { key: "year", label: "Ano do evento", type: "number" },
  { key: "municipality", label: "Município" },
  { key: "state", label: "Estado (UF)" },
  { key: "latitude", label: "Latitude", type: "number" },
  { key: "longitude", label: "Longitude", type: "number" },
];

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === "") return null;
  return <div className="contents"><dt className="text-muted-foreground">{label}:</dt><dd className="break-words">{value}</dd></div>;
}

/** Left column: what the automatic extraction found (read-only, with its evidence). */
function ExtractedCard({ occurrence, order, discarded, onRestore }: {
  occurrence: ExtractedOccurrence; order: number; discarded: boolean; onRestore(): void;
}) {
  return (
    <article className={`h-full border p-4 ${discarded ? "border-dashed border-border bg-muted/30 opacity-70" : "border-border bg-muted/20"}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ocorrência {order} · extração automática</p>
      <h4 className="mt-1 text-sm font-semibold">{occurrence.disease ?? "Doença não informada"}</h4>
      <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1 text-xs">
        <Field label="Hospedeiro" value={[occurrence.host, occurrence.hostCategory].filter(Boolean).join(" · ")} />
        <Field label="Parasito" value={occurrence.parasite} />
        <Field label="Agente etiológico" value={occurrence.vector} />
        <Field label="Local" value={[occurrence.municipality, occurrence.state].filter(Boolean).join(" / ") || occurrence.locationText} />
        <Field label="Ano do evento" value={occurrence.year} />
      </dl>
      <OccurrenceExtras extras={occurrence.others} />
      {discarded && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium">Descartada: não será registrada.</span>
          <Button type="button" variant="outline" size="sm" onClick={onRestore}><RotateCcw className="size-3.5" />Restaurar formulário</Button>
        </div>
      )}
    </article>
  );
}

/** Right column: the curator's form; only these become occurrences on approval. */
function OccurrenceForm({ draft, order, disabled, onChange, onRemove }: {
  draft: OccurrenceDraft; order: number; disabled: boolean; onChange(draft: OccurrenceDraft): void; onRemove(): void;
}) {
  const id = (field: string) => `${draft.key}-${field}`;
  return (
    <fieldset disabled={disabled} className="h-full space-y-3 border border-primary/40 bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <legend className="text-xs font-semibold uppercase tracking-wide text-primary">Formulário da ocorrência {order}</legend>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove} aria-label={`Remover formulário da ocorrência ${order}`}>
          <Trash2 className="size-4" />Remover
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map(({ key, label, type }) => (
          <div key={key} className="space-y-1">
            <Label htmlFor={id(key)} className="text-xs">{label}</Label>
            <Input id={id(key)} type={type ?? "text"} step="any" value={draft[key] as string}
              onChange={(event) => onChange({ ...draft, [key]: event.target.value })} />
          </div>
        ))}
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor={id("seal")} className="text-xs">Selo de localização</Label>
          <select id={id("seal")} value={draft.locationSeal}
            onChange={(event) => onChange({ ...draft, locationSeal: event.target.value as LocationSeal })}
            className="block w-full border border-input bg-background px-2 py-1.5 text-sm">
            {(Object.keys(LOCATION_SEALS) as LocationSeal[]).map((seal) => <option key={seal} value={seal}>{LOCATION_SEALS[seal]}</option>)}
          </select>
          <p className="text-[11px] text-muted-foreground">Exata exige latitude e longitude; aproximada usa o centro do município.</p>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor={id("notes")} className="text-xs">Outras informações</Label>
          <Textarea id={id("notes")} rows={2} maxLength={4000} value={draft.notes}
            onChange={(event) => onChange({ ...draft, notes: event.target.value })} />
        </div>
      </div>
    </fieldset>
  );
}

interface OccurrenceCurationProps {
  extracted: ExtractedOccurrence[];
  drafts: OccurrenceDraft[];
  onChange(drafts: OccurrenceDraft[]): void;
  disabled?: boolean;
}

/**
 * Extraction occurrence N next to curation form N (side by side on large screens, stacked otherwise).
 * Removing a form discards that extracted occurrence; the curator can add as many forms as needed.
 */
export function OccurrenceCuration({ extracted, drafts, onChange, disabled = false }: OccurrenceCurationProps) {
  const update = (key: string, next: OccurrenceDraft) => onChange(drafts.map((draft) => (draft.key === key ? next : draft)));
  const remove = (key: string) => onChange(drafts.filter((draft) => draft.key !== key));
  const restore = (occurrence: ExtractedOccurrence) => onChange([...drafts, draftFromExtraction(occurrence)]);
  const added = drafts.filter((draft) => draft.sourceId === null);
  let formOrder = 0;

  return (
    <div className="space-y-4">
      {extracted.map((occurrence, index) => {
        const draft = drafts.find((item) => item.sourceId === occurrence.id);
        if (draft) formOrder++;
        return (
          <div key={occurrence.id} className="grid gap-3 lg:grid-cols-2">
            <ExtractedCard occurrence={occurrence} order={index + 1} discarded={!draft} onRestore={() => restore(occurrence)} />
            {draft ? (
              <OccurrenceForm draft={draft} order={formOrder} disabled={disabled}
                onChange={(next) => update(draft.key, next)} onRemove={() => remove(draft.key)} />
            ) : <div className="hidden lg:block" />}
          </div>
        );
      })}
      {added.map((draft) => {
        formOrder++;
        return (
          <div key={draft.key} className="grid gap-3 lg:grid-cols-2">
            <div className="flex items-center border border-dashed border-border p-4 text-xs text-muted-foreground">
              Ocorrência adicionada pelo curador (sem correspondente na extração).
            </div>
            <OccurrenceForm draft={draft} order={formOrder} disabled={disabled}
              onChange={(next) => update(draft.key, next)} onRemove={() => remove(draft.key)} />
          </div>
        );
      })}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {drafts.length === 0
            ? "Nenhuma ocorrência será registrada."
            : `${drafts.length} ${drafts.length === 1 ? "ocorrência será registrada" : "ocorrências serão registradas"} ao aprovar.`}
        </p>
        <Button type="button" variant="outline" disabled={disabled} onClick={() => onChange([...drafts, emptyDraft()])}>
          <Plus className="size-4" />Adicionar ocorrência
        </Button>
      </div>
    </div>
  );
}
