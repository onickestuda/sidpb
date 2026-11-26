import { formatFileSize } from "./PdfField";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SubmissionDetail } from "@/entities/submission/submission.types";
import { ArticleDataView } from "./ArticleDataView";
import { SubmissionStatusBadge } from "./SubmissionStatusBadge";
import { formatDate } from "./SubmissionTable";

export function SubmissionOverview({ submission: s, pdfUrl, comparison }: { submission: SubmissionDetail; pdfUrl: string; comparison: boolean }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle><h2 className="break-words text-xl">{s.title}</h2></CardTitle>
          <p className="text-sm text-muted-foreground">{s.submittedBy.name} · {formatDate(s.createdAt)}</p>
          <div><SubmissionStatusBadge status={s.status} /></div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild><a href={s.originalLink} target="_blank" rel="noopener noreferrer">Abrir artigo original</a></Button>
          <Button asChild variant="outline"><a href={pdfUrl} target="_blank" rel="noopener noreferrer">Visualizar PDF</a></Button>
          <span className="self-center break-all text-sm text-muted-foreground">{s.pdfName} · {formatFileSize(s.pdfSize)}</span>
        </CardContent>
      </Card>
      <div className={comparison ? "grid gap-6 lg:grid-cols-2" : ""}>
        <Card><CardHeader><CardTitle><h3>Dados informados pelo usuário</h3></CardTitle></CardHeader>
          <CardContent><ArticleDataView data={s.userData} compare={comparison ? s.llmData : null} /></CardContent>
        </Card>
        {comparison && <Card>
          <CardHeader><CardTitle><h3>Dados extraídos pela LLM</h3></CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {s.extractionMock && <p className="border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Extração mock de teste. Os valores abaixo são fictícios e não foram extraídos deste PDF.</p>}
            <p className="text-xs text-muted-foreground">Processamento: {s.extractionStatus === "COMPLETED" ? "Concluído" : s.extractionStatus === "FAILED" ? "Falhou — revisão manual disponível" : "Pendente"} · {s.extractionModel ?? "—"} · {formatDate(s.extractedAt)}</p>
            {s.llmData ? <ArticleDataView data={s.llmData} compare={s.userData} /> : <p className="text-sm text-muted-foreground">Sem dados de extração disponíveis.</p>}
          </CardContent>
        </Card>}
      </div>
      {s.status !== "PENDING" && <Card>
        <CardHeader><CardTitle><h3>Resultado da curadoria</h3></CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p>{s.reviewedBy?.name} · {formatDate(s.reviewedAt)}</p>
          {s.rejectionReason && <div><p className="font-medium">Motivo da reprovação</p><p className="whitespace-pre-wrap break-words">{s.rejectionReason}</p></div>}
          {s.curatedData && <ArticleDataView data={s.curatedData} />}
        </CardContent>
      </Card>}
    </div>
  );
}
