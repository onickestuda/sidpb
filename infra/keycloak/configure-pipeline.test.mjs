import test from 'node:test';
import assert from 'node:assert/strict';
import { configurePipeline } from './configure-pipeline.mjs';

function fixture({ roles = [], client = null, mapped = [], mappers = [] } = {}) {
  const state = { roles, client, mapped, mappers, writes: [] };
  state.api = async (method, path, body) => {
    if (method !== 'GET') state.writes.push({ method, path, body });
    if (path === '/roles') { if (method === 'POST') state.roles.push({ ...body, id: 'role-1' }); return method === 'GET' ? state.roles : undefined; }
    if (path === '/roles/PIPELINE') return state.roles.find(role => role.name === 'PIPELINE');
    if (path === '/clients?clientId=sidpb-pipeline') return state.client ? [state.client] : [];
    if (path === '/clients') { state.client = { ...body, id: 'client-1', secret: 'generated' }; return; }
    if (path === '/clients/client-1') { state.client = body; return; }
    if (path === '/clients/client-1/service-account-user') return { id: 'sa-1' };
    if (path === '/users/sa-1/role-mappings/realm') { if (method === 'POST') state.mapped.push(...body); return method === 'GET' ? state.mapped : undefined; }
    if (path === '/clients/client-1/protocol-mappers/models') { if (method === 'POST') state.mappers.push(body); return method === 'GET' ? state.mappers : undefined; }
    throw new Error(`Unexpected ${method} ${path}`);
  };
  return state;
}

test('fresh realm gets role, confidential client, role mapping and audience; a rerun writes nothing', async () => {
  const state = fixture();
  await configurePipeline(state.api);
  assert.equal(state.writes.length, 4);
  assert.equal(state.client.serviceAccountsEnabled, true);
  assert.equal(state.client.standardFlowEnabled, false);
  assert.equal(state.client.directAccessGrantsEnabled, false);
  assert.equal(state.client.publicClient, false);
  assert.deepEqual(state.mapped.map(role => role.name), ['PIPELINE']);
  assert.equal(state.mappers[0].config['included.custom.audience'], 'sidpb-api');
  const before = state.writes.length;
  await configurePipeline(state.api);
  assert.equal(state.writes.length, before);
});

test('existing client keeps its secret and only gets its flow flags fixed', async () => {
  const state = fixture({ roles: [{ id: 'role-1', name: 'PIPELINE' }],
    client: { id: 'client-1', clientId: 'sidpb-pipeline', secret: 'keep-me', standardFlowEnabled: true, serviceAccountsEnabled: true,
      publicClient: false, implicitFlowEnabled: false, directAccessGrantsEnabled: false, bearerOnly: false },
    mapped: [{ name: 'PIPELINE' }],
    mappers: [{ protocolMapper: 'oidc-audience-mapper', config: { 'included.custom.audience': 'sidpb-api' } }] });
  await configurePipeline(state.api);
  assert.deepEqual(state.writes.map(call => call.path), ['/clients/client-1']);
  assert.equal(state.client.secret, 'keep-me');
  assert.equal(state.client.standardFlowEnabled, false);
  assert.ok(state.writes.every(call => !/credentials|client-secret/.test(call.path)));
});
