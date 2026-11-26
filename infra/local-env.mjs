import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
export const env = { ...parseEnv(readFileSync(new URL('../.env', import.meta.url), 'utf8')), ...process.env };
export function publicUrls(values = env) {
  for (const name of ['AUTH_ORIGIN', 'API_PUBLIC_URL', 'KEYCLOAK_PUBLIC_URL']) {
    const url = new URL(values[name]);
    if (url.origin !== values[name]) throw new Error(`${name} must be an origin without trailing slash`);
  }
  const path = values.NEXT_PUBLIC_BASE_PATH;
  if (!path || !/^\/[a-zA-Z0-9/_-]+$/.test(path) || path.endsWith('/')) throw new Error('Invalid NEXT_PUBLIC_BASE_PATH');
  return { origin: values.AUTH_ORIGIN, app: values.AUTH_ORIGIN + path,
    kc: values.KEYCLOAK_PUBLIC_URL, api: values.API_PUBLIC_URL,
    issuer: values.KEYCLOAK_PUBLIC_URL + '/realms/sidpb' };
}
