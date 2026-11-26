// Incremental Admin REST configuration. Never import/replace a live realm.
// Supply KC_ADMIN_TOKEN from an interactive administrative OIDC session.
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { publicUrls } from '../local-env.mjs';
import { configureIdentity } from './configure-identity.mjs';
export async function configure(env = process.env) {
  const base = publicUrls(env).kc;
  if (!env.KC_ADMIN_TOKEN) throw new Error('KC_ADMIN_TOKEN is required');
  async function api(method, path, body) {
    const response = await fetch(`${base}/admin/realms/sidpb${path}`, { method,
      headers: { Authorization: `Bearer ${env.KC_ADMIN_TOKEN}`, 'Content-Type': 'application/json' },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Keycloak ${method} ${path}: HTTP ${response.status}`);
    const text = await response.text(); return text ? JSON.parse(text) : undefined;
  }
  const realm = await api('GET', '');
  console.log('Existing realm:', JSON.stringify({ realm: realm.realm, registrationAllowed: realm.registrationAllowed,
    verifyEmail: realm.verifyEmail, resetPasswordAllowed: realm.resetPasswordAllowed,
    smtpConfigured: !!realm.smtpServer?.host }));
  // Only these owned, non-sensitive settings are changed. SMTP/IdPs/users remain untouched.
  await api('PUT', '', JSON.parse(readFileSync(new URL('./realm-auth-settings.json', import.meta.url), 'utf8')));
  const registrationExecutions = await api('GET', '/authentication/flows/registration/executions');
  const passwordExecution = registrationExecutions.find(execution => execution.providerId === 'registration-password-action');
  if (!passwordExecution) throw new Error('Registration Password Validation execution was not found');
  const passwordConfig = { always_set_password_on_register_form: 'true' };
  if (passwordExecution.authenticationConfig) {
    const existing = await api('GET', `/authentication/config/${passwordExecution.authenticationConfig}`);
    await api('PUT', `/authentication/config/${passwordExecution.authenticationConfig}`, {
      ...existing,
      config: { ...existing.config, ...passwordConfig },
    });
  } else {
    await api('POST', `/authentication/executions/${passwordExecution.id}/config`, {
      alias: 'sidpb-registration-password',
      config: passwordConfig,
    });
  }
  for (const name of ['USER', 'CURATOR', 'ADMIN']) {
    const roles = await api('GET', '/roles');
    if (!roles.some(role => role.name === name)) await api('POST', '/roles', { name });
  }
  const role = name => api('GET', `/roles/${encodeURIComponent(name)}`);
  for (const [parent, child] of [['CURATOR', 'USER'], ['ADMIN', 'CURATOR'], [realm.defaultRole.name, 'USER']]) {
    const existing = await api('GET', `/roles/${encodeURIComponent(parent)}/composites`);
    if (!existing.some(item => item.name === child)) await api('POST', `/roles/${encodeURIComponent(parent)}/composites`, [await role(child)]);
  }
  const origins = [publicUrls(env).origin];
  const path = env.NEXT_PUBLIC_BASE_PATH;
  const clients = [
    { clientId: 'sidpb-web', secret: env.KEYCLOAK_WEB_SECRET, standardFlowEnabled: true,
      redirectUris: origins.map(origin => `${origin}${path}/api/auth/callback/`), webOrigins: [],
      attributes: { 'pkce.code.challenge.method': 'S256', 'post.logout.redirect.uris': origins.map(origin => `${origin}${path}/`).join('##'), 'access.token.lifespan': '120' } },
    { clientId: 'sidpb-api', secret: env.KEYCLOAK_API_SECRET, standardFlowEnabled: false, redirectUris: [], webOrigins: [] },
    { clientId: 'sidpb-admin-service', secret: env.KEYCLOAK_SERVICE_SECRET, standardFlowEnabled: false,
      serviceAccountsEnabled: true, redirectUris: [], webOrigins: [] },
  ];
  for (const desired of clients) {
    if (!desired.secret) throw new Error(`Missing secret for ${desired.clientId}`);
    const [existing] = await api('GET', `/clients?clientId=${desired.clientId}`);
    const value = { ...existing, enabled: true, protocol: 'openid-connect', publicClient: false,
      directAccessGrantsEnabled: false, implicitFlowEnabled: false, serviceAccountsEnabled: false,
      fullScopeAllowed: false, ...desired, attributes: { ...existing?.attributes, ...desired.attributes } };
    if (existing) await api('PUT', `/clients/${existing.id}`, value); else await api('POST', '/clients', value);
  }
  const [web] = await api('GET', '/clients?clientId=sidpb-web');
  const mappings = [
    { name: 'sidpb-api-audience', protocol: 'openid-connect', protocolMapper: 'oidc-audience-mapper',
      config: { 'included.client.audience': 'sidpb-api', 'access.token.claim': 'true', 'id.token.claim': 'false', 'introspection.token.claim': 'true' } },
    { name: 'sidpb-realm-roles', protocol: 'openid-connect', protocolMapper: 'oidc-usermodel-realm-role-mapper',
      config: { 'claim.name': 'realm_access.roles', 'jsonType.label': 'String', multivalued: 'true', 'access.token.claim': 'true', 'id.token.claim': 'false' } },
  ];
  const existingMappers = await api('GET', `/clients/${web.id}/protocol-mappers/models`);
  for (const mapper of mappings) {
    const existing = existingMappers.find(item => item.name === mapper.name);
    if (existing) await api('PUT', `/clients/${web.id}/protocol-mappers/models/${existing.id}`, { ...existing, ...mapper });
    else await api('POST', `/clients/${web.id}/protocol-mappers/models`, mapper);
  }
  await api('POST', `/clients/${web.id}/scope-mappings/realm`, await Promise.all(['USER', 'CURATOR', 'ADMIN'].map(role)));
  const [service] = await api('GET', '/clients?clientId=sidpb-admin-service');
  const [management] = await api('GET', '/clients?clientId=realm-management');
  const account = await api('GET', `/clients/${service.id}/service-account-user`);
  const permissions = await Promise.all(['manage-users', 'query-users', 'view-realm'].map(name => api('GET', `/clients/${management.id}/roles/${name}`)));
  await api('POST', `/users/${account.id}/role-mappings/clients/${management.id}`, permissions);
  await api('POST', `/clients/${service.id}/scope-mappings/clients/${management.id}`, permissions);
  await configureIdentity(api);
  console.log('Configured registration, roles and OIDC clients in place. Existing identities preserved.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) configure().catch(error => { console.error(error.message); process.exitCode = 1; });
