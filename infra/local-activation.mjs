// Local backup and read-only preservation checks. Does not apply migrations or erase records.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const backupRoot = resolve(root, '.local-backups');
function docker(args, options = {}) { return execFileSync('docker', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options }); }
function sql(query) { return docker(['compose', 'exec', '-T', 'db', 'sh', '-c', 'exec psql -X -qAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'], { input: query }); }
const tables = ['public.usuario', 'public.usuario_identity_link_audit', 'public.submissao_artigo', 'public.fonte', 'public.ocorrencia', 'public.ocorrencia_fonte',
  'keycloak.user_entity', 'keycloak.credential', 'keycloak.federated_identity', 'keycloak.client', 'keycloak.identity_provider'];
function snapshot(previous) {
  return Object.fromEntries(tables.map(table => {
    const [schema, name] = table.split('.');
    const columns = previous?.[table]?.columns || JSON.parse(sql(`SELECT json_agg(column_name ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema='${schema}' AND table_name='${name}';`));
    if (!columns?.length || columns.some(column => !/^[a-z0-9_]+$/i.test(column))) throw Error('Unexpected database structure');
    const rows = sql(`SELECT COALESCE(jsonb_agg(row ORDER BY row::text),'[]'::jsonb) FROM (SELECT to_jsonb(t) AS row FROM (SELECT ${columns.map(column => '"' + column + '"').join(',')} FROM ${table}) t) s;`);
    return [table, { columns, sha256: createHash('sha256').update(rows).digest('hex') }];
  }));
}
if (process.argv[2] === 'backup') {
  const directory = join(backupRoot, new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomBytes(3).toString('hex'));
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const remote = '/tmp/sidpb-backup-' + randomBytes(8).toString('hex') + '.dump';
  const database = docker(['compose', 'ps', '-q', 'db']).trim();
  if (!database) throw Error('Existing database container required');
  docker(['compose', 'exec', '-T', 'db', 'sh', '-c', 'exec pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$1"', 'sh', remote]);
  try {
    const inventory = docker(['exec', database, 'pg_restore', '--list', remote]);
    if (!inventory.includes('TABLE DATA')) throw Error('Backup inventory did not contain table data');
    docker(['cp', database + ':' + remote, join(directory, 'database.dump')]);
    if (!statSync(join(directory, 'database.dump')).size) throw Error('Empty backup');
  } finally { docker(['exec', database, 'rm', '--', remote]); }
  const images = {};
  for (const service of ['api', 'frontend', 'keycloak']) {
    const id = docker(['compose', 'ps', '-q', service]).trim();
    images[service] = JSON.parse(docker(['inspect', id]))[0].Image;
  }
  writeFileSync(join(directory, 'manifest.json'), JSON.stringify({ images, tables: snapshot() }, null, 2), { mode: 0o600 });
  console.log('Backup validated:', relative(root, directory));
} else if (['verify', 'verify-after-reconciliation'].includes(process.argv[2])) {
  const directory = resolve(root, process.argv[3] || '');
  const inside = relative(backupRoot, directory);
  if (!inside || inside.startsWith('..') || resolve(backupRoot, inside) !== directory) throw Error('Select a backup inside .local-backups');
  const before = JSON.parse(readFileSync(join(directory, 'manifest.json'), 'utf8')).tables;
  const after = snapshot(before);
  // Account anonymization and canonical OIDC URLs are intentional activation changes.
  const checked = process.argv[2] === 'verify-after-reconciliation'
    ? tables.filter(table => !['public.usuario', 'public.usuario_identity_link_audit', 'keycloak.client'].includes(table))
    : tables;
  const changed = checked.filter(table => before[table].sha256 !== after[table].sha256);
  if (changed.length) throw Error('Preservation check changed: ' + changed.join(', '));
  console.log('PASS preserved original records:', checked.join(', '));
} else throw Error('Usage: node infra/local-activation.mjs backup | verify|verify-after-reconciliation .local-backups/<directory>');
