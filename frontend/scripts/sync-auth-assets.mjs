import { existsSync } from 'node:fs';
// Docker builds contain only frontend; canonical assets are already in public.
const sync = new URL('../../infra/keycloak/sync-theme-assets.mjs',import.meta.url);
if (existsSync(sync)) await import(sync.href);
