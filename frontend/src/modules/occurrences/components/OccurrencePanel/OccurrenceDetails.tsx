import type { Occurrence } from "@/entities/occurrence/occurrence.types";
import { formatOccurrenceDisplayDate, occurrenceField } from "../../utils/occurrence-presentation";
import { OccurrenceSources } from "./OccurrenceSources";
import { etiologicAgent } from "@/lib/etiologic-agent";

export function OccurrenceDetails({ occurrence }: { occurrence: Occurrence }) {
  const fields = [
    ["Cidade", occurrenceField(occurrence.city)],
    ["Estado", occurrenceField(occurrence.state)],
    ["Coordenadas", Number.isFinite(occurrence.coordinates[0]) && Number.isFinite(occurrence.coordinates[1])
      ? `${occurrence.coordinates[1].toFixed(4)}, ${occurrence.coordinates[0].toFixed(4)}` : null],
    ["Doença", occurrenceField(occurrence.disease)],
    ["Data", formatOccurrenceDisplayDate(occurrence.date)],
    ["Hospedeiro", occurrenceField(occurrence.host)],
    ["Categoria", occurrenceField(occurrence.hostCategory)],
    ["Sexo", occurrenceField(occurrence.hostSex)],
    ["Idade", occurrenceField(occurrence.hostAge)],
    ["Agente etiológico", etiologicAgent(occurrenceField(occurrence.parasite), occurrenceField(occurrence.vector))],
    ["Desfecho", occurrenceField(occurrence.outcome)],
  ].filter(([, value]) => value);

  return (
    <div className="space-y-4 break-words">
      <p className="text-xs text-muted-foreground">Ocorrência #{occurrence.id}</p>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-xs">
        {fields.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {occurrence.articles?.length > 0 && (
        <section className="space-y-3 border-t border-border pt-3" aria-label="Fontes da ocorrência">
          <h4 className="text-xs font-semibold">Artigos e fontes</h4>
          <OccurrenceSources articles={occurrence.articles} />
        </section>
      )}
    </div>
  );
}
