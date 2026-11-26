// Disposable Keycloak + in-memory SMTP sink. Never reads .env or contacts the live realm.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer as tcpServer } from 'node:net';
import { createServer } from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { chromium } from '../../frontend/node_modules/playwright/index.mjs';

const messages = [];
const smtp = tcpServer(socket => {
  socket.setEncoding('utf8'); socket.write('220 isolated SIDPB test SMTP\r\n');
  let buffer = '', data = false, message = '';
  socket.on('data', chunk => {
    buffer += chunk;
    while (buffer.includes('\r\n')) {
      const index = buffer.indexOf('\r\n'), line = buffer.slice(0, index); buffer = buffer.slice(index + 2);
      if (data) {
        if (line === '.') { messages.push(message); message = ''; data = false; socket.write('250 Accepted\r\n'); }
        else message += line.replace(/^\.\./, '.') + '\r\n';
      } else if (/^(EHLO|HELO)/i.test(line)) socket.write('250 isolated\r\n');
      else if (/^DATA/i.test(line)) { data = true; socket.write('354 Send message\r\n'); }
      else if (/^QUIT/i.test(line)) socket.end('221 Bye\r\n');
      else socket.write('250 OK\r\n');
    }
  });
  socket.on('error', () => {});
});
await new Promise(resolve => smtp.listen(0, '0.0.0.0', resolve));
const callbackServer = createServer((req, res) => { res.end('Isolated OIDC callback'); });
await new Promise(resolve => callbackServer.listen(0, 'localhost', resolve));
const callback = `http://localhost:${callbackServer.address().port}/callback`;
const reservation = tcpServer();
await new Promise(resolve => reservation.listen(0, 'localhost', resolve));
const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
const base = `http://localhost:${port}`, password = randomBytes(24).toString('hex');
const adminName = 'isolated-admin', client = 'isolated-web', webSecret = randomBytes(24).toString('hex');
let container, browser, token;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function admin(method, path, body) {
  if (JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).exp * 1000 < Date.now() + 10000) {
    const refreshed = await fetch(base + '/realms/master/protocol/openid-connect/token', { method: 'POST',
      body: new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli', username: adminName, password }) });
    assert.equal(refreshed.status, 200); token = (await refreshed.json()).access_token;
  }
  const response = await fetch(base + '/admin/' + path, { method,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  assert.ok(response.ok, `Isolated admin ${method} ${path}: ${response.status}`);
  return response.status === 204 || response.status === 201 ? null : response.json();
}
async function authorize(page, registration = false) {
  const verifier = randomBytes(32).toString('base64url'), state = randomBytes(24).toString('hex');
  const query = new URLSearchParams({ client_id: client, redirect_uri: callback, scope: 'openid email profile',
    response_type: 'code', state, nonce: randomBytes(24).toString('hex'),
    code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' });
  await page.goto(base + '/realms/sidpb/protocol/openid-connect/' + (registration ? 'registrations' : 'auth') + '?' + query);
  return { verifier, state };
}
async function exchange(page, transaction) {
  await page.waitForURL(url => url.origin + url.pathname === callback);
  const url = new URL(page.url()); assert.equal(url.searchParams.get('state'), transaction.state);
  const result = await fetch(base + '/realms/sidpb/protocol/openid-connect/token', { method: 'POST',
    body: new URLSearchParams({ grant_type: 'authorization_code', client_id: client, client_secret: webSecret, redirect_uri: callback,
      code: url.searchParams.get('code'), code_verifier: transaction.verifier }) });
  assert.equal(result.status, 200);
  const tokens = await result.json();
  const claims = JSON.parse(Buffer.from(tokens.id_token.split('.')[1], 'base64url'));
  assert.equal(claims.iss, base + '/realms/sidpb'); assert.equal(claims.email_verified, true);
  return { tokens, claims };
}
async function messageAfter(count) {
  for (let n = 0; n < 100 && messages.length <= count; n++) await pause(100);
  assert.ok(messages.length > count, 'Expected an email in the isolated SMTP sink');
  const decoded = messages.at(-1).replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, code) => String.fromCharCode(parseInt(code, 16))).replaceAll('&amp;', '&');
  const match = decoded.match(/http:\/\/localhost:\d+\/realms\/sidpb\/login-actions\/action-token\?[^\s<>"']+/);
  assert.ok(match, 'Expected a native Keycloak action link'); return match[0];
}
async function fillLogin(page, email, value) {
  await page.locator('#username').fill(email); await page.locator('#password').fill(value); await page.locator('#kc-login').click();
}
async function active(value, hint) {
  const response = await fetch(base + '/realms/sidpb/protocol/openid-connect/token/introspect', { method: 'POST',
    body: new URLSearchParams({ client_id: client, client_secret: webSecret, token: value, token_type_hint: hint }) });
  assert.equal(response.status, 200); return (await response.json()).active;
}
async function register(page, email, value) {
  await page.locator('#firstName').fill('Isolated'); await page.locator('#lastName').fill('Fixture');
  await page.locator('#email').fill(email); await page.locator('#password').fill(value); await page.locator('#password-confirm').fill(value);
  await page.locator('#kc-register-form input[type=submit], #kc-register-form button[type=submit]').click();
}
try {
  container = execFileSync('docker', ['run', '--rm', '-d', '--name', 'sidpb-native-test-' + randomBytes(5).toString('hex'),
    '-p', `127.0.0.1:${port}:8080`, '-e', 'KC_BOOTSTRAP_ADMIN_USERNAME=' + adminName, '-e', 'KC_BOOTSTRAP_ADMIN_PASSWORD=' + password,
    'quay.io/keycloak/keycloak:26.8.1', 'start-dev', '--hostname=' + base], { encoding: 'utf8' }).trim();
  let ready = false;
  for (let n = 0; n < 120; n++) {
    try { ready = (await fetch(base + '/realms/master', { signal: AbortSignal.timeout(1000) })).ok; } catch {}
    if (ready) break; await pause(1000);
  }
  assert.ok(ready, 'Disposable Keycloak did not start');
  // Password grant is used only for the randomly bootstrapped administrator of this disposable instance.
  const authentication = await fetch(base + '/realms/master/protocol/openid-connect/token', { method: 'POST',
    body: new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli', username: adminName, password }) });
  assert.equal(authentication.status, 200); token = (await authentication.json()).access_token;
  await admin('POST', 'realms', { realm: 'sidpb', enabled: true, registrationAllowed: true,
    registrationEmailAsUsername: true, loginWithEmailAllowed: true, verifyEmail: true, resetPasswordAllowed: true, loginTheme: 'keycloak',
    smtpServer: { host: 'host.docker.internal', port: String(smtp.address().port), from: 'sidpb@isolated.invalid', ssl: 'false', starttls: 'false', auth: 'false' },
    clients: [{ clientId: client, enabled: true, publicClient: false, secret: webSecret, standardFlowEnabled: true, directAccessGrantsEnabled: false,
      redirectUris: [callback], webOrigins: [], attributes: { 'pkce.code.challenge.method': 'S256', 'post.logout.redirect.uris': callback } }] });
  const executions = await admin('GET', 'realms/sidpb/authentication/flows/registration/executions');
  const passwordExecution = executions.find(execution => execution.providerId === 'registration-password-action');
  assert.ok(passwordExecution);
  await admin('POST', `realms/sidpb/authentication/executions/${passwordExecution.id}/config`, {
    alias: 'isolated-registration-password', config: { always_set_password_on_register_form: 'true' } });
  browser = await chromium.launch();
  const context = await browser.newContext(), page = await context.newPage();
  const email = 'native-fixture@example.invalid', userPassword = randomBytes(18).toString('base64url');
  const transaction = await authorize(page, true); let count = messages.length;
  await register(page, email, userPassword); await messageAfter(count);
  await page.locator('#kc-info-wrapper a').waitFor();
  count = messages.length; await page.locator('#kc-info-wrapper a').first().click();
  assert.equal(messages.length, count, 'Native resend cooldown must prevent immediate duplicates');
  console.log('PASS native resend cooldown; waiting for its 30-second interval');
  await pause(31000); await page.locator('#kc-info-wrapper a').first().click();
  const verification = await messageAfter(count);
  await page.goto(verification);
  // Native email action may show a continue link when the original authentication tab changed.
  if (!page.url().startsWith(callback)) {
    const continueLink = page.locator('#kc-info-message a');
    if (await continueLink.count()) await continueLink.first().click();
  }
  const first = await exchange(page, transaction);
  console.log('PASS native registration, verification email, resend and verified OIDC login');
  const oldSub = first.claims.sub;
  // RP initiated logout, then recovery in a clean browser session.
  await page.goto(base + '/realms/sidpb/protocol/openid-connect/logout?' + new URLSearchParams({ id_token_hint: first.tokens.id_token, post_logout_redirect_uri: callback }));
  await page.waitForURL(callback); await context.close();
  const recoveryContext = await browser.newContext(), recovery = await recoveryContext.newPage();
  const recoveryTransaction = await authorize(recovery); await recovery.locator('a[href*="reset-credentials"]').click();
  count = messages.length; await recovery.locator('#username').fill(email); await recovery.locator('#kc-reset-password-form input[type=submit]').click();
  await recovery.goto(await messageAfter(count));
  const changedPassword = randomBytes(18).toString('base64url');
  await recovery.locator('#password-new').fill(changedPassword); await recovery.locator('#password-confirm').fill(changedPassword);
  await recovery.locator('#kc-passwd-update-form input[type=submit]').click();
  if (!recovery.url().startsWith(callback) && await recovery.locator('#kc-info-message a').count()) await recovery.locator('#kc-info-message a').first().click();
  const recovered = await exchange(recovery, recoveryTransaction); assert.equal(recovered.claims.sub, oldSub);
  assert.equal(await active(recovered.tokens.refresh_token, 'refresh_token'), true);
  console.log('PASS native password recovery preserves the subject; real logout');
  await admin('PUT', 'realms/sidpb/users/' + oldSub, { enabled: false });
  assert.equal(await active(recovered.tokens.access_token, 'access_token'), false);
  assert.equal(await active(recovered.tokens.refresh_token, 'refresh_token'), false);
  const disabled = await browser.newPage(); await authorize(disabled); await fillLogin(disabled, email, changedPassword);
  await disabled.locator('#input-error, .alert-error').first().waitFor(); assert.ok(!disabled.url().startsWith(callback));
  await admin('PUT', 'realms/sidpb/users/' + oldSub, { enabled: true });
  const enabled = await browser.newPage(), enabledTransaction = await authorize(enabled); await fillLogin(enabled, email, changedPassword);
  assert.equal((await exchange(enabled, enabledTransaction)).claims.sub, oldSub);
  console.log('PASS disabled login denied; reactivation preserves identity');
  await admin('DELETE', 'realms/sidpb/users/' + oldSub);
  assert.equal(await active(recovered.tokens.refresh_token, 'refresh_token'), false);
  const refresh = await fetch(base + '/realms/sidpb/protocol/openid-connect/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'refresh_token', client_id: client, client_secret: webSecret, refresh_token: recovered.tokens.refresh_token }) });
  assert.equal(refresh.status, 400);
  const fresh = await browser.newPage(), freshTransaction = await authorize(fresh, true); count = messages.length;
  await register(fresh, email, userPassword); await fresh.goto(await messageAfter(count));
  if (!fresh.url().startsWith(callback) && await fresh.locator('#kc-info-message a').count()) await fresh.locator('#kc-info-message a').first().click();
  assert.notEqual((await exchange(fresh, freshTransaction)).claims.sub, oldSub);
  console.log('PASS console deletion revokes refresh; same-email registration has a new verified subject');
} finally {
  if (browser) await browser.close();
  if (container) execFileSync('docker', ['stop', container], { stdio: 'ignore' });
  smtp.close(); callbackServer.close();
}
