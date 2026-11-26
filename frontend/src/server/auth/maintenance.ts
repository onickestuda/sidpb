import "server-only";
import * as oidc from "openid-client";
import { oidcConfig } from "./config";
import { sweepRevokedSessions } from "./store";

let started = false;
export function startSessionMaintenance() {
  if (started || process.env.AUTH_SESSION_MAINTENANCE_ENABLED === "false") return;
  started = true;
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await sweepRevokedSessions(async refreshToken => {
        // Check the refresh token: an expired access token does not mean the session ended.
        const result = await oidc.tokenIntrospection(await oidcConfig(), refreshToken, { token_type_hint: "refresh_token" });
        if (typeof result.active !== "boolean") throw new Error("Invalid introspection response");
        return result.active;
      });
    } catch { /* The next sweep retries; no credentials or personal data in logs. */ }
    finally { running = false; }
  }, 60000);
  timer.unref();
}
