import test from 'node:test';
import assert from 'node:assert/strict';
import { configureIdentity } from './configure-identity.mjs';

function fixture() {
  const native = [
    { providerId: 'idp-review-profile', requirement: 'REQUIRED', level: 0 },
    { authenticationFlow: true, requirement: 'REQUIRED', level: 0 },
    { providerId: 'idp-create-user-if-unique', requirement: 'ALTERNATIVE', level: 1 },
    { authenticationFlow: true, requirement: 'ALTERNATIVE', level: 1 },
    { providerId: 'idp-confirm-link', requirement: 'REQUIRED', level: 2 },
    { authenticationFlow: true, requirement: 'REQUIRED', level: 2 },
    { providerId: 'idp-email-verification', requirement: 'ALTERNATIVE', level: 3 },
    { providerId: 'idp-username-password-form', requirement: 'REQUIRED', level: 4 },
  ].map((row, index) => ({ ...row, index, id: String(index) }));
  const state = { native, executions: structuredClone(native), exists: false, writes: [],
    google: { alias: 'google', providerId: 'google', internalId: 'stable', config: { clientSecret: 'unchanged' } } };
  state.api = async (method, path, body) => {
    if (method !== 'GET') state.writes.push({ method, path, body });
    if (path === '/identity-provider/instances') return [state.google];
    if (path === '/authentication/flows') return state.exists ? [{ alias: 'sidpb-first-broker-login' }] : [];
    if (path.endsWith('/copy')) { state.exists = true; return; }
    if (path.includes('first%20broker%20login/executions')) return structuredClone(native);
    if (path.endsWith('/executions')) {
      if (method === 'GET') return structuredClone(state.executions);
      state.executions[state.executions.findIndex(row => row.id === body.id)] = body;
      return;
    }
    if (path === '/identity-provider/instances/google') { state.google = body; return; }
    throw new Error(`Unexpected ${method} ${path}`);
  };
  return state;
}
test('repeat configuration preserves provider identity and all verification steps', async () => {
  const state = fixture();
  await configureIdentity(state.api); await configureIdentity(state.api);
  assert.equal(state.writes.filter(call => call.path.endsWith('/copy')).length, 1);
  assert.equal(state.writes.filter(call => call.path.endsWith('/executions')).length, 2);
  assert.equal(state.google.internalId, 'stable');
  assert.equal(state.google.config.clientSecret, 'unchanged');
  assert.ok(state.writes.every(call => !/users|clients|credentials|federated/.test(call.path)));
  assert.equal(state.executions.find(row => row.providerId === 'idp-email-verification').requirement, 'ALTERNATIVE');
});
test('disabled parent verification flow is rejected before provider is attached', async () => {
  const state = fixture(); state.exists = true; state.executions[5].requirement = 'DISABLED';
  await assert.rejects(configureIdentity(state.api), /hierarchy/);
  assert.equal(state.writes.length, 0);
});
test('automatic linking or a missing proof step is rejected', async () => {
  const state = fixture(); state.exists = true; state.executions[7].providerId = 'idp-auto-link';
  await assert.rejects(configureIdentity(state.api), /hierarchy/);
  assert.equal(state.writes.length, 0);
});
