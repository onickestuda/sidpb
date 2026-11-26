import type { ArticleData } from "@/entities/submission/submission.types";

const FIELDS: [keyof ArticleData, string][] = [
  ["title", "Título"], ["authors", "Autores"], ["year", "Ano"], ["doi", "DOI"],
  ["source", "Fonte"], ["disease", "Doença"], ["parasite", "Parasito"], ["vector", "Vetor"],
  ["host", "Hospedeiro"], ["state", "Estado"], ["municipality", "Município"],
  ["latitude", "Latitude"], ["longitude", "Longitude"], ["notes", "Observações"],
];
function value(data: ArticleData, key: keyof ArticleData) {
  const field = data[key];
  return Array.isArray(field) ? field.join("; ") : field === null || field === undefined ? "" : String(field);
}

export function ArticleDataView({ data, compare }: { data: ArticleData; compare?: ArticleData | null }) {
  return (
    <dl className="space-y-3">
      {FIELDS.map(([key, label]) => {
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
