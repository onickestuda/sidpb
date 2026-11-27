import type { Occurrence } from "@/entities/occurrence/occurrence.types";

type ProvenanceOccurrence = Pick<Occurrence, "curation" | "locationPrecision" | "extractionModel" | "extras" | "state" | "city">;

/** Full location seal texts, used by the curator's select and as badge tooltips. */
export const LOCATION_SEALS: Record<Occurrence["locationPrecision"], string> = {
  EXATA: "Localização exata",
  MUNICIPIO: "Localização aproximada, sem coordenadas exatas",
  ESTADO: "Localização imprecisa: só o estado é conhecido",
  SEM_LOCAL: "Sem local confirmado",
};

/** Traffic-light states of an occurrence: one dot for curation, one for location precision. */
export const STATUS_DOTS = {
  curada: { label: "Curada", tooltip: "Verificada por um curador.", color: "bg-green-600" },
  naoCurada: { label: "Não curada", tooltip: "Extraída automaticamente e ainda não verificada por um curador.", color: "bg-red-600" },
  exata: { label: "Localização exata", tooltip: LOCATION_SEALS.EXATA, color: "bg-blue-600" },
  aproximada: { label: "Localização aproximada", tooltip: "Localização aproximada (município ou estado), sem coordenadas exatas.", color: "bg-yellow-400" },
  semLocal: { label: "Sem localização", tooltip: LOCATION_SEALS.SEM_LOCAL, color: "bg-orange-700" },
} as const;
type StatusDot = keyof typeof STATUS_DOTS;

const LOCATION_DOT: Record<Occurrence["locationPrecision"], StatusDot> = {
  EXATA: "exata", MUNICIPIO: "aproximada", ESTADO: "aproximada", SEM_LOCAL: "semLocal",
};

function Dot({ status }: { status: StatusDot }) {
  const { label, tooltip, color } = STATUS_DOTS[status];
  return (
    <span title={`${label}: ${tooltip}`} className={`inline-block size-2.5 shrink-0 rounded-full ${color}`}>
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** Curation and location dots, shown inline next to the occurrence title. */
export function OccurrenceStatusDots({ occurrence }: { occurrence: ProvenanceOccurrence }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label="Situação da ocorrência">
      <Dot status={occurrence.curation === "NAO_CURADA" ? "naoCurada" : "curada"} />
      <Dot status={LOCATION_DOT[occurrence.locationPrecision]} />
    </span>
  );
}

/** Compact legend of the dots. */
export function OccurrenceStatusLegend() {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground" aria-label="Legenda">
      {(Object.keys(STATUS_DOTS) as StatusDot[]).map((status) => (
        <li key={status} className="inline-flex items-center gap-1">
          <span aria-hidden className={`inline-block size-2.5 rounded-full ${STATUS_DOTS[status].color}`} />
          {STATUS_DOTS[status].label}
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
      {flags && <p className="text-xs text-amber-900">Alertas da extração automática: {flags}</p>}
      {evidence.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium">Trechos do artigo usados na extração automática</p>
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
