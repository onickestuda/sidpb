import { Badge } from "@/components/ui/badge";
import type { SubmissionStatus } from "@/entities/submission/submission.types";

export const STATUS_LABELS: Record<SubmissionStatus, string> = { PENDING: "Pendente", APPROVED: "Aprovado", REJECTED: "Reprovado" };
const CLASSES: Record<SubmissionStatus, string> = {
  PENDING: "border-amber-300 bg-amber-50 text-amber-900",
  APPROVED: "border-green-300 bg-green-50 text-green-900",
  REJECTED: "border-red-300 bg-red-50 text-red-900",
};
export function SubmissionStatusBadge({ status }: { status: SubmissionStatus }) {
  return <Badge variant="outline" className={CLASSES[status]}>{STATUS_LABELS[status]}</Badge>;
}
