// Incremental configuration of the extraction worker's machine client. Idempotent: creates only what
// is missing, never reads, prints or rotates the client secret, and never touches users other than the
// client's own service account.
export const PIPELINE_CLIENT = 'sidpb-pipeline';
export const PIPELINE_ROLE = 'PIPELINE';
export const API_AUDIENCE = 'sidpb-api';
const MAPPER = 'sidpb-api-audience';

// Client credentials only: no browser login, no password grant, no public access.
const CLIENT_FLAGS = {
  publicClient: false, serviceAccountsEnabled: true, standardFlowEnabled: false,
  implicitFlowEnabled: false, directAccessGrantsEnabled: false, bearerOnly: false,
};

export async function configurePipeline(api) {
  const roles = await api('GET', '/roles');
  if (!roles.some(role => role.name === PIPELINE_ROLE)) {
    await api('POST', '/roles', { name: PIPELINE_ROLE, description: 'Worker de extração (fila /api/pipeline)' });
  }
  const role = await api('GET', `/roles/${PIPELINE_ROLE}`);

  let [client] = await api('GET', `/clients?clientId=${PIPELINE_CLIENT}`);
  if (!client) {
    await api('POST', '/clients', { clientId: PIPELINE_CLIENT, name: 'SIDPB pipeline de extração', protocol: 'openid-connect',
      clientAuthenticatorType: 'client-secret', enabled: true, ...CLIENT_FLAGS });
    [client] = await api('GET', `/clients?clientId=${PIPELINE_CLIENT}`);
  } else if (Object.entries(CLIENT_FLAGS).some(([key, value]) => client[key] !== value)) {
    // Fix only the flow flags; the representation is sent back as read, so the secret is untouched.
    await api('PUT', `/clients/${client.id}`, { ...client, ...CLIENT_FLAGS });
  }

  const account = await api('GET', `/clients/${client.id}/service-account-user`);
  const mapped = await api('GET', `/users/${account.id}/role-mappings/realm`);
  if (!mapped.some(item => item.name === PIPELINE_ROLE)) {
    await api('POST', `/users/${account.id}/role-mappings/realm`, [{ id: role.id, name: role.name }]);
  }

  const mappers = await api('GET', `/clients/${client.id}/protocol-mappers/models`);
  if (!mappers.some(mapper => mapper.protocolMapper === 'oidc-audience-mapper'
      && mapper.config?.['included.custom.audience'] === API_AUDIENCE)) {
    await api('POST', `/clients/${client.id}/protocol-mappers/models`, {
      name: MAPPER, protocol: 'openid-connect', protocolMapper: 'oidc-audience-mapper',
      config: { 'included.custom.audience': API_AUDIENCE, 'access.token.claim': 'true', 'id.token.claim': 'false' },
    });
  }
  console.log(`Client ${PIPELINE_CLIENT} ready (service account with role ${PIPELINE_ROLE}, audience ${API_AUDIENCE}). `
    + 'Copy its secret from Clients → Credentials into infra/pipeline/.env; it was not read or changed.');
}
