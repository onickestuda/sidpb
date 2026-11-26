import type { ArticleData, UserOccurrence } from "@/entities/submission/submission.types";
import { userOccurrences } from "@/entities/submission/submission.types";

const SOURCE_FIELDS: [keyof ArticleData, string][] = [
  ["title", "Título"], ["authors", "Autores"], ["year", "Ano"], ["doi", "DOI"], ["source", "Revista / fonte"], ["notes", "Observações"],
];
const ALL_FIELDS: [keyof ArticleData, string][] = [
  ...SOURCE_FIELDS.slice(0, 5), ["disease", "Doença"], ["parasite", "Parasito"], ["vector", "Agente etiológico"],
  ["host", "Hospedeiro"], ["state", "Estado"], ["municipality", "Município"],
  ["latitude", "Latitude"], ["longitude", "Longitude"], ["notes", "Observações"],
];
function value(data: ArticleData, key: keyof ArticleData) {
  const field = data[key];
  return Array.isArray(field) ? field.join("; ") : field === null || field === undefined ? "" : String(field);
}

/** "source": only the article (fonte) fields; "all": legacy view including the root occurrence fields. */
export function ArticleDataView({ data, compare, fields = "all" }: { data: ArticleData; compare?: ArticleData | null; fields?: "source" | "all" }) {
  return (
    <dl className="space-y-3">
      {(fields === "source" ? SOURCE_FIELDS : ALL_FIELDS).map(([key, label]) => {
        const content = value(data, key);
        const different = compare && content.trim().toLowerCase() !== value(compare, key).trim().toLowerCase();
        return <div key={key} className={different ? "border-l-2 border-amber-400 bg-amber-50/50 p-2" : "p-2"}>
          <dt className="text-xs font-medium text-muted-foreground">{label}{different && <span className="ml-2 text-amber-800">Diferente</span>}</dt>
          <dd className="whitespace-pre-wrap break-words text-sm">{content || "Não informado"}</dd>
        </div>;
      })}
    </dl>
  );
}

const OCCURRENCE_FIELDS: [keyof UserOccurrence, string][] = [
  ["disease", "Doença"], ["parasite", "Parasito"], ["vector", "Agente etiológico"], ["host", "Hospedeiro"],
  ["hostCategory", "Categoria do hospedeiro"], ["year", "Ano do evento"], ["state", "Estado"], ["municipality", "Município"],
  ["latitude", "Latitude"], ["longitude", "Longitude"], ["notes", "Observações"],
];

/** Occurrences the submitter suggested (new list or legacy single occurrence). */
export function UserOccurrencesView({ data }: { data: ArticleData }) {
  const occurrences = userOccurrences(data);
  if (occurrences.length === 0) return <p className="text-sm text-muted-foreground">Nenhuma ocorrência informada; só os dados da fonte foram enviados.</p>;
  return (
    <ol className="grid gap-3 md:grid-cols-2">
      {occurrences.map((occurrence, index) => (
        <li key={index} className="rounded-[2px] border border-border p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ocorrência {index + 1}</p>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1 text-sm">
            {OCCURRENCE_FIELDS.filter(([key]) => occurrence[key] !== null && occurrence[key] !== "").map(([key, label]) => (
              <div key={key} className="contents"><dt className="text-muted-foreground">{label}:</dt><dd className="break-words">{String(occurrence[key])}</dd></div>
            ))}
          </dl>
        </li>
      ))}
    </ol>
  );
}
