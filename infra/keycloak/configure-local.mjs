// Local operator helper: interactive browser Authorization Code login, never password grant.
// Credentials are read from the ignored root .env; neither tokens nor secrets are printed.
import { chromium } from '../../frontend/node_modules/playwright/index.mjs';
import { configure } from './configure-auth.mjs';
import { configureIdentity } from './configure-identity.mjs';
import { env, publicUrls } from '../local-env.mjs';
const { kc, app } = publicUrls();
// Never generate/rotate secrets as a side effect of inspection or configuration.
// Missing OIDC client secrets are rejected by configure(), preserving existing sessions.
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const token = page.waitForResponse(response => response.url().includes('/realms/master/protocol/openid-connect/token') && response.request().method() === 'POST' && response.status() === 200, { timeout: 60000 });
  await page.goto(`${kc}/admin/master/console/`);
  await page.locator('#username').fill(env.KEYCLOAK_ADMIN);
  await page.locator('#password').fill(env.KEYCLOAK_ADMIN_PASSWORD);
  await page.locator('#kc-login').click();
  env.KC_ADMIN_TOKEN = (await (await token).json()).access_token;
  if (process.argv.includes('--urls-only')) {
    const headers = { Authorization: `Bearer ${env.KC_ADMIN_TOKEN}`, 'Content-Type': 'application/json' };
    const result = await fetch(`${kc}/admin/realms/sidpb/clients?clientId=sidpb-web`, { headers });
    if (!result.ok) throw new Error('Unable to read existing web client');
    const [client] = await result.json();
    if (!client) throw new Error('Existing sidpb-web client required');
    const response = await fetch(`${kc}/admin/realms/sidpb/clients/${client.id}`, { method: 'PUT', headers,
      body: JSON.stringify({ ...client, rootUrl: app + '/', baseUrl: app + '/',
        redirectUris: [app + '/api/auth/callback/'], webOrigins: [],
        attributes: { ...client.attributes, 'post.logout.redirect.uris': app + '/' } }) });
    if (!response.ok) throw new Error('Unable to update client URLs');
    console.log('Updated only existing sidpb-web URLs; realm, users, secrets and roles preserved.');
  } else if (process.argv.includes('--identity') || process.argv.includes('--inspect-identity')) {
    const api = async (method, path, body) => {
      const response = await fetch(`${kc}/admin/realms/sidpb${path}`, {
        method, headers: { Authorization: `Bearer ${env.KC_ADMIN_TOKEN}`, 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (!response.ok) throw new Error(`${method} ${path}: ${response.status}`);
      const value = await response.text(); return value ? JSON.parse(value) : undefined;
    };
    if (process.argv.includes('--identity')) await configureIdentity(api);
    const providers = await api('GET', '/identity-provider/instances');
    for (const provider of providers) {
      console.log(JSON.stringify({ alias: provider.alias, trustEmail: provider.trustEmail,
        firstBrokerLoginFlowAlias: provider.firstBrokerLoginFlowAlias, postBrokerLoginFlowAlias: provider.postBrokerLoginFlowAlias }));
      console.log(JSON.stringify(await api('GET', `/authentication/flows/${encodeURIComponent(provider.firstBrokerLoginFlowAlias || 'first broker login')}/executions`), null, 2));
    }
    console.log('Required actions:', JSON.stringify((await api('GET', '/authentication/required-actions'))
      .map(({ alias, enabled, defaultAction }) => ({ alias, enabled, defaultAction }))));
  } else if (process.argv.includes('--activate-theme') || process.argv.includes('--deactivate-theme')) {
    // Same SIDPB theme for the login pages and the account console ("Gerenciar minha conta").
    const loginTheme = process.argv.includes('--activate-theme') ? 'sidpb' : null;
    const accountTheme = loginTheme;
    const response = await fetch(`${kc}/admin/realms/sidpb`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${env.KC_ADMIN_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginTheme, accountTheme }),
    });
    if (!response.ok) throw new Error(`Unable to update themes: HTTP ${response.status}`);
    console.log(loginTheme ? 'Login and account themes sidpb activated.' : 'Login and account themes returned to the Keycloak default.');
  } else if (process.argv.includes('--inspect')) {
    const response = await fetch(`${kc}/admin/realms/sidpb`, { headers: { Authorization: `Bearer ${env.KC_ADMIN_TOKEN}` } });
    const realm = await response.json();
    const keys = ['registrationAllowed','registrationEmailAsUsername','verifyEmail','resetPasswordAllowed','loginWithEmailAllowed','duplicateEmailsAllowed','rememberMe','editUsernameAllowed','internationalizationEnabled','supportedLocales','defaultLocale','loginTheme','accountTheme'];
    console.log(JSON.stringify(Object.fromEntries(keys.map(key => [key, realm[key]])), null, 2));
    const providers = await fetch(`${kc}/admin/realms/sidpb/identity-provider/instances`, { headers: { Authorization: `Bearer ${env.KC_ADMIN_TOKEN}` } });
    if (providers.ok) console.log('Identity provider aliases:', (await providers.json()).map(provider => provider.alias).join(', '));
    const executions = await fetch(`${kc}/admin/realms/sidpb/authentication/flows/registration/executions`, { headers: { Authorization: `Bearer ${env.KC_ADMIN_TOKEN}` } });
    if (executions.ok) {
      const password = (await executions.json()).find(execution => execution.providerId === 'registration-password-action');
      if (password) {
        let config;
        if (password.authenticationConfig) {
          const response = await fetch(`${kc}/admin/realms/sidpb/authentication/config/${password.authenticationConfig}`, { headers: { Authorization: `Bearer ${env.KC_ADMIN_TOKEN}` } });
          if (response.ok) config = (await response.json()).config;
        }
        console.log('Registration password execution:', JSON.stringify({ requirement: password.requirement, config: config || null }, null, 2));
      }
    }
  } else if (process.argv.includes('--disable-test-fixtures')) {
    const headers = { Authorization: `Bearer ${env.KC_ADMIN_TOKEN}`, 'Content-Type': 'application/json' };
    const response = await fetch(`${kc}/admin/realms/sidpb/users?search=oidc-test-&max=1000`, { headers });
    for (const user of await response.json()) {
      if (/^oidc-test-(user|curator|admin)-[a-f0-9]{10}@example\.invalid$/.test(user.username) && user.firstName === 'OIDC' && user.lastName === 'Test') {
        const result = await fetch(`${kc}/admin/realms/sidpb/users/${user.id}`, { method: 'PUT', headers, body: JSON.stringify({ enabled: false }) });
        if (!result.ok) throw new Error('Unable to disable test fixture');
      }
    }
    console.log('Dedicated OIDC test fixtures disabled; no users deleted.');
  } else await configure(env);
} finally { await browser.close(); }

