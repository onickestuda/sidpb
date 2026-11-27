"use client";

import type { ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CuratedOccurrence, ExtractedOccurrence, LocationSeal, UserOccurrence } from "@/entities/submission/submission.types";
import { LOCATION_SEALS } from "@/modules/occurrences/components/OccurrencePanel/OccurrenceProvenance";

/**
 * Editable state for one occurrence, shared by the submission form (user) and the curation form.
 * sourceId links a curated form to the extracted occurrence it came from (to keep its evidence).
 */
export interface OccurrenceDraft {
  key: string;
  sourceId: number | null;
  disease: string; parasite: string; vector: string; host: string; hostCategory: string;
  municipality: string; state: string; latitude: string; longitude: string; year: string;
  locationSeal: LocationSeal; notes: string;
}

let draftCounter = 0;
const nextKey = () => `occurrence-${++draftCounter}`;
const text = (value: string | number | null | undefined) => (value === null || value === undefined ? "" : String(value));
const value = (input: string) => input.trim() || null;

/** Seals the curator can choose. "Só o estado" (ESTADO) is no longer offered; old records still read fine. */
const SELECTABLE_SEALS: LocationSeal[] = ["EXATA", "MUNICIPIO", "SEM_LOCAL"];
/** Legacy/extracted ESTADO rows start as "Sem local confirmado" in the form. */
const selectable = (seal: LocationSeal): LocationSeal => (seal === "ESTADO" ? "SEM_LOCAL" : seal);
const number = (input: string) => (input.trim() ? Number(input) : null);

function sealFor(latitude: unknown, longitude: unknown, municipality: unknown): LocationSeal {
  if (latitude !== null && latitude !== undefined && latitude !== "" && longitude !== null && longitude !== undefined && longitude !== "") return "EXATA";
  return municipality ? "MUNICIPIO" : "SEM_LOCAL";
}

export function emptyDraft(): OccurrenceDraft {
  return {
    key: nextKey(), sourceId: null, disease: "", parasite: "", vector: "", host: "", hostCategory: "",
    municipality: "", state: "", latitude: "", longitude: "", year: "", locationSeal: "MUNICIPIO", notes: "",
  };
}

export function draftFromExtraction(occurrence: ExtractedOccurrence): OccurrenceDraft {
  return {
    key: nextKey(), sourceId: occurrence.id,
    disease: text(occurrence.disease), parasite: text(occurrence.parasite), vector: text(occurrence.vector),
    host: text(occurrence.host), hostCategory: text(occurrence.hostCategory),
    municipality: text(occurrence.municipality), state: text(occurrence.state),
    // Municipality-level rows carry the centroid: never prefill it as if it were an exact point.
    latitude: occurrence.locationPrecision === "EXATA" ? text(occurrence.latitude) : "",
    longitude: occurrence.locationPrecision === "EXATA" ? text(occurrence.longitude) : "",
    year: text(occurrence.year), locationSeal: selectable(occurrence.locationPrecision), notes: "",
  };
}

export function draftFromUser(occurrence: UserOccurrence): OccurrenceDraft {
  return {
    ...emptyDraft(), disease: text(occurrence.disease), parasite: text(occurrence.parasite), vector: text(occurrence.vector),
    host: text(occurrence.host), hostCategory: text(occurrence.hostCategory), municipality: text(occurrence.municipality),
    state: text(occurrence.state), latitude: text(occurrence.latitude), longitude: text(occurrence.longitude),
    year: text(occurrence.year), notes: text(occurrence.notes),
    locationSeal: sealFor(occurrence.latitude, occurrence.longitude, occurrence.municipality),
  };
}

export function draftToUser(draft: OccurrenceDraft): UserOccurrence {
  return {
    disease: value(draft.disease), parasite: value(draft.parasite), vector: value(draft.vector), host: value(draft.host),
    hostCategory: value(draft.hostCategory), year: number(draft.year), state: value(draft.state),
    municipality: value(draft.municipality), latitude: number(draft.latitude), longitude: number(draft.longitude),
    notes: value(draft.notes),
  };
}

export function draftToCurated(draft: OccurrenceDraft): CuratedOccurrence {
  const { notes, ...rest } = draftToUser(draft);
  return { ...rest, notes, sourceId: draft.sourceId, locationSeal: draft.locationSeal };
}

/** True when the user left every field of the occurrence blank (dropped on submit). */
export function isEmptyDraft(draft: OccurrenceDraft): boolean {
  return Object.values(draftToUser(draft)).every((item) => item === null);
}

const FIELDS: { key: keyof OccurrenceDraft; label: string; type?: string }[] = [
  { key: "disease", label: "Doença" },
  { key: "parasite", label: "Parasito" },
  { key: "vector", label: "Agente etiológico" },
  { key: "host", label: "Hospedeiro" },
  { key: "hostCategory", label: "Categoria do hospedeiro" },
  { key: "year", label: "Ano do evento", type: "number" },
  { key: "state", label: "Estado (UF)" },
  { key: "municipality", label: "Município" },
  { key: "latitude", label: "Latitude", type: "number" },
  { key: "longitude", label: "Longitude", type: "number" },
];

interface OccurrenceDraftFormProps {
  draft: OccurrenceDraft;
  title: ReactNode;
  disabled?: boolean;
  /** The curator picks the location seal; submitters do not. */
  showSeal?: boolean;
  onChange(draft: OccurrenceDraft): void;
  onRemove(): void;
}

export function OccurrenceDraftForm({ draft, title, disabled = false, showSeal = false, onChange, onRemove }: OccurrenceDraftFormProps) {
  const id = (field: string) => `${draft.key}-${field}`;
  return (
    <fieldset disabled={disabled} className="space-y-3 rounded-[2px] border border-primary/40 bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <legend className="text-xs font-semibold uppercase tracking-wide text-primary">{title}</legend>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove} aria-label={`Remover ${typeof title === "string" ? title.toLowerCase() : "ocorrência"}`}>
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
        {showSeal && (
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor={id("seal")} className="text-xs">Selo de localização</Label>
            <select id={id("seal")} value={draft.locationSeal}
              onChange={(event) => onChange({ ...draft, locationSeal: event.target.value as LocationSeal })}
              className="block w-full rounded-[2px] border border-input bg-background px-2 py-1.5 text-sm">
              {SELECTABLE_SEALS.map((seal) => <option key={seal} value={seal}>{LOCATION_SEALS[seal]}</option>)}
            </select>
          </div>
        )}
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor={id("notes")} className="text-xs">Observações da ocorrência</Label>
          <Textarea id={id("notes")} rows={2} maxLength={4000} value={draft.notes}
            onChange={(event) => onChange({ ...draft, notes: event.target.value })} />
        </div>
      </div>
    </fieldset>
  );
}
