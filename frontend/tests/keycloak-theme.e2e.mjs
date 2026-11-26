import assert from 'node:assert/strict';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';

import { publicUrls } from '../../infra/local-env.mjs';
const { kc, app: appBase } = publicUrls();
const app = (process.env.AUTH_TEST_ORIGIN ? appBase.replace(publicUrls().origin, process.env.AUTH_TEST_ORIGIN) : appBase) + '/';
const screenshots = process.env.TEMP || process.cwd();
const browser = await chromium.launch();
const tileRequests=[];
browser.on('page',()=>{});
function observe(page) { page.on('request',request=>{if (/tile\.openstreetmap|\/\d+\/\d+\/\d+\.png/.test(request.url())) tileRequests.push(request.url());}); }
async function background(page) {
  await page.locator('.sidpb-auth-map').waitFor({state:'attached'});
  return page.locator('.sidpb-auth-map').evaluate(el=>{
    const css=getComputedStyle(el);return {url:css.backgroundImage.slice(5,-2),size:css.backgroundSize,position:css.backgroundPosition,filter:css.filter,opacity:css.opacity,transform:css.transform};
  });
}

async function openFromSidpb(page, buttonName) {
  await page.goto(app);
  await page.getByRole(buttonName==='Cadastre-se'?'link':'button', { name: buttonName, exact: true }).click();
  await page.waitForURL(url => url.origin === kc);
  assert.ok(await page.locator('link[href*="sidpb.css"]').count(), 'SIDPB stylesheet is not loaded');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.login-pf-page')).display === 'flex');
  assert.match((await background(page)).url,/login-map\.png/);
  assert.equal(await page.locator('.leaflet-container').count(), 0);
  assert.equal(await page.locator('.card-pf').evaluate(el => getComputedStyle(el).borderRadius), '0px');
  assert.ok((await page.title()).length > 0);
}

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  observe(desktop);
  await desktop.goto(app);
  assert.equal(await desktop.getByText(/Esqueceu a senha/).count(), 0);
  assert.equal(await desktop.getByRole('button', {name:'Verificar meu e-mail',exact:true}).count(), 0);
  assert.ok(await desktop.getByRole('link',{name:'Acessar o mapa',exact:true}).count());
  assert.ok(await desktop.getByRole('button',{name:'Continuar com Google',exact:true}).count());
  await desktop.getByRole('link',{name:'Cadastre-se',exact:true}).focus();
  assert.equal(await desktop.getByRole('link',{name:'Cadastre-se',exact:true}).evaluate(el=>el===document.activeElement),true);
  const original=await background(desktop);
  const source=await (await desktop.request.get(original.url)).body();
  await desktop.screenshot({path:join(screenshots,'sidpb-login-wall-static-desktop.png'),fullPage:true});
  await openFromSidpb(desktop, 'Continuar com e-mail');
  const themed=await background(desktop);
  const copy=await (await desktop.request.get(themed.url)).body();
  assert.equal(createHash('sha256').update(copy).digest('hex'),createHash('sha256').update(source).digest('hex'));
  for(const key of ['size','position','filter','opacity','transform'])assert.equal(themed[key],original[key]);
  await desktop.locator('#username').waitFor();
  await desktop.locator('#password').waitFor();
  assert.ok(await desktop.locator('#social-google').count(), 'Google identity provider button is missing');
  const logoUrl = await desktop.locator('#kc-header-wrapper').evaluate(element => getComputedStyle(element).backgroundImage);
  assert.match(logoUrl, /logo\.svg/);
  await desktop.screenshot({ path: join(screenshots, 'sidpb-keycloak-login-desktop.png'), fullPage: true });

  await desktop.locator('#username').fill('theme-check@example.invalid');
  await desktop.locator('#password').fill('invalid-theme-check');
  await desktop.locator('#kc-login').click();
  const error = desktop.locator('[class*="alert-error"], .pf-m-danger, [id^="input-error"]:visible').first();
  await error.waitFor();
  assert.ok((await error.innerText()).trim());

  const register = await browser.newPage({ viewport: { width: 390, height: 844 } });
  observe(register);
  await openFromSidpb(register, 'Cadastre-se');
  for (const id of ['firstName', 'lastName', 'email', 'password', 'password-confirm']) {
    await register.locator(`#${id}`).waitFor();
  }
  const overflow = await register.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `Registration overflows mobile viewport by ${overflow}px`);
  await register.screenshot({ path: join(screenshots, 'sidpb-keycloak-register-mobile.png'), fullPage: true });

  const recover = await browser.newPage({ viewport: { width: 390, height: 844 } });
  observe(recover);
  await openFromSidpb(recover, 'Continuar com e-mail');
  await recover.locator('a[href*="reset-credentials"]').click();
  await recover.locator('#kc-reset-password-form').waitFor();
  await recover.waitForFunction(() => getComputedStyle(document.querySelector('.login-pf-page')).display === 'flex');
  assert.ok(await recover.locator('#username').count());
  assert.equal(await recover.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), true);
  await recover.screenshot({ path: join(screenshots, 'sidpb-keycloak-recovery-mobile.png'), fullPage: true });

  // Presentation fixture for native secondary button classes, not a real broker login.
  for (const page of [desktop, register]) {
    await page.evaluate(() => {
      const form = document.querySelector('.card-pf');
      const fixture = document.createElement('div');
      fixture.innerHTML = '<button id="secondary-fixture" class="pf-c-button btn-default pf-m-block btn-lg" type="button">Confirmar vínculo de identidade</button>';
      form.append(fixture);
    });
    const secondary = page.locator('#secondary-fixture');
    const style = await secondary.evaluate(el => ({ radius: getComputedStyle(el).borderRadius, height: el.getBoundingClientRect().height }));
    assert.equal(style.radius, '0px'); assert.ok(style.height >= 44);
    await secondary.evaluate(el => { el.disabled = true; });
    assert.equal(await secondary.evaluate(el => getComputedStyle(el).opacity), '0.5');
  }

  console.log(`PASS SIDPB theme login, Google button, error state, registration fields, recovery and mobile layout`);
  console.log('PASS secondary button CSS fixture (not an executed identity-linking flow)');
  assert.deepEqual(tileRequests,[]);
  console.log('PASS shared static background bytes/framing, keyboard registration link and zero pre-login tile requests');
  console.log(`Screenshots: ${screenshots}`);
} finally {
  await browser.close();
}
