import type { ArticleData, CuratedOccurrence, CurationFacets, CurationFilters, SpecialtySelection, ExtractionDetail, SubmissionDetail, SubmissionPage } from "@/entities/submission/submission.types";
import { ApiError, apiUrl, apiRequest } from "@/lib/apiClient";

export const curationService = {
  list(filters: CurationFilters, signal?: AbortSignal) {
    return apiRequest<SubmissionPage>("/api/curation/submissions", { params: { ...filters, size: 10 }, signal });
  },
  facets(status: CurationFilters["status"], signal?: AbortSignal) {
    return apiRequest<CurationFacets>("/api/curation/submissions/facetas", { params: { status }, signal });
  },
  /** The logged-in curator's saved specialty ("Minhas áreas"), stored in their account. */
  specialty(signal?: AbortSignal) {
    return apiRequest<SpecialtySelection>("/api/curation/especialidade", { signal });
  },
  saveSpecialty(selection: SpecialtySelection) {
    return apiRequest<SpecialtySelection>("/api/curation/especialidade", { method: "PUT", body: selection });
  },
  get(id: number, signal?: AbortSignal) {
    return apiRequest<SubmissionDetail>(`/api/curation/submissions/${id}`, { signal });
  },
  /** occurrences: the curated forms; they replace whatever the extraction found. */
  approve(id: number, curatorId: number, curatedData: ArticleData, occurrences: CuratedOccurrence[]) {
    return apiRequest<SubmissionDetail>(`/api/curation/submissions/${id}/approve`, {
      method: "POST", body: { curatorId, curatedData, occurrences },
    });
  },
  reject(id: number, curatorId: number, reason: string) {
    return apiRequest<SubmissionDetail>(`/api/curation/submissions/${id}/reject`, {
      method: "POST", body: { curatorId, reason },
    });
  },
  /** Null when the submission has no automatic extraction. */
  async extraction(id: number, signal?: AbortSignal) {
    try {
      return await apiRequest<ExtractionDetail>(`/api/curation/submissions/${id}/extracao`, { signal });
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },
  pdfUrl(id: number) { return apiUrl(`/api/curation/submissions/${id}/pdf`); },
};
