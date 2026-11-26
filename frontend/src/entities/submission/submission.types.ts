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
  originalLink: string;
  status: SubmissionStatus;
  createdAt: string;
  submittedBy: SubmissionPerson;
  reviewedBy: SubmissionPerson | null;
  reviewedAt: string | null;
}

export interface SubmissionDetail extends SubmissionSummary {
  updatedAt: string;
  pdfName: string;
  pdfSize: number;
  userData: ArticleData;
  llmData: ArticleData | null;
  extractionStatus: ExtractionStatus;
  extractedAt: string | null;
  extractionModel: string | null;
  extractionMock: boolean;
  curatedData: ArticleData | null;
  rejectionReason: string | null;
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
