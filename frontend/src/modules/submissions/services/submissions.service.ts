import type { ArticleData, SubmissionDetail, SubmissionPage } from "@/entities/submission/submission.types";
import { apiUrl, apiRequest } from "@/lib/apiClient";

export const submissionsService = {
  create(userId: number, originalLink: string, userData: ArticleData, pdf: File) {
    const body = new FormData();
    // PROVISÓRIO: userId vem do Zustand; será substituído pela identidade do servidor.
    body.append("data", new Blob([JSON.stringify({ userId, originalLink, userData })], { type: "application/json" }));
    body.append("pdf", pdf);
    return apiRequest<SubmissionDetail>("/api/submissions", { method: "POST", body, timeoutMs: 60000 });
  },
  list(userId: number, page: number, signal?: AbortSignal) {
    return apiRequest<SubmissionPage>(`/api/submissions/user/${userId}`, { params: { page, size: 10 }, signal });
  },
  get(id: number, userId: number, signal?: AbortSignal) {
    return apiRequest<SubmissionDetail>(`/api/submissions/${id}`, { params: { userId }, signal });
  },
  pdfUrl(id: number, userId: number) {
    return apiUrl(`/api/submissions/${id}/pdf?userId=${userId}`);
  },
};
