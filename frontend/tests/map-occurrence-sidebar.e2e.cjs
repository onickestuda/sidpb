// Browser regression using the existing external Playwright installation.
// SIDPB_PLAYWRIGHT_MODULE can point to an external module; no repo dependency required.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.SIDPB_PLAYWRIGHT_MODULE || 'playwright');
const frontend = (process.env.MAP_TEST_FRONTEND_URL || 'http://localhost:3000/sidpb').replace(/\/$/, '');

function occurrence(id, longitude, latitude, city, countIndex = 0) {
  return {
    idOcorrencia: id, cidade: city, uf: 'MA', longitude, latitude,
    doencaNomeCientifico: 'Doenca de teste', hospedeiroEspecie: 'Canis familiaris',
    categoriaHospedeiro: 'Animal', parasitoNomeCientifico: 'Parasito de teste',
    vetorNomeCientifico: 'Vetor de teste', dataOcorrencia: `${2000 + countIndex}-06-15`,
    desfecho: 'Recuperado', fontes: countIndex === 0 ? [
      { idFonte: 1, titulo: 'Artigo de teste', autores: ['Autor A'], nomeFonte: 'Revista',
        tipoFonte: 'artigo', data: '2025-01-01', url: 'https://example.com/artigo' },
      { idFonte: 2, titulo: 'Fonte sem link valido', autores: [], data: null, url: 'javascript:alert(1)' },
    ] : [],
  };
}

const fixture = [
  ...Array.from({ length: 11 }, (_, i) => occurrence(100 + i, -46.63, -23.55, 'Sao Paulo', i)),
  ...Array.from({ length: 10 }, (_, i) => occurrence(200 + i, -60, -3, 'Manaus', i)),
  occurrence(300, -35, -8, 'Recife'),
  ...Array.from({ length: 37 }, (_, i) => occurrence(400 + i, -44 + (i % 6) * 0.005, -2 + Math.floor(i / 6) * 0.005, 'Sao Luis', i)),
  ...Array.from({ length: 60 }, (_, i) => occurrence(500 + i, -51 + (i % 8) * 0.12, -14 + Math.floor(i / 8) * 0.12, 'Grupo grande', i)),
];

async function waitUntil(fn, message) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (await fn()) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(message);
}

