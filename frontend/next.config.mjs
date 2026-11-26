import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

// Host execution reads the same source as Compose. Container builds receive args.
const file = new URL("../.env", import.meta.url);
if (existsSync(file)) {
  const env = parseEnv(readFileSync(file, "utf8"));
  for (const [key, value] of Object.entries(env)) process.env[key] ??= value;
  process.env.NEXT_PUBLIC_API_URL ??= process.env.API_PUBLIC_URL;
  process.env.KEYCLOAK_ISSUER ??= `${process.env.KEYCLOAK_PUBLIC_URL}/realms/sidpb`;
  process.env.KEYCLOAK_INTERNAL_URL ??= process.env.KEYCLOAK_PUBLIC_URL;
  process.env.INTERNAL_API_URL ??= process.env.API_PUBLIC_URL;
}
const basePath = process.env.NEXT_PUBLIC_BASE_PATH;
if (!basePath || !/^\/[a-zA-Z0-9/_-]+$/.test(basePath) || basePath.endsWith("/"))
  throw new Error("Configure NEXT_PUBLIC_BASE_PATH without trailing slash in root .env");
if (!process.env.AUTH_ORIGIN) throw new Error("AUTH_ORIGIN is required");
if (!process.env.NEXT_PUBLIC_API_URL) throw new Error("API_PUBLIC_URL / NEXT_PUBLIC_API_URL is required");
for (const name of ['AUTH_ORIGIN', 'NEXT_PUBLIC_API_URL']) {
  if (new URL(process.env[name]).origin !== process.env[name])
    throw new Error(`${name} must be an origin without trailing slash`);
}

/** @type {import('next').NextConfig} */
export default {
  basePath,
  trailingSlash: true,
  allowedDevOrigins: [new URL(process.env.AUTH_ORIGIN).hostname],
  typescript: { ignoreBuildErrors: true },
};
