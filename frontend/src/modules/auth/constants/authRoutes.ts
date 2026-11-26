import type { UserRole } from "@/entities/user/user.types";

// Link e router do Next.js acrescentam o basePath configurado automaticamente.
export const ROLE_ROUTES: Record<UserRole, string> = {
  ADMIN: "/admin",
  CURATOR: "/curador",
  USER: "/usuario",
};
