// Read-only fingerprints before and after a requested LOCAL container restart.
// No personal data, credentials or database contents are written or logged.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const tables = ['keycloak.user_entity', 'keycloak.federated_identity', 'keycloak.credential',
  'keycloak.client', 'keycloak.identity_provider', 'keycloak.user_role_mapping',
  'public.usuario', 'public.submissao_artigo'];
function fingerprint() {
  return tables.map(table => {
    const sql = `SELECT COALESCE(jsonb_agg(row ORDER BY row::text), '[]'::jsonb) FROM (SELECT to_jsonb(t) AS row FROM ${table} t) s;`;
    const bytes = execFileSync('docker', ['compose', 'exec', '-T', 'db', 'sh', '-c',
      'exec psql -X -qAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"',
    ], { input: sql, maxBuffer: 32 * 1024 * 1024 });
    return createHash('sha256').update(bytes).digest('hex');
  });
}
const before = fingerprint();
if (!process.argv.includes('--restart-local')) throw new Error('Use --restart-local to verify the local Keycloak restart');
execFileSync('docker', ['compose', 'restart', 'keycloak'], { stdio: 'ignore' });
let ready = false;
for (let attempt = 0; attempt < 90; attempt++) {
  try {
    if ((await fetch('http://localhost:8081/realms/sidpb/.well-known/openid-configuration', { signal: AbortSignal.timeout(2000) })).ok) { ready = true; break; }
  } catch {}
  await new Promise(resolve => setTimeout(resolve, 1000));
}
assert.ok(ready, 'Keycloak did not become ready');
assert.deepEqual(fingerprint(), before, 'Persistent identity/application records changed');
console.log('PASS Keycloak restart preserves users/sub, federated links, credentials, client IDs, providers, roles, application users and submissions.');
console.log('This verifies stored data, not a new Google authorization.');
