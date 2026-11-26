const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const { NextRequest } = require('next/server');
const originalLoad = Module._load, originalFetch = global.fetch;
let invalidations = 0, calls = [], upstream = 202, session = { accessToken: 'isolated-token' };
Module._load = function (name, ...args) {
  if (name === 'openid-client') return {};
  if (name === '@/server/auth/config') return {
    basePath: '/sidpb', settings: () => ({ origin: 'http://localhost:7080', api: 'http://isolated.invalid' }),
    requireOrigin: request => { if (request.headers.get('origin') !== 'http://localhost:7080') throw Error('origin'); },
  };
  if (name === '@/server/auth/store') return {};
  if (name === '@/server/auth/session') return {
    accessSession: async () => session, invalidate: async () => { invalidations++; },
    cookieOptions: () => ({ httpOnly: true, sameSite: 'lax', path: '/sidpb/' }),
    sessionCookie: 'sidpb-session', transactionCookie: 'sidpb-oidc',
  };
  return originalLoad.call(this, name, ...args);
};
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);
const { POST } = require('../src/app/api/auth/[action]/route.ts');
Module._load = originalLoad;
after(() => { global.fetch = originalFetch; });
async function send(body, origin = 'http://localhost:7080') {
  return POST(new NextRequest('http://localhost:7080/sidpb/api/auth/delete-account/', {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }), { params: Promise.resolve({ action: 'delete-account' }) });
}
test('deletion requires origin, confirmation and authenticated session before contacting API', async () => {
  global.fetch = async (...args) => { calls.push(args); return new Response(null, { status: upstream }); };
  assert.equal((await send({ confirmation: 'EXCLUIR' }, 'https://attacker.invalid')).status, 403);
  assert.equal((await send({ confirmation: 'no' })).status, 400);
  session = null;
  assert.equal((await send({ confirmation: 'EXCLUIR' })).status, 401);
  assert.equal(calls.length, 0); assert.equal(invalidations, 0);
});
test('accepted deletion targets only authenticated me and clears both BFF cookies', async () => {
  session = { accessToken: 'isolated-token' };
  const response = await send({ confirmation: 'EXCLUIR', userId: 'victim' });
  assert.equal(response.status, 202); assert.equal(invalidations, 1);
  const [url, options] = calls.at(-1);
  assert.equal(url, 'http://isolated.invalid/api/auth/me'); assert.equal(options.method, 'DELETE');
  assert.equal(options.headers.Authorization, 'Bearer isolated-token');
  assert.deepEqual(JSON.parse(options.body), { confirmation: 'EXCLUIR' });
  for (const name of ['sidpb-session', 'sidpb-oidc']) assert.equal(response.cookies.get(name).maxAge, 0);
  assert.equal((await response.json()).url, 'http://localhost:7080/sidpb/?account_deletion=requested');
});
test('rejection or transport failure never claims completed deletion', async () => {
  upstream = 409;
  const rejected = await send({ confirmation: 'EXCLUIR' }); assert.equal(rejected.status, 409);
  assert.ok(!(await rejected.json()).url); assert.equal(invalidations, 1);
  global.fetch = async () => { throw Error('isolated timeout'); };
  assert.equal((await send({ confirmation: 'EXCLUIR' })).status, 503); assert.equal(invalidations, 1);
});
