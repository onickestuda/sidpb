import type { ArticleData, ExtractedOccurrence, ExtractionDetail, CurationFilters, SubmissionDetail, SubmissionPage } from "@/entities/submission/submission.types";
import { apiUrl, apiRequest } from "@/lib/apiClient";

export const curationService = {
  list(filters: CurationFilters, signal?: AbortSignal) {
    return apiRequest<SubmissionPage>("/api/curation/submissions", { params: { ...filters, size: 10 }, signal });
  },
  get(id: number, signal?: AbortSignal) {
    return apiRequest<SubmissionDetail>(`/api/curation/submissions/${id}`, { signal });
  },
  approve(id: number, curatorId: number, curatedData: ArticleData) {
    return apiRequest<SubmissionDetail>(`/api/curation/submissions/${id}/approve`, {
      method: "POST", body: { curatorId, curatedData },
    });
  },
  reject(id: number, curatorId: number, reason: string) {
    return apiRequest<SubmissionDetail>(`/api/curation/submissions/${id}/reject`, {
      method: "POST", body: { curatorId, reason },
    });
  },
  setLocationSeal(id: number, occurrenceId: number, precisaoLocal: ExtractedOccurrence["locationPrecision"]) {
    return apiRequest<ExtractedOccurrence>(`/api/curation/submissions/${id}/ocorrencias/${occurrenceId}/precisao`, {
      method: "PUT", body: { precisaoLocal },
    });
  },
  extraction(id: number, signal?: AbortSignal) {
    return apiRequest<ExtractionDetail>(`/api/curation/submissions/${id}/extracao`, { signal });
  },
  pdfUrl(id: number) { return apiUrl(`/api/curation/submissions/${id}/pdf`); },
};
