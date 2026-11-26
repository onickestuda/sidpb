import Link from "next/link";
import { curatorCode, isSelfReview } from "./CurationStamp";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SubmissionPage } from "@/entities/submission/submission.types";
import { SubmissionStatusBadge } from "./SubmissionStatusBadge";

export function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "—";
}

export function SubmissionTable({ data, mode, onPage, isFetching }: {
  data: SubmissionPage; mode: "user" | "curator"; onPage(page: number): void; isFetching: boolean;
}) {
  const base = mode === "user" ? "/usuario" : "/curador";
  return (
    <div className="space-y-4">
      {data.items.length === 0 ? <p className="py-6 text-muted-foreground">Nenhuma submissão encontrada.</p> : (
        <Table>
          <TableHeader><TableRow>
            <TableHead>Artigo</TableHead><TableHead>Data de envio</TableHead>
            {mode === "curator" && <TableHead>Enviado por</TableHead>}
            <TableHead>Status</TableHead>
            {mode === "curator" && <><TableHead>Decisão por</TableHead><TableHead>Data da decisão</TableHead></>}
          </TableRow></TableHeader>
          <TableBody>{data.items.map(item => (
            <TableRow key={item.id}>
              <TableCell className="max-w-sm whitespace-normal">
                <Link className="font-medium text-primary underline underline-offset-4" href={`${base}/submissoes/${item.id}`}>{item.title}</Link>
                {mode === "curator" && (item.originalLink ? <a className="mt-1 block text-xs text-muted-foreground underline" href={item.originalLink} target="_blank" rel="noopener noreferrer">Fonte original</a> : <span className="mt-1 block text-xs text-muted-foreground">Extração automática</span>)}
              </TableCell>
              <TableCell>{formatDate(item.createdAt)}</TableCell>
              {mode === "curator" && <TableCell>{item.submittedBy.name}</TableCell>}
              <TableCell><SubmissionStatusBadge status={item.status} /></TableCell>
              {mode === "curator" && <><TableCell>{item.reviewedBy ? <>{item.reviewedBy.name}{curatorCode(item.reviewedBy) && <span className="block font-mono text-xs text-muted-foreground">{curatorCode(item.reviewedBy)}{isSelfReview(item.submittedBy, item.reviewedBy) && " · autoavaliação"}</span>}</> : "—"}</TableCell><TableCell>{formatDate(item.reviewedAt)}</TableCell></>}
            </TableRow>
          ))}</TableBody>
        </Table>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{data.totalElements} registro(s) · Página {data.page + 1} de {Math.max(1, data.totalPages)}</p>
        <div className="flex gap-2">
          <Button variant="outline" disabled={isFetching || data.page === 0} onClick={() => onPage(data.page - 1)}>Anterior</Button>
          <Button variant="outline" disabled={isFetching || data.page + 1 >= data.totalPages} onClick={() => onPage(data.page + 1)}>Próxima</Button>
        </div>
      </div>
    </div>
  );
}
