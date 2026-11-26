import "server-only";
import { redirect } from "next/navigation";
import { accessSession } from "./session";
import { basePath, settings } from "./config";
export async function requireRole(required: "USER" | "CURATOR" | "ADMIN") {
  const session = await accessSession();
  if (!session) redirect(`${basePath}/`);
  const response = await fetch(`${settings().api}/api/auth/me`, { headers: { Authorization: `Bearer ${session.accessToken}` }, cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!response.ok) redirect(`${basePath}/?auth_error=login`);
  const user = await response.json();
  const levels: Record<string, number> = { USER: 1, CURATOR: 2, ADMIN: 3 };
  if ((levels[user.role] || 0) < levels[required]) redirect(`${basePath}/dashboard/`);
}
