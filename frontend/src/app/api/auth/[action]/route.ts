import { NextRequest, NextResponse } from "next/server";
import * as oidc from "openid-client";
import { basePath, oidcConfig, requireOrigin, settings } from "@/server/auth/config";
import { cleanup, load, locked, newId, remove, save } from "@/server/auth/store";
import { accessSession, cookieOptions, invalidate, sessionCookie, sessionId, transactionCookie, type Session } from "@/server/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
interface Transaction { verifier: string; state: string; nonce: string; expires: number; }
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { "Cache-Control": "no-store" } });
function clear(response: NextResponse, cookie: string) { response.cookies.set(cookie, "", { ...cookieOptions(), maxAge: 0 }); }

export async function POST(request: NextRequest, context: { params: Promise<{ action: string }> }) {
  try { requireOrigin(request); } catch { return json({ message: "Origem inválida." }, 403); }
  const { action } = await context.params;
  try {
    const options = settings();
    if (action === "delete-account") {
      let body: unknown;
      try { body = await request.json(); } catch { return json({ message: "Confirme a exclusão." }, 400); }
      if (!body || typeof body !== "object" || !("confirmation" in body) || body.confirmation !== "EXCLUIR")
        return json({ message: "Digite EXCLUIR para confirmar." }, 400);
      const session = await accessSession();
      if (!session) return json({ message: "Entre novamente." }, 401);
      const result = await fetch(`${options.api}/api/auth/me`, { method: "DELETE", cache: "no-store",
        headers: { Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "EXCLUIR" }), signal: AbortSignal.timeout(60000) });
      if (result.status !== 202) return json({ message: result.status === 409
        ? "Transfira o acesso administrativo antes de excluir a conta."
        : "Não foi possível confirmar o pedido. Entre novamente para verificar o estado da conta." }, result.status);
      await invalidate();
      const response = json({ url: `${options.origin}${basePath}/?account_deletion=requested` }, 202);
      clear(response, sessionCookie); clear(response, transactionCookie);
      return response;
    }
    if (["login", "register", "google", "recover"].includes(action)) {
      const config = await oidcConfig();
      await cleanup();
      const id = newId(), verifier = oidc.randomPKCECodeVerifier(), state = oidc.randomState(), nonce = oidc.randomNonce();
      await save(id, { verifier, state, nonce, expires: Date.now() + 10 * 60 * 1000 });
      const url = oidc.buildAuthorizationUrl(config, { redirect_uri: options.callback, scope: "openid profile email",
        response_type: "code", code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
        code_challenge_method: "S256", state, nonce, ...(action === "google" ? { kc_idp_hint: "google" } : {}) });
      if (action === "register") url.pathname = url.pathname.replace(/\/auth$/, "/registrations");
      // Password recovery stays on Keycloak's official login screen via its "Forgot password" link.
      const response = NextResponse.redirect(url, 303);
      response.headers.set("Cache-Control", "no-store");
      response.cookies.set(transactionCookie, id, { ...cookieOptions(), maxAge: 600 });
      return response;
    }
    if (action === "logout") {
      const id = await sessionId();
      let session: Session | null = null;
      if (id && /^[A-Za-z0-9_-]{43}$/.test(id)) await locked(id, async () => {
        session = await load<Session>(id); await remove(id);
      });
      const ended = session as Session | null;
      const parameters = { client_id: "sidpb-web", post_logout_redirect_uri: `${options.origin}${basePath}/`,
        ...(ended ? { id_token_hint: ended.idToken } : {}) };
      let url = new URL(`${options.issuer}/protocol/openid-connect/logout`);
      url.search = new URLSearchParams(parameters).toString();
      try {
        const config = await oidcConfig();
        if (ended) await oidc.tokenRevocation(config, ended.refreshToken).catch(() => {});
        url = oidc.buildEndSessionUrl(config, parameters);
      } catch { /* Local session is already removed, even if Keycloak is unavailable. */ }
      const response = json({ url: url.toString() }); clear(response, sessionCookie); clear(response, transactionCookie);
      return response;
    }
    return json({ message: "Não encontrado." }, 404);
  } catch { return json({ message: "Não foi possível conectar ao serviço de autenticação." }, 503); }
}

