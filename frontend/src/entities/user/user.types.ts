export type UserRole = "ADMIN" | "CURATOR" | "USER";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  /** Public account code (6 hex), shown as CUR-XXXXXX; same value as the curation stamp. */
  code?: string | null;
}
