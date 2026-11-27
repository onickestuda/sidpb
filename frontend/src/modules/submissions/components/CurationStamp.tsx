import type { SubmissionPerson, SubmissionStatus } from "@/entities/submission/submission.types";
import { cn } from "@/lib/utils";
import { formatDate } from "./SubmissionTable";

// Curators are shown only by this public code (never the name or e-mail).
export const curatorCode = (person: SubmissionPerson) => (person.code ? `CUR-${person.code}` : null);

export const isSelfReview = (submittedBy: SubmissionPerson, reviewedBy: SubmissionPerson | null) =>
  Boolean(reviewedBy && reviewedBy.id === submittedBy.id);

interface CurationStampProps {
  status: SubmissionStatus;
  submittedBy: SubmissionPerson;
  reviewedBy: SubmissionPerson | null;
  reviewedAt: string | null;
}

export function CurationStamp({ status, submittedBy, reviewedBy, reviewedAt }: CurationStampProps) {
  if (status === "PENDING" || !reviewedBy) return null;
  const approved = status === "APPROVED";
  const code = curatorCode(reviewedBy);
  const self = isSelfReview(submittedBy, reviewedBy);

  return (
    <div
      role="note"
      aria-label={`${approved ? "Aprovado" : "Reprovado"} por ${code ?? "curador"}`}
      className={cn(
        "inline-flex max-w-full border-2 border-dashed px-4 py-3",
        approved ? "border-primary/60 bg-primary/5 text-primary" : "border-destructive/60 bg-destructive/5 text-destructive",
      )}
    >
      <div className="min-w-0 space-y-0.5">
        <p className="text-xs font-semibold uppercase tracking-wide">{approved ? "Aprovado na curadoria" : "Reprovado na curadoria"}</p>
        <p className="text-sm text-foreground">
          Curado por <span className="font-mono font-medium">{code ?? "—"}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDate(reviewedAt)}
          {self && <span className="ml-2 border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-amber-900">Autoavaliação</span>}
        </p>
      </div>
    </div>
  );
}
