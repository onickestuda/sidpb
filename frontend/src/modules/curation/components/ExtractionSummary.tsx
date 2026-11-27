import type { ExtractionDetail, ExtractionQuality } from "@/entities/submission/submission.types";

/** Short warning only when the extraction could not be read completely. */
const WARNINGS: Partial<Record<ExtractionQuality, { text: string; tone: string }>> = {
  PARCIAL: { text: "Leitura parcial: pode haver dados faltando.", tone: "border-amber-300 bg-amber-50 text-amber-900" },
  ILEGIVEL: { text: "Extração automática com falha: registre a partir da fonte.", tone: "border-destructive/40 bg-destructive/5 text-destructive" },
};

export function ExtractionSummary({ extraction }: { extraction: ExtractionDetail }) {
  const warning = WARNINGS[extraction.quality];
  const count = extraction.occurrencesRead;
  return (
    <div className={`rounded-[2px] border px-3 py-2 text-sm ${warning?.tone ?? "border-primary/30 bg-primary/5 text-primary"}`}>
      <p className="font-medium">{count} {count === 1 ? "ocorrência encontrada" : "ocorrências encontradas"}</p>
      {warning && <p className="text-xs">{warning.text}</p>}
    </div>
  );
}
