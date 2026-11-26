import type { ExtractionDetail, ExtractionQuality } from "@/entities/submission/submission.types";
import { formatDate } from "@/modules/submissions/components/SubmissionTable";

const QUALITY: Record<ExtractionQuality, { label: string; tone: string; help: string }> = {
  VALIDA: { label: "Leitura completa", tone: "border-primary/30 bg-primary/5 text-primary",
    help: "A extração foi lida por inteiro. Confira cada ocorrência com a fonte." },
  PARCIAL: { label: "Leitura parcial", tone: "border-amber-300 bg-amber-50 text-amber-900",
    help: "A extração veio com defeito; só as ocorrências completas foram aproveitadas. Pode haver dados faltando." },
  ILEGIVEL: { label: "Extração com falha", tone: "border-destructive/40 bg-destructive/5 text-destructive",
    help: "Não foi possível ler a extração automaticamente. Registre as ocorrências a partir da fonte." },
};

/** How well the automatic extraction could be read; its occurrences are shown next to the forms. */
export function ExtractionSummary({ extraction }: { extraction: ExtractionDetail }) {
  const quality = QUALITY[extraction.quality];
  return (
    <div className={`border px-4 py-3 text-sm ${quality.tone}`}>
      <p className="font-semibold">
        {quality.label} · {extraction.occurrencesRead} {extraction.occurrencesRead === 1 ? "ocorrência encontrada" : "ocorrências encontradas"}
      </p>
      <p className="text-xs">{extraction.readingNote ?? quality.help}</p>
      <p className="mt-1 text-xs opacity-80">
        Extração automática{extraction.model ? ` (${extraction.model})` : ""} · recebida em {formatDate(extraction.receivedAt)}
      </p>
    </div>
  );
}
