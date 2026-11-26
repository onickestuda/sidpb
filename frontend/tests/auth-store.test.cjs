const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const Module = require('node:module');
const ts = require('typescript');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sidpb-session-test-'));
process.env.AUTH_SESSION_DIR = directory;
process.env.AUTH_SESSION_KEY = crypto.randomBytes(32).toString('base64');
const original = Module._load;
Module._load = function (name, ...args) { return name === 'server-only' ? {} : original.call(this, name, ...args); };
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);
const store = require('../src/server/auth/store.ts');
after(() => { fs.rmSync(directory, { recursive: true }); }); // Only the unique temporary test directory.
test('opaque sessions are encrypted, authenticated, expire and reject traversal', async () => {
  const id = store.newId(), value = { accessToken: 'secret-access-token', expires: Date.now() + 10000 };
  await store.save(id, value); assert.deepEqual(await store.load(id), value);
  const file = path.join(directory, crypto.createHash('sha256').update(id).digest('hex'));
  const encrypted = fs.readFileSync(file); assert.ok(!encrypted.includes(Buffer.from(value.accessToken)));
  encrypted[encrypted.length - 1] ^= 1; fs.writeFileSync(file, encrypted);
  await assert.rejects(store.load(id));
  await store.save(id, { expires: Date.now() - 1 }); assert.equal(await store.load(id), null);
  await assert.rejects(store.load('../outside'));
});
test('concurrent requests serialize updates and preserve durable session state', async () => {
  const id = store.newId(); await store.save(id, { count: 0, expires: Date.now() + 30000 });
  await Promise.all(Array.from({ length: 12 }, () => store.locked(id, async () => {
    const value = await store.load(id); await new Promise(resolve => setTimeout(resolve, 3));
    await store.save(id, { ...value, count: value.count + 1 });
  })));
  assert.equal((await store.load(id)).count, 12);
  await store.remove(id); assert.equal(await store.load(id), null);
});
test('maintenance erases revoked session tokens without treating outages or in-flight refresh as deletion', async () => {
  const id = store.newId(), value = { refreshToken: 'isolated-refresh', expires: Date.now() + 100000 };
  await store.save(id, value);
  await store.sweepRevokedSessions(async () => { throw Error('provider unavailable'); });
  assert.deepEqual(await store.load(id), value);
  await store.sweepRevokedSessions(async () => true);
  assert.deepEqual(await store.load(id), value);
  await store.locked(id, async () => {
    await store.sweepRevokedSessions(async () => false);
    assert.deepEqual(await store.load(id), value);
  });
  await store.sweepRevokedSessions(async () => false);
  assert.equal(await store.load(id), null);
  const transaction = store.newId(); await store.save(transaction, { expires: Date.now() - 1 });
  await store.sweepRevokedSessions(async () => { throw Error('must not introspect transactions'); });
  assert.equal(await store.load(transaction), null);
});