export async function GET(request: NextRequest, context: { params: Promise<{ action: string }> }) {
  const { action } = await context.params;
  if (action === "session") {
    try {
      const session = await accessSession();
      if (!session) return json(null);
      const response = await fetch(`${settings().api}/api/auth/me`, { headers: { Authorization: `Bearer ${session.accessToken}` }, cache: "no-store", signal: AbortSignal.timeout(15000) });
      if (response.status === 401 || response.status === 403) { await invalidate(); const result = json(null); clear(result, sessionCookie); return result; }
      if (!response.ok) return json({ message: "Sessão indisponível." }, response.status);
      return json(await response.json());
    } catch { return json({ message: "Sessão indisponível." }, 503); }
  }
  if (action === "callback") {
    const id = request.cookies.get(transactionCookie)?.value;
    try {
      if (!id || !/^[A-Za-z0-9_-]{43}$/.test(id)) throw new Error("Missing transaction");
      const transaction = await locked(id, async () => { const value = await load<Transaction>(id); await remove(id); return value; });
      if (!transaction) throw new Error("Expired transaction");
      const callback = new URL(settings().callback); callback.search = request.nextUrl.search;
      const tokens = await oidc.authorizationCodeGrant(await oidcConfig(), callback, {
        pkceCodeVerifier: transaction.verifier, expectedState: transaction.state, expectedNonce: transaction.nonce, idTokenExpected: true,
      });
      if (!tokens.refresh_token || !tokens.id_token || tokens.claims()?.email_verified !== true) throw new Error("Verified identity required");
      const me = await fetch(`${settings().api}/api/auth/me`, { headers: { Authorization: `Bearer ${tokens.access_token}` }, cache: "no-store", signal: AbortSignal.timeout(15000) });
      if (!me.ok) {
        await oidc.tokenRevocation(await oidcConfig(), tokens.refresh_token).catch(() => {});
        throw new Error("identity");
      }
      await me.json(); // Confirms the local identity exists before the session is created.
      await invalidate(); // Rotate opaque ID at every authentication.
      const sid = newId();
      await save(sid, { accessToken: tokens.access_token, refreshToken: tokens.refresh_token, idToken: tokens.id_token,
        accessExpires: Date.now() + (tokens.expires_in || 60) * 1000, expires: Date.now() + 8 * 60 * 60 * 1000 } satisfies Session);
      // Every profile lands on the map; personal areas are reached from the user menu.
      const response = NextResponse.redirect(`${settings().origin}${basePath}/dashboard/`, 303);
      response.headers.set("Cache-Control", "no-store"); response.headers.set("Referrer-Policy", "no-referrer");
      response.cookies.set(sessionCookie, sid, cookieOptions()); clear(response, transactionCookie);
      return response;
    } catch (error) {
      const reason = "login";
      const response = NextResponse.redirect(`${settings().origin}${basePath}/?auth_error=${reason}`, 303);
      response.headers.set("Cache-Control", "no-store"); response.headers.set("Referrer-Policy", "no-referrer");
      clear(response, transactionCookie); return response;
    }
  }
  if (action === "account") {
    try {
      if (!await accessSession()) return json({ message: "Autenticação necessária." }, 401);
      // The native account console performs CSRF-protected linking and credential updates.
      const section = request.nextUrl.searchParams.get("section");
      const sections: Record<string, string> = {
        google: "account-security/linked-accounts", password: "account-security/signing-in",
        sessions: "account-security/device-activity", profile: "",
      };
      const path = (section && sections[section]) || "";
      const response = NextResponse.redirect(`${settings().issuer}/account/${path}`, 303);
      response.headers.set("Cache-Control", "no-store");
      return response;
    } catch { return json({ message: "Sessão indisponível." }, 503); }
  }
  return json({ message: "Não encontrado." }, 404);
}
