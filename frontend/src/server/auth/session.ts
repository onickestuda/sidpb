import "server-only";
import * as oidc from "openid-client";
import { cookies } from "next/headers";
import { basePath, oidcConfig, settings } from "./config";
import { load, locked, remove, save } from "./store";

export const sessionCookie = "sidpb-session";
export const transactionCookie = "sidpb-oidc";
export const cookieOptions = () => ({ httpOnly: true, secure: settings().origin.startsWith("https:"),
  sameSite: "lax" as const, path: `${basePath}/`, maxAge: 8 * 60 * 60 });
export interface Session { accessToken: string; refreshToken: string; idToken: string; accessExpires: number; expires: number; }
export async function sessionId() { return (await cookies()).get(sessionCookie)?.value; }
export async function accessSession(): Promise<Session | null> {
  const id = await sessionId();
  if (!id || !/^[A-Za-z0-9_-]{43}$/.test(id)) return null;
  return locked(id, async () => {
    const session = await load<Session>(id);
    if (!session) return null;
    if (session.accessExpires > Date.now() + 30000) return session;
    try {
      const tokens = await oidc.refreshTokenGrant(await oidcConfig(), session.refreshToken);
      session.accessToken = tokens.access_token;
      session.refreshToken = tokens.refresh_token || session.refreshToken;
      session.idToken = tokens.id_token || session.idToken;
      session.accessExpires = Date.now() + (tokens.expires_in || 60) * 1000;
      await save(id, session);
      return session;
    } catch {
      await remove(id); // Fail closed. Refresh tokens are never retried after an ambiguous failure.
      return null;
    }
  });
}
export async function invalidate() {
  const id = await sessionId();
  if (id && /^[A-Za-z0-9_-]{43}$/.test(id)) await locked(id, () => remove(id));
}
