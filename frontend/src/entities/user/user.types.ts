export type UserRole = "ADMIN" | "CURATOR" | "USER";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}
