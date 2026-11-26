import { CircleHelp, MapPinOff, MapPinned, MapPin, type LucideIcon } from "lucide-react";
import type { Occurrence } from "@/entities/occurrence/occurrence.types";

type ProvenanceOccurrence = Pick<Occurrence, "curation" | "locationPrecision" | "extractionModel" | "extras" | "state" | "city">;

/** Full location seal texts, used by the curator's select and as badge tooltips. */
export const LOCATION_SEALS: Record<Occurrence["locationPrecision"], string> = {
  EXATA: "Localização exata",
  MUNICIPIO: "Localização aproximada, sem coordenadas exatas",
  ESTADO: "Localização imprecisa: só o estado é conhecido",
  SEM_LOCAL: "Sem local confirmado",
};

interface SealBadge {
  id: string;
  label: string;
  tooltip: string;
  icon: LucideIcon;
  tone: string;
}

/**
 * Exception badges: only what calls for caution is shown, so curated occurrences with an exact location
 * stay clean. To add a new badge, add one rule here; the layout does not change.
 */
const SEAL_RULES: ((occurrence: ProvenanceOccurrence) => SealBadge | null)[] = [
  (occurrence) => occurrence.curation === "NAO_CURADA" ? {
    id: "nao-curada", label: "Não curada", icon: CircleHelp,
    tooltip: "Extraída automaticamente e ainda não verificada por um curador.",
    tone: "border-amber-300 bg-amber-50 text-amber-900",
  } : null,
  (occurrence) => ({
    EXATA: null,
    MUNICIPIO: { id: "loc-aproximada", label: "Loc. aproximada", icon: MapPinned, tooltip: LOCATION_SEALS.MUNICIPIO,
      tone: "border-blue-300 bg-blue-50 text-blue-900" },
    ESTADO: { id: "so-estado", label: "Só estado", icon: MapPin, tooltip: LOCATION_SEALS.ESTADO,
      tone: "border-sky-300 bg-sky-50 text-sky-900" },
    SEM_LOCAL: { id: "sem-local", label: "Sem local", icon: MapPinOff, tooltip: LOCATION_SEALS.SEM_LOCAL,
      tone: "border-slate-300 bg-slate-100 text-slate-700" },
  } satisfies Record<Occurrence["locationPrecision"], SealBadge | null>)[occurrence.locationPrecision],
];

/** Mini badges side by side (curation, location precision...) on every occurrence card. */
export function OccurrenceCurationNote({ occurrence }: { occurrence: ProvenanceOccurrence }) {
  const badges = SEAL_RULES.map((rule) => rule(occurrence)).filter((badge): badge is SealBadge => badge !== null);
  if (badges.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Selos da ocorrência">
      {badges.map(({ id, label, tooltip, icon: Icon, tone }) => (
        <li key={id} title={tooltip}
          className={`inline-flex items-center gap-1 rounded-[2px] border px-1.5 py-0.5 text-[11px] font-medium leading-tight ${tone}`}>
          <Icon className="size-3 shrink-0" aria-hidden />{label}
          <span className="sr-only">: {tooltip}</span>
        </li>
      ))}
    </ul>
  );
}

const EXTRA_LABELS: Record<string, string> = {
  event_year: "Ano do evento",
  quantity: "Quantidade",
  record_type: "Tipo de registro",
  body_part: "Parte do corpo",
  treatment: "Tratamento",
  outcome: "Desfecho",
  collection_date: "Data de coleta",
  host_sex: "Sexo do hospedeiro",
  host_age: "Idade do hospedeiro",
  disease_original: "Doença (como no texto)",
  parasite_raw_name: "Parasito (como no texto)",
  location_raw: "Local (como no texto)",
  location_note: "Observação sobre o local",
};
const RECORD_TYPES: Record<string, string> = { aggregate: "agregado (vários casos)", individual: "caso individual" };

interface Evidence { text?: string; pages?: number[]; type?: string; caption?: string | null }

function display(key: string, value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (key === "record_type" && typeof value === "string") return RECORD_TYPES[value] ?? value;
  if (Array.isArray(value)) return value.length ? value.map((item) => display(key, item)).filter(Boolean).join("; ") : null;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** "Outros": everything outside the fixed schema, plus the evidence quotes the extraction relied on. */
export function OccurrenceExtras({ extras }: { extras: Record<string, unknown> }) {
  const evidence = Array.isArray(extras.evidence) ? (extras.evidence as Evidence[]).filter((item) => item?.text) : [];
  const known = Object.entries(EXTRA_LABELS)
    .map(([key, label]) => [label, display(key, extras[key])] as const)
    .filter(([, value]) => value);
  const unknown = Object.entries(extras)
    .filter(([key]) => !(key in EXTRA_LABELS) && key !== "evidence" && key !== "review_flags")
    .map(([key, value]) => [key, display(key, value)] as const)
    .filter(([, value]) => value);
  const flags = display("review_flags", extras.review_flags);
  if (!known.length && !unknown.length && !evidence.length && !flags) return null;

  return (
    <section className="mt-3 space-y-3 border-t border-border pt-3" aria-label="Outras informações">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Outras informações</h4>
      {(known.length > 0 || unknown.length > 0) && (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1 text-xs">
          {[...known, ...unknown].map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}:</dt>
              <dd className="break-words">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {flags && <p className="text-xs text-amber-900">Alertas da extração: {flags}</p>}
      {evidence.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium">Trechos do artigo usados na extração</p>
          {evidence.map((item, index) => (
            <blockquote key={index} className="border-l-2 border-primary/40 pl-2 text-xs text-muted-foreground">
              <p className="whitespace-pre-wrap break-words">{item.text}</p>
              {item.pages?.length ? <footer className="mt-0.5 text-[11px]">p. {item.pages.join(", ")}</footer> : null}
            </blockquote>
          ))}
        </div>
      )}
    </section>
  );
}
