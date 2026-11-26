import "server-only";
import * as oidc from "openid-client";

export { basePath } from "@/lib/publicConfig";
import { basePath } from "@/lib/publicConfig";
function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}
export function settings() {
  const origin = new URL(required("AUTH_ORIGIN")).origin;
  const issuer = required("KEYCLOAK_ISSUER");
  const internal = process.env.KEYCLOAK_INTERNAL_URL || new URL(issuer).origin;
  if (new URL(issuer).protocol !== "https:" && process.env.AUTH_ALLOW_HTTP !== "true")
    throw new Error("HTTP OIDC requires explicit local-development opt-in");
  return { origin, issuer, internal, callback: `${origin}${basePath}/api/auth/callback/`,
    api: required("INTERNAL_API_URL") };
}
let configuration: Promise<oidc.Configuration> | undefined;
export function oidcConfig() {
  if (!configuration) {
    const config = settings();
    const secret = process.env.KEYCLOAK_WEB_SECRET;
    if (!secret) throw new Error("KEYCLOAK_WEB_SECRET is required");
    configuration = oidc.discovery(new URL(config.issuer), "sidpb-web", secret, undefined, {
      execute: process.env.AUTH_ALLOW_HTTP === "true" ? [oidc.allowInsecureRequests] : [],
      [oidc.customFetch]: (url, options) => {
        const target = new URL(url.toString());
        // Issuer remains canonical. Only server-side transport uses the Docker address.
        if (target.origin !== new URL(config.issuer).origin) throw new Error("Unexpected OIDC endpoint");
        const internal = new URL(config.internal);
        target.protocol = internal.protocol; target.host = internal.host;
        return fetch(target, { ...options, cache: "no-store", signal: AbortSignal.timeout(10000) });
      },
    }).catch(error => { configuration = undefined; throw error; });
  }
  return configuration;
}

export function requireOrigin(request: Request) {
  if (request.headers.get("origin") !== settings().origin || request.headers.get("sec-fetch-site") === "cross-site")
    throw new Error("Invalid request origin");
}
