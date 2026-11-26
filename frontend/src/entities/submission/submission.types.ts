export type SubmissionStatus = "PENDING" | "APPROVED" | "REJECTED";
export type ExtractionStatus = "PENDING" | "COMPLETED" | "FAILED";

export interface ArticleData {
  title: string;
  authors: string[] | null;
  year: number | null;
  doi: string | null;
  disease: string | null;
  parasite: string | null;
  vector: string | null;
  host: string | null;
  state: string | null;
  municipality: string | null;
  latitude: number | null;
  longitude: number | null;
  source: string | null;
  notes: string | null;
}

// code: public 6-hex identifier from the API (never the e-mail); shown as CUR-XXXXXX in curation stamps.
export interface SubmissionPerson { id: number; name: string; code?: string | null; }

export interface SubmissionSummary {
  id: number;
  title: string;
  /** Null for automatic extractions. */
  originalLink: string | null;
  status: SubmissionStatus;
  createdAt: string;
  submittedBy: SubmissionPerson;
  reviewedBy: SubmissionPerson | null;
  reviewedAt: string | null;
}

export interface SubmissionDetail extends SubmissionSummary {
  updatedAt: string;
  /** Null for automatic extractions (no PDF upload). */
  pdfName: string | null;
  pdfSize: number | null;
  /** USUARIO (manual upload) or EXTRACAO (received from the LLM pipeline). */
  origin?: "USUARIO" | "EXTRACAO";
  userData: ArticleData;
  llmData: ArticleData | null;
  extractionStatus: ExtractionStatus;
  extractedAt: string | null;
  extractionModel: string | null;
  extractionMock: boolean;
  curatedData: ArticleData | null;
  rejectionReason: string | null;
}

export type ExtractionQuality = "VALIDA" | "PARCIAL" | "ILEGIVEL";

export interface ExtractedOccurrence {
  id: number; order: number; curationStatus: "NAO_CURADA" | "CURADA" | "REPROVADA";
  disease: string | null; diseaseOriginal: string | null; parasite: string | null; vector: string | null;
  host: string | null; hostCategory: string | null; locationText: string | null; municipality: string | null;
  state: string | null; locationPrecision: "EXATA" | "MUNICIPIO" | "ESTADO" | "SEM_LOCAL";
  latitude: number | null; longitude: number | null; year: number | null; others: Record<string, unknown>;
}

export interface ExtractionDetail {
  submissionId: number; externalId: string; model: string | null; quality: ExtractionQuality;
  occurrencesRead: number; readingNote: string | null; receivedAt: string; rawContent: string;
  occurrences: ExtractedOccurrence[];
}

export interface SubmissionPage {
  items: SubmissionSummary[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface CurationFilters {
  status: SubmissionStatus;
  title: string;
  year: string;
  disease: string;
  from: string;
  to: string;
  page: number;
}

export type LocationSeal = ExtractedOccurrence["locationPrecision"];

/** One occurrence confirmed in the curator's form (sent on approval). */
export interface CuratedOccurrence {
  sourceId: number | null;
  disease: string | null; parasite: string | null; vector: string | null; host: string | null; hostCategory: string | null;
  municipality: string | null; state: string | null; latitude: number | null; longitude: number | null; year: number | null;
  locationSeal: LocationSeal; notes: string | null;
}
