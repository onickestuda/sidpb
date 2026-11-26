// Real local OIDC, BFF, API and PostgreSQL integration. Dedicated fixtures are disabled afterwards.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import * as oidc from 'openid-client';
import { env, publicUrls } from '../../infra/local-env.mjs';
const { kc } = publicUrls();
const origin = process.env.AUTH_TEST_ORIGIN || publicUrls().origin;
const app = origin + env.NEXT_PUBLIC_BASE_PATH;
const api = process.env.AUTH_TEST_API || publicUrls().api;
const browser = await chromium.launch();
let adminToken, adminRefresh, adminExpires=0;
const fixtures = [];
async function admin(method, path, body) {
  if (Date.now()>=adminExpires && adminRefresh) {
    const refreshed=await fetch(kc+'/realms/master/protocol/openid-connect/token',{method:'POST',body:new URLSearchParams({grant_type:'refresh_token',client_id:'security-admin-console',refresh_token:adminRefresh})});
    assert.ok(refreshed.ok,'Administrative test session refresh failed');
    const tokens=await refreshed.json();adminToken=tokens.access_token;adminRefresh=tokens.refresh_token;adminExpires=Date.now()+(tokens.expires_in-10)*1000;
  }
  const response = await fetch(`${kc}/admin/realms/sidpb${path}`, { method,
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  assert.ok(response.ok, `${method} ${path}: ${response.status}`);
  const text = await response.text(); return text ? JSON.parse(text) : null;
}
async function login(page, fixture) {
  await page.goto(app + '/');
  await page.getByRole('button', { name: 'Continuar com e-mail', exact: true }).click();
  await page.locator('#username').fill(fixture.username);
  await page.locator('#password').fill(fixture.password);
  await page.locator('#kc-login').click();
  await page.waitForURL(url => url.origin === origin && /\/(usuario|curador|admin)\//.test(url.pathname), { timeout: 45000 });
  const response = await page.request.get(app + '/api/auth/session/');
  assert.equal(response.status(), 200);
  return response.json();
}
async function request(page, path, method = 'GET', body) {
  return page.evaluate(async ({ path, method, body }) => {
    const [pathname, query] = path.split('?');
    const response = await fetch('/sidpb/api/bff/' + pathname + '/' + (query ? '?' + query : ''), { method,
      headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    const text = await response.text(); return { status: response.status, data: text ? JSON.parse(text) : null };
  }, { path, method, body });
}
try {
  const operator = await browser.newPage();
  const tokenResponse = operator.waitForResponse(r => r.url().includes('/realms/master/protocol/openid-connect/token') && r.request().method() === 'POST' && r.status() === 200);
  await operator.goto(kc + '/admin/master/console/');
  await operator.locator('#username').fill(env.KEYCLOAK_ADMIN);
  await operator.locator('#password').fill(env.KEYCLOAK_ADMIN_PASSWORD);
  await operator.locator('#kc-login').click();
  const adminTokens=await(await tokenResponse).json();adminToken=adminTokens.access_token;adminRefresh=adminTokens.refresh_token;adminExpires=Date.now()+(adminTokens.expires_in-10)*1000;
  const suffix = randomBytes(5).toString('hex');
  for (const role of ['USER', 'CURATOR', 'ADMIN']) {
    const fixture = { username: `oidc-test-${role.toLowerCase()}-${suffix}@example.invalid`, password: randomBytes(24).toString('base64url'), role };
    await admin('POST', '/users', { username: fixture.username, email: fixture.username,
      firstName: 'OIDC', lastName: 'Test', enabled: true, emailVerified: true,
      credentials: [{ type: 'password', value: fixture.password, temporary: false }] });
    [fixture.user] = await admin('GET', '/users?username=' + fixture.username + '&exact=true'); fixtures.push(fixture);
    await admin('POST', `/users/${fixture.user.id}/role-mappings/realm`, [await admin('GET', '/roles/' + role)]);
  }
  const anonymous = await browser.newPage();
  assert.equal((await anonymous.request.get(app + '/api/auth/account/', { maxRedirects: 0 })).status(), 401);
  assert.equal((await anonymous.request.get(app + '/api/bff/submissions/user/3/')).status(), 401);
  assert.equal((await anonymous.request.post(app + '/api/auth/login/', { headers: { Origin: 'https://attacker.invalid' } })).status(), 403);
  assert.equal((await anonymous.request.get(app + '/api/auth/callback/?code=forged&state=forged')).status(), 200);
  assert.equal((await anonymous.request.get(api+'/api/mapa/ocorrencias')).status(), 200);
  await anonymous.goto(app + '/dashboard/');
  await anonymous.evaluate(() => localStorage.setItem('sidpb-auth-user', JSON.stringify({ id: 1, role: 'ADMIN', name: 'forged', email: 'a@a.org' })));
  await anonymous.reload();
  assert.equal(await (await anonymous.request.get(app + '/api/auth/session/')).json(), null);
  assert.equal((await anonymous.request.get(app + '/api/bff/admin/users/')).status(), 401);
  for (const action of ['login', 'register', 'google', 'recover']) {
    const response = await anonymous.request.post(`${app}/api/auth/${action}/`, { headers: { Origin: origin }, maxRedirects: 0 });
    assert.equal(response.status(), 303);
    const destination = new URL(response.headers().location);
    assert.equal(destination.origin, kc);
    assert.equal(destination.searchParams.get('code_challenge_method'), 'S256');
    assert.ok(destination.searchParams.get('state') && destination.searchParams.get('nonce'));
    if (action === 'register') assert.ok(destination.pathname.endsWith('/registrations'));
    if (action === 'google') assert.equal(destination.searchParams.get('kc_idp_hint'), 'google');
  }
  console.log('PASS login, registration, Google and recovery initiation with PKCE');
  console.log('PASS public map, anonymous private denial, CSRF, forged callback/storage');

  for (const fixture of fixtures) {
    fixture.context = await browser.newContext(); fixture.page = await fixture.context.newPage();
    fixture.local = await login(fixture.page, fixture);
    assert.equal(fixture.local.role, fixture.role);
    await fixture.page.reload();
    const restored = await (await fixture.page.request.get(app + '/api/auth/session/')).json();
    assert.equal(restored.id, fixture.local.id);
    for (const [section, path] of [['google', 'account-security/linked-accounts'], ['password', 'account-security/signing-in']]) {
      const account = await fixture.page.request.get(`${app}/api/auth/account/?section=${section}`, { maxRedirects: 0 });
      assert.equal(account.status(), 303);
      const target = new URL(account.headers().location);
      assert.equal(target.origin, kc); assert.equal(target.pathname, '/realms/sidpb/account/' + path);
      const accountPage = await fixture.context.newPage();
      await accountPage.goto(target.toString());
      await accountPage.locator('main h1').waitFor();
      assert.equal(new URL(accountPage.url()).pathname, target.pathname, 'Native account route must not fall back to the profile page');
      await accountPage.close();
    }
    const cookies = await fixture.context.cookies(); const session = cookies.find(c => c.name === 'sidpb-session');
    assert.ok(session?.httpOnly); assert.equal(session.sameSite, 'Lax'); assert.equal(session.path, '/sidpb/');
    assert.equal((await request(fixture.page, 'submissions/user/' + fixture.local.id)).status, 200);
    assert.equal((await request(fixture.page, 'submissions/user/1')).status, 403);
    assert.equal((await request(fixture.page, 'curation/submissions')).status, fixture.role === 'USER' ? 403 : 200);
    assert.equal((await request(fixture.page, 'admin/users')).status, fixture.role === 'ADMIN' ? 200 : 403);
    if (fixture.role !== 'ADMIN') assert.equal((await request(fixture.page, `admin/users/${fixture.user.id}/roles`, 'PUT', { roles: ['USER','ADMIN'] })).status, 403);
    console.log(`PASS ${fixture.role}: login, session recovery, hierarchy and ownership`);
  }
  const [user, curator, administrator] = fixtures;
  assert.equal((await request(administrator.page, `admin/users/${administrator.user.id}/roles`, 'PUT', { roles: ['USER'] })).status, 403);
  if (process.env.AUTH_TEST_RESTART === 'true') {
    execFileSync('docker', ['compose','restart','api','frontend'], { cwd: new URL('../../', import.meta.url), stdio: 'ignore' });
    for (let attempt = 0; attempt < 30; attempt++) {
      try { if ((await fetch(api + '/api/mapa/ocorrencias')).ok) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    const restored = await (await user.page.request.get(app + '/api/auth/session/')).json();
    assert.equal(restored?.id, user.local.id);
    console.log('PASS persistent BFF session after restarting API and frontend containers');
  }
  if (process.env.AUTH_TEST_EXTENDED === 'true') {
    console.log('Waiting 100 seconds to exercise real refresh rotation with concurrent requests...');
    await new Promise(resolve => setTimeout(resolve, 100000));
    const refreshed = await Promise.all(Array.from({ length: 12 }, async () => {
      const response = await user.page.request.get(app + '/api/auth/session/');
      assert.equal(response.status(), 200); return response.json();
    }));
    assert.ok(refreshed.every(value => value?.id === user.local.id));
    console.log('PASS concurrent token refresh after access-token refresh threshold');
  }
  const submission = await user.page.evaluate(async ({ id }) => {
    const data = new FormData();
    data.append('data', new Blob([JSON.stringify({ userId: 1, originalLink: 'https://example.org/oidc-test', userData: { title: 'OIDC integration test', authors: [] } })], { type: 'application/json' }));
    data.append('pdf', new Blob(['%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF'], { type: 'application/pdf' }), 'oidc-test.pdf');
    const response = await fetch('/sidpb/api/bff/submissions/', { method: 'POST', body: data });
    return { status: response.status, body: await response.json() };
  }, { id: user.local.id });
  assert.equal(submission.status, 201); assert.equal(submission.body.submittedBy.id, user.local.id);
  assert.equal((await request(user.page, `curation/submissions/${submission.body.id}/reject`, 'POST', { curatorId: curator.local.id, reason: 'forged' })).status, 403);
  const reviewed = await request(curator.page, `curation/submissions/${submission.body.id}/reject`, 'POST', { curatorId: 1, reason: 'Automated OIDC verification fixture' });
  assert.equal(reviewed.status, 200); assert.equal(reviewed.data.reviewedBy.id, curator.local.id);
  console.log('PASS user submission, forged author/curator IDs and curator decision');

  // Confirm expanded composite roles in an actual token, not just mocked Spring authorities.
  const config = await oidc.discovery(new URL(kc + '/realms/sidpb'), 'sidpb-web', env.KEYCLOAK_WEB_SECRET, undefined, { execute: [oidc.allowInsecureRequests] });
  const verifier = oidc.randomPKCECodeVerifier(), state = oidc.randomState(), nonce = oidc.randomNonce();
  const callback = app + '/api/auth/callback/';
  const url = oidc.buildAuthorizationUrl(config, { redirect_uri: callback, response_type: 'code', scope: 'openid profile email', state, nonce,
    code_challenge: await oidc.calculatePKCECodeChallenge(verifier), code_challenge_method: 'S256' });
  const authorization = await administrator.page.request.get(url.toString(), { maxRedirects: 0 });
  assert.equal(authorization.status(), 302);
  const callbackUrl = authorization.headers().location;
  const tokens = await oidc.authorizationCodeGrant(config, new URL(callbackUrl), { pkceCodeVerifier: verifier, expectedState: state, expectedNonce: nonce, idTokenExpected: true });
  const claims = JSON.parse(Buffer.from(tokens.access_token.split('.')[1], 'base64url').toString());
  assert.ok(['ADMIN','CURATOR','USER'].every(role => claims.realm_access.roles.includes(role)));
  assert.ok([claims.aud].flat().includes('sidpb-api')); assert.equal(claims.iss, kc + '/realms/sidpb');
  const forgedParts = tokens.access_token.split('.');
  forgedParts[1] = Buffer.from(JSON.stringify({ ...claims, sub: 'forged-sub' })).toString('base64url');
  assert.equal((await fetch(api+'/api/auth/me', { headers: { Authorization: 'Bearer ' + forgedParts.join('.') } })).status, 401);
  await administrator.page.goto(app + '/admin/');
  console.log('PASS actual JWT issuer, audience and expanded ADMIN composite roles');

  if (process.env.AUTH_TEST_ADMIN === 'true') {
    const fixture={username:`oidc-test-member-${suffix}@example.invalid`,password:randomBytes(24).toString('base64url'),role:'USER'};
    await admin('POST','/users',{username:fixture.username,email:fixture.username,firstName:'Equipe',lastName:'Teste',enabled:true,emailVerified:true,credentials:[{type:'password',value:fixture.password,temporary:false}]});
    [fixture.user]=await admin('GET','/users?username='+fixture.username+'&exact=true');fixtures.push(fixture);
    const target=fixture.user.id;
    const listed=await request(administrator.page,`admin/users?search=${fixture.username}&profile=USER&enabled=true`);
    assert.equal(listed.status,200);assert.equal(listed.data.items.length,1);assert.equal(listed.data.items[0].id,target);
    const detail=await request(administrator.page,`admin/users/${target}`);
    assert.deepEqual(detail.data.authenticationMethods,['E-mail e senha']);assert.ok(!JSON.stringify(detail.data).includes('credentialData'));
    assert.equal((await request(administrator.page,`admin/users/${target}/roles`,'PUT',{profile:'realm-admin',confirmed:true})).status,400);
    const unconfirmed=await request(administrator.page,`admin/users/${target}/roles`,'PUT',{profile:'ADMIN'});
    assert.equal(unconfirmed.status,400,JSON.stringify(unconfirmed.data));
    assert.equal((await request(administrator.page,`admin/users/${administrator.user.id}/status`,'PUT',{enabled:false,confirmed:true})).status,403);
    assert.equal((await request(administrator.page,`admin/users/${administrator.user.id}/roles`,'PUT',{profile:'USER',confirmed:true})).status,403);
    const firstPage=await request(administrator.page,'admin/users?search=oidc-test-&max=1');
    assert.equal(firstPage.data.items.length,1);assert.ok(firstPage.data.nextFirst>0);
    const secondPage=await request(administrator.page,`admin/users?search=oidc-test-&max=1&first=${firstPage.data.nextFirst}`);
    assert.equal(secondPage.data.items.length,1);assert.notEqual(firstPage.data.items[0].id,secondPage.data.items[0].id);
    const team=await request(administrator.page,`admin/users?team=true&profile=CURATOR&search=${curator.username}`);
    assert.equal(team.data.items.length,1);assert.equal(team.data.items[0].reviews,1);
    const internalBefore=(await admin('GET',`/users/${target}/role-mappings/realm`)).filter(r=>!['USER','CURATOR','ADMIN'].includes(r.name)).map(r=>r.id).sort();
    await administrator.page.goto(app+'/admin/usuarios/');
    await administrator.page.getByLabel('Nome ou e-mail').fill(fixture.username);
    await administrator.page.getByRole('button',{name:'Buscar',exact:true}).click();
    await administrator.page.getByRole('button',{name:'Ver detalhes de Equipe Teste',exact:true}).click();
    const dialog=administrator.page.getByRole('dialog');await dialog.getByLabel('Perfil de acesso').waitFor();
    for(const profile of ['CURATOR','ADMIN','USER']) {
      await dialog.getByLabel('Perfil de acesso').selectOption(profile);
      await dialog.getByRole('button',{name:'Revisar alteração de perfil'}).click();
      assert.equal(await dialog.getByRole('button',{name:'Confirmar alteração',exact:true}).isEnabled(),false);
      await dialog.getByRole('checkbox').check();
      await dialog.getByRole('button',{name:'Confirmar alteração',exact:true}).click();
      await dialog.getByText('Alteração confirmada.',{exact:false}).waitFor();
      await dialog.getByRole('region',{name:'Confirmar alteração'}).waitFor({state:'detached'});
      const mappings=await admin('GET',`/users/${target}/role-mappings/realm`);
      assert.deepEqual(mappings.filter(r=>['USER','CURATOR','ADMIN'].includes(r.name)).map(r=>r.name),[profile]);
      assert.deepEqual(mappings.filter(r=>!['USER','CURATOR','ADMIN'].includes(r.name)).map(r=>r.id).sort(),internalBefore);
      assert.equal((await request(administrator.page,`admin/users/${target}`)).data.user.profile,profile);
    }
    await dialog.getByRole('button',{name:'Desativar conta',exact:true}).click();await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Confirmar alteração',exact:true}).click();
    await dialog.getByRole('button',{name:'Ativar conta',exact:true}).waitFor();
    assert.equal((await admin('GET',`/users/${target}`)).enabled,false);
    const disabledPage=await browser.newPage();await disabledPage.goto(app+'/');await disabledPage.getByRole('button',{name:'Continuar com e-mail',exact:true}).click();
    await disabledPage.locator('#username').fill(fixture.username);await disabledPage.locator('#password').fill(fixture.password);await disabledPage.locator('#kc-login').click();
    await disabledPage.locator('[class*="alert-error"], .pf-m-danger, [id^="input-error"]:visible').first().waitFor();await disabledPage.close();
    await dialog.getByRole('button',{name:'Ativar conta',exact:true}).click();await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Confirmar alteração',exact:true}).click();await dialog.getByRole('button',{name:'Desativar conta',exact:true}).waitFor();
    const history=await request(administrator.page,`admin/users/history?target=${target}`);
    assert.equal(history.data.length,5);assert.ok(history.data.every(event=>event.result==='SUCCESS'&&event.actor_sub===administrator.user.id&&event.target_sub===target));
    await administrator.page.screenshot({path:(process.env.TEMP||'.')+'/sidpb-admin-details-desktop.png',fullPage:true});
    await administrator.page.keyboard.press('Escape');
    await administrator.page.getByRole('tab',{name:'Curadoria',exact:true}).click();await administrator.page.getByRole('link',{name:'Abrir curadoria'}).waitFor();
    await administrator.page.getByRole('tab',{name:'Histórico',exact:true}).click();await administrator.page.getByText('Alteração de perfil',{exact:true}).first().waitFor();
    await administrator.page.setViewportSize({width:390,height:844});await administrator.page.getByRole('tab',{name:'Usuários',exact:true}).click();
    await administrator.page.getByLabel('Nome ou e-mail').waitFor();
    await administrator.page.getByLabel('Nome ou e-mail').fill(fixture.username);
    await administrator.page.getByRole('button',{name:'Buscar',exact:true}).click();
    await administrator.page.getByRole('button',{name:'Ver detalhes de Equipe Teste',exact:true}).waitFor();
    assert.ok(await administrator.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await administrator.page.screenshot({path:(process.env.TEMP||'.')+'/sidpb-admin-mobile.png',fullPage:true});
    await administrator.page.setViewportSize({width:1440,height:900});
    console.log('PASS real admin UI: filters, details, CURATOR/ADMIN promotion and demotion, confirmations, activation, disabled login rejection, audit actor, internal role preservation and responsive tabs');
  }

  const update = await request(administrator.page, `admin/users/${user.user.id}/roles`, 'PUT', { roles: ['USER','CURATOR'] });
  assert.equal(update.status, 200);
  assert.equal((await request(user.page, 'submissions/user/' + user.local.id)).status, 401);
  console.log('PASS role administration invalidates old sessions');
  await user.context.close(); user.context = await browser.newContext(); user.page = await user.context.newPage();
  // JWT iat has second precision; allow the audit revocation fence to advance.
  await new Promise(resolve=>setTimeout(resolve,1100));
  user.role = 'CURATOR'; await login(user.page, user);
  const disabled = await request(administrator.page, `admin/users/${user.user.id}`, 'PUT', {
    firstName: 'OIDC', lastName: 'Test', email: user.user.email, enabled: false, confirmed: true });
  assert.equal(disabled.status, 200);
  assert.equal((await request(user.page, 'submissions/user/' + user.local.id)).status, 401);
  console.log('PASS disabled account revokes active access');

  const logout = await curator.page.request.post(app + '/api/auth/logout/', { headers: { Origin: origin } });
  assert.equal(logout.status(), 200);
  await curator.page.goto((await logout.json()).url);
  assert.equal(await (await curator.page.request.get(app + '/api/auth/session/')).json(), null);
  await curator.page.goto(app + '/');
  await curator.page.getByRole('button', { name: 'Continuar com e-mail', exact: true }).click();
  await curator.page.locator('#username').waitFor();
  console.log('PASS local and Keycloak logout');
  console.log('All local real-service assertions passed. Google consent, SMTP delivery and mailbox verification require manual external validation.');
} finally {
  for (const fixture of fixtures) {
    if (fixture.user) {
      await admin('PUT', `/users/${fixture.user.id}`, { enabled: false }).catch(() => {});
      await admin('POST', `/users/${fixture.user.id}/logout`).catch(() => {});
    }
  }
  await browser.close();
}
