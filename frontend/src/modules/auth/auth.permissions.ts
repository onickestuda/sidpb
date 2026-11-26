import type { AuthUser, UserRole } from "@/entities/user/user.types";

export type AuthPermission =
  | "submission.create"
  | "submission.viewOwn"
  | "curation.view"
  | "curation.review"
  | "admin.access";

// UI mirrors the hierarchy; the API enforces authorization independently.
const ROLE_PERMISSIONS: Record<UserRole, readonly AuthPermission[]> = {
  USER: ["submission.create", "submission.viewOwn"],
  CURATOR: ["submission.create", "submission.viewOwn", "curation.view", "curation.review"],
  ADMIN: ["submission.create", "submission.viewOwn", "curation.view", "curation.review", "admin.access"],
};

const PROFILE_PERMISSION: Record<UserRole, AuthPermission> = {
  USER: "submission.viewOwn",
  CURATOR: "curation.view",
  ADMIN: "admin.access",
};

export function can(user: AuthUser | null, permission: AuthPermission): boolean {
  return user !== null && ROLE_PERMISSIONS[user.role].includes(permission);
}

export function canAccessProfile(user: AuthUser | null, role: UserRole): boolean {
  return can(user, PROFILE_PERMISSION[role]);
}
