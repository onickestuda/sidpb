// Read-only URL/CSRF/cookie smoke test. No user, realm or application data mutations.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { publicUrls } from '../../infra/local-env.mjs';
const { origin, app, kc, issuer } = publicUrls();
// Test transport may target an isolated build; public URLs always stay canonical.
const transport = process.env.SIDPB_TEST_TRANSPORT || origin;
const endpoint = action => app.replace(origin, transport) + '/api/auth/' + action + '/';
for (const invalid of ['http://127.0.0.1:7080', 'https://attacker.invalid', 'null']) {
  assert.equal((await fetch(endpoint('login'), { method: 'POST', headers: { Origin: invalid } })).status, 403);
}
assert.equal((await fetch(endpoint('login'), { method: 'POST' })).status, 403);
assert.equal((await fetch(endpoint('login'), { method: 'POST', headers: { Origin: origin, 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
const discovery = await (await fetch(issuer + '/.well-known/openid-configuration')).json();
assert.equal(discovery.issuer, issuer);
for (const action of ['login', 'register', 'google', 'recover', 'verify']) {
  const response = await fetch(endpoint(action), { method: 'POST', headers: { Origin: origin }, redirect: 'manual' });
  assert.equal(response.status, 303, action);
  const target = new URL(response.headers.get('location'));
  assert.equal(target.origin, kc);
  assert.equal(target.searchParams.get('redirect_uri'), app + '/api/auth/callback/');
  assert.equal(target.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(target.searchParams.get('state') && target.searchParams.get('nonce'));
  if (action === 'google') assert.equal(target.searchParams.get('kc_idp_hint'), 'google');
  if (action === 'register') assert.ok(target.pathname.endsWith('/registrations'));
  const cookie = response.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/i); assert.match(cookie, /SameSite=lax/i);
  assert.ok(cookie.includes('Path=' + new URL(app).pathname + '/'));
  assert.ok(!/Domain=/i.test(cookie));
}
const response = await fetch(endpoint('logout'), { method: 'POST', headers: { Origin: origin } });
assert.equal(response.status, 200);
const logout = new URL((await response.json()).url);
assert.equal(logout.origin, kc);
assert.equal(logout.searchParams.get('post_logout_redirect_uri'), app + '/');
console.log('PASS canonical issuer, five OIDC actions, PKCE, host-only cookies, logout URL and CSRF rejection');
const browser = await chromium.launch();
const failures = [];
try {
  for (const action of ['map', 'login', 'google', 'register', 'recover']) {
    const page = await browser.newPage();
    if (transport !== origin) await page.route(origin + '/**', async route => {
      const response = await route.fetch({ url: route.request().url().replace(origin, transport), maxRedirects: 0 });
      await route.fulfill({ response });
    });
    try {
      await page.goto(app + '/');
      const labels = { map: 'Acessar o mapa', login: 'Continuar com e-mail', google: 'Continuar com Google', register: 'Cadastre-se', recover: 'Continuar com e-mail' };
      await page.getByRole(['map', 'register'].includes(action) ? 'link' : 'button', { name: labels[action], exact: true }).click();
      if (action === 'map') await page.waitForURL(app + '/dashboard/');
      else {
        await page.waitForURL(url => url.origin !== origin);
        if (action === 'google' && new URL(page.url()).hostname === 'accounts.google.com') {
          console.log('PASS Google provider redirect (consent not exercised)');
        } else {
          const body = await page.locator('body').innerText();
          assert.ok(!/redirect_uri|invalid parameter|par?metro inv?lido/i.test(body), 'Keycloak rejected canonical redirect_uri');
          if (action === 'recover') await page.locator('a[href*="reset-credentials"]').click();
          await page.locator(action === 'register' ? '#kc-register-form' : action === 'recover' ? '#kc-reset-password-form' : '#username').waitFor({ timeout: 10000 });
        }
      }
      console.log('PASS browser ' + action);
    } catch (error) { failures.push(action + ': ' + error.message); }
    finally { await page.unrouteAll({ behavior: 'ignoreErrors' }); await page.close(); }
  }
} finally { await browser.close(); }
assert.deepEqual(failures, [], failures.join('\n'));
