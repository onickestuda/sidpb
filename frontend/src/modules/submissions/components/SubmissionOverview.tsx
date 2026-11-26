import { formatFileSize } from "./PdfField";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SubmissionDetail } from "@/entities/submission/submission.types";
import { ArticleDataView, UserOccurrencesView } from "./ArticleDataView";
import { SubmissionStatusBadge } from "./SubmissionStatusBadge";
import { CurationStamp } from "./CurationStamp";
import { formatDate } from "./SubmissionTable";

/** showSuggestions: list the occurrences the submitter suggested (the curator sees them in their own column). */
export function SubmissionOverview({ submission: s, pdfUrl, showSuggestions }: { submission: SubmissionDetail; pdfUrl: string; showSuggestions: boolean }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle><h2 className="break-words text-xl">{s.title}</h2></CardTitle>
          <p className="text-sm text-muted-foreground">{s.submittedBy.name} · {formatDate(s.createdAt)}</p>
          <div><SubmissionStatusBadge status={s.status} /></div>
          <CurationStamp status={s.status} submittedBy={s.submittedBy} reviewedBy={s.reviewedBy} reviewedAt={s.reviewedAt} />
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {s.originalLink && <Button asChild><a href={s.originalLink} target="_blank" rel="noopener noreferrer">Abrir artigo original</a></Button>}
          {s.pdfName && <Button asChild variant="outline"><a href={pdfUrl} target="_blank" rel="noopener noreferrer">Visualizar PDF</a></Button>}
          {s.pdfName && <span className="self-center break-all text-sm text-muted-foreground">{s.pdfName} · {formatFileSize(s.pdfSize ?? 0)}</span>}
          {s.origin === "EXTRACAO" && <span className="self-center text-sm text-muted-foreground">Recebida do pipeline de extração automática · sem PDF anexado</span>}
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle><h3>Dados da fonte</h3></CardTitle></CardHeader>
        <CardContent><ArticleDataView data={s.userData} fields="source" /></CardContent>
      </Card>
      {showSuggestions && s.origin !== "EXTRACAO" && <Card>
        <CardHeader><CardTitle><h3>Ocorrências informadas</h3></CardTitle></CardHeader>
        <CardContent><UserOccurrencesView data={s.userData} /></CardContent>
      </Card>}
      {s.status !== "PENDING" && <Card>
        <CardHeader><CardTitle><h3>Resultado da curadoria</h3></CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {s.rejectionReason && <div><p className="font-medium">Motivo da reprovação</p><p className="whitespace-pre-wrap break-words">{s.rejectionReason}</p></div>}
          {s.curatedData && <ArticleDataView data={s.curatedData} fields="source" />}
        </CardContent>
      </Card>}
    </div>
  );
}