(async () => {
  const browser = await chromium.launch({ channel: process.env.MAP_TEST_BROWSER_CHANNEL || 'chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let dataset = fixture;
    await page.route('**/api/mapa/ocorrencias', route => route.fulfill({ json: dataset }));
    const panel = page.getByRole('complementary', { name: 'Ocorr\u00eancias selecionadas' });
    const cluster = count => page.locator('.marker-cluster').filter({ has: page.locator('span', { hasText: new RegExp(`^${count}$`) }) });
    const cards = () => panel.locator('article[data-occurrence-id]');
    const close = () => panel.getByRole('button', { name: 'Fechar painel de ocorr\u00eancias' }).click();
    const next = () => panel.getByRole('button', { name: 'Pr\u00f3xima p\u00e1gina' });
    const previous = () => panel.getByRole('button', { name: 'P\u00e1gina anterior' });
    const scroll = () => panel.locator('[data-occurrence-scroll]');

    await page.goto(frontend + '/dashboard/');
    // Development-only Query Devtools can cover the pagination's bottom-right button.
    await page.addStyleTag({ content: '.tsqd-parent-container { display: none !important; }' });
    await cluster(11).waitFor();
    assert.equal(await panel.count(), 0, 'Public map starts with sidebar closed');
    const fullMapWidth = await page.locator('.leaflet-container').evaluate(el => el.clientWidth);
    await cluster(11).click();
    await panel.getByText('P\u00e1gina 1 de 2', { exact: true }).waitFor();
    assert.equal(await cards().count(), 10);
    assert.equal(await previous().isDisabled(), true);
    assert.equal(await next().isDisabled(), false);
    assert.equal(await cards().first().getAttribute('data-occurrence-id'), '110', 'Newest first');
    assert.equal(await cards().first().getByRole('link', { name: /Abrir fonte/ }).count(), 0, 'No source action without URL');
    await waitUntil(async () => await page.locator('.leaflet-container').evaluate(el => el.clientWidth) < fullMapWidth - 300, 'Map shrinks for sidebar');
    await scroll().evaluate(el => { el.scrollTop = el.scrollHeight; });
    await next().click();
    await panel.getByText('P\u00e1gina 2 de 2', { exact: true }).waitFor();
    assert.equal(await cards().count(), 1);
    assert.equal(await next().isDisabled(), true);
    assert.equal(await previous().isDisabled(), false);
    assert.equal(await scroll().evaluate(el => el.scrollTop), 0, 'Page change resets scroll');
    const source = cards().first().getByRole('link', { name: /Abrir fonte/ });
    assert.equal(await source.count(), 1, 'Invalid URL omitted');
    assert.equal(await source.getAttribute('href'), 'https://example.com/artigo');
    assert.equal(await source.getAttribute('target'), '_blank');
    await cards().first().getByRole('button', { name: 'Selecionar ocorr\u00eancia 100' }).click();
    assert.equal(await cards().first().getByRole('button', { name: 'Selecionar ocorr\u00eancia 100' }).getAttribute('aria-pressed'), 'true');
    await page.locator('.leaflet-overlay-pane path').waitFor();
    await cards().first().getByRole('button', { name: 'Ver detalhes', exact: true }).click();
    await panel.getByText('Ocorr\u00eancia #100', { exact: true }).waitFor();
    await panel.getByText('Recuperado', { exact: true }).waitFor();
    await panel.getByText('Artigo de teste', { exact: true }).waitFor();
    await panel.getByRole('combobox').selectOption('oldest');
    await panel.getByText('P\u00e1gina 1 de 2', { exact: true }).waitFor();
    assert.equal(await cards().first().getAttribute('data-occurrence-id'), '100');
    assert.equal(await scroll().evaluate(el => el.scrollTop), 0);
    assert.equal(await panel.getByText('Ocorr\u00eancia #100', { exact: true }).count(), 0, 'Sorting collapses details');
    await next().click();
    await cluster(10).click();
    await panel.getByRole('heading', { name: '10 ocorr\u00eancias', exact: true }).waitFor();
    assert.equal(await cards().count(), 10, 'Exactly ten items');
    assert.equal(await panel.getByRole('navigation', { name: 'Pagina\u00e7\u00e3o de ocorr\u00eancias' }).count(), 0);
    assert.equal(await scroll().evaluate(el => el.scrollTop), 0, 'New selection resets scroll');
    await close();
    await waitUntil(async () => await page.locator('.leaflet-container').evaluate(el => el.clientWidth) === fullMapWidth, 'Closing restores map width');
    assert.equal(await panel.count(), 0);
    assert.equal(await page.locator('.leaflet-overlay-pane path').count(), 0, 'Closing clears map highlight');
    console.log('PASS 10/11 items, source URLs, details, selection, sorting, scroll and close');

    await cluster(37).click();
    await panel.getByText('P\u00e1gina 1 de 4', { exact: true }).waitFor();
    assert.equal(await cards().count(), 10, 'Small dispersed cluster opens at initial zoom');
    await next().click();
    await panel.getByText('P\u00e1gina 2 de 4', { exact: true }).waitFor();
    await cluster(11).click();
    await panel.getByText('P\u00e1gina 1 de 2', { exact: true }).waitFor();
    assert.equal(await cards().first().getAttribute('data-occurrence-id'), '110', 'New selection restores first page');
    await close();
    console.log('PASS eligible dispersed cluster, new selection reset and individual marker');

    // Individual marker selection, field visibility and explicit closing.
    await page.locator('.leaflet-marker-icon:not(.marker-cluster)').first().click();
    await panel.getByRole('heading', { name: '1 ocorr\u00eancia', exact: true }).waitFor();
    assert.equal(await cards().count(), 1);
    assert.equal(await cards().first().getByRole('button', { name: /Selecionar/ }).getAttribute('aria-pressed'), 'true');
    await page.locator('.leaflet-container').click({ position: { x: 15, y: 15 } });
    assert.equal(await panel.count(), 1, 'Empty map click preserves selection');
    await close();

    // Fullscreen contains the tools, map, legend and contextual panel.
    await page.getByRole('button', { name: 'Tela cheia', exact: true }).click();
    await waitUntil(() => page.evaluate(() => document.fullscreenElement?.hasAttribute('data-dashboard-map-layout')), 'Dashboard fullscreen entered');
    await cluster(11).click();
    await panel.waitFor();
    assert.equal(await panel.evaluate(el => document.fullscreenElement.contains(el)), true);
    await page.getByRole('button', { name: 'Modo sat\u00e9lite', exact: true }).click();
    await page.locator('img.leaflet-tile[src*="World_Imagery"]').first().waitFor({ state: 'attached' });
    await page.getByRole('button', { name: 'Legenda', exact: true }).click();
    await page.getByRole('heading', { name: 'Legenda', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Tela cheia', exact: true }).click();
    await waitUntil(() => page.evaluate(() => !document.fullscreenElement), 'Fullscreen exited');
    await close();
    await page.getByRole('button', { name: 'Modo sat\u00e9lite', exact: true }).click();
    console.log('PASS fullscreen, satellite and legend');

    await cluster(60).click();
    assert.equal(await panel.count(), 0, 'Large cluster does not open sidebar');
    await waitUntil(async () => await cluster(60).count() === 0, 'Large cluster zooms and splits');
    await page.getByRole('button', { name: 'Redefinir mapa', exact: true }).click();
    await cluster(11).waitFor();
    await cluster(11).click();
    await panel.waitFor();
    // Existing disease filter must remove selected occurrences as well as markers.
    await page.getByPlaceholder('Pesquise por doen\u00e7a, parasito, hospedeiro...').fill('no-matching-occurrence');
    await page.getByRole('button', { name: 'Pesquisar', exact: true }).click();
    await waitUntil(async () => await panel.count() === 0, 'Filters reconcile selected group');
    assert.deepEqual(errors, [], 'No browser runtime errors');
    console.log('PASS contextual sidebar: public map, markers, 10/11/37 items, navigation, selection reset, scroll, sources, details, highlight, explicit close, layout, fullscreen, satellite, legend, cluster zoom, filters');

    // Above the threshold, co-located items cannot be separated by zoom.
    dataset = Array.from({ length: 60 }, (_, i) => ({
      ...occurrence(700 + i, -51, -14, 'Same point', i),
      vetorNomeCientifico: null, hospedeiroEspecie: null,
      dataOcorrencia: i === 59 ? null : `${2000 + i}-06-15`,
    }));
    await page.goto(frontend + '/dashboard/');
    await page.addStyleTag({ content: '.tsqd-parent-container { display: none !important; }' });
    await cluster(60).waitFor();
    assert.equal(await panel.count(), 0);
    await cluster(60).click();
    await panel.getByText('P\u00e1gina 1 de 6', { exact: true }).waitFor();
    assert.equal(await cards().count(), 10);
    assert.equal(await cards().getByText('Vetor:', { exact: true }).count(), 0);
    assert.equal(await cards().getByText('Hospedeiro:', { exact: true }).count(), 0);
    assert.equal(await cards().getByText('Parasito:', { exact: true }).count(), 10);
    await close();
    const zoomIn = page.locator('button').filter({ has: page.locator('svg.lucide-plus') });
    for (let zoom = 4; zoom < 11; zoom++) {
      await zoomIn.click();
      await page.waitForTimeout(300);
    }
    // Co-located markers overlap, so click the topmost marker as a user would.
    await page.locator('.leaflet-marker-icon:not(.marker-cluster)').last().click();
    await panel.getByText('P\u00e1gina 1 de 6', { exact: true }).waitFor();
    const zoomUrls = () => page.locator('img.leaflet-tile[src*="openstreetmap"]').evaluateAll(images =>
      images.map(image => image.src.match(/\/(\d+)\/\d+\/\d+\.png/)?.[1]).filter(Boolean));
    const zoomBefore = await zoomUrls();
    await cards().first().getByRole('button', { name: /Selecionar/ }).click();
    assert.deepEqual(await zoomUrls(), zoomBefore, 'Card selection preserves zoom');
    await page.getByRole('button', { name: 'Vetores', exact: true }).click();
    const parasiteFilter = page.getByRole('checkbox', { name: /Parasito de teste/ });
    await parasiteFilter.check();
    await panel.getByRole('heading', { name: '60 ocorr\u00eancias', exact: true }).waitFor();
    assert.equal(await parasiteFilter.isChecked(), true, 'Parasite remains available in existing vector filter');
    assert.equal(await cards().count(), 10);
    await close();
    assert.deepEqual(errors, []);
    console.log('PASS 60 co-located occurrences, missing fields, maximum zoom and card selection without zoom changes');
    await context.close();
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
