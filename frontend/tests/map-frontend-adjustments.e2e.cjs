// Run with the existing external Playwright installation; no new repo dependency.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const { chromium } = require(process.env.SIDPB_PLAYWRIGHT_MODULE || 'playwright');
const frontend = (process.env.MAP_TEST_FRONTEND_URL || 'http://localhost:3000/sidpb').replace(/\/$/, '');

require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { CLUSTER_COUNT_BANDS } = require('../src/modules/map/components/LeafletMap/occurrence-cluster.ts');
const { MAX_ZOOM } = require('../src/modules/map/components/LeafletMap/map-zoom.ts');

const fixture = [
  ...Array.from({ length: 9 }, (_, i) => occurrence(i + 1, -60, -3, 'Doença A')),
  ...Array.from({ length: 10 }, (_, i) => occurrence(i + 20, -35, -8, 'Doença B')),
  ...Array.from({ length: 100 }, (_, i) => occurrence(i + 100, -46.63, -23.55, 'Doença B')),
];
function occurrence(id, longitude, latitude, disease) {
  return { idOcorrencia: id, longitude, latitude, cidade: 'Teste', uf: 'MA',
    doencaNomeCientifico: disease, hospedeiroEspecie: 'Hospedeiro', categoriaHospedeiro: 'Animal',
    parasitoNomeCientifico: 'Parasito', vetorNomeCientifico: 'Vetor', dataOcorrencia: '2025-01-01', fontes: [] };
}

async function load(page) {
  await page.route('**/api/mapa/ocorrencias', route => route.fulfill({ json: fixture }));
  await page.goto(frontend + '/dashboard/');
  await page.locator('.leaflet-marker-icon').first().waitFor();
  await page.addStyleTag({ content: '.tsqd-parent-container { display: none !important; }' });
  // Inspect the existing Leaflet instance without exposing a test API in product code.
  await page.evaluate(() => {
    const element = document.querySelector('.leaflet-container');
    let fiber = element[Object.keys(element).find(key => key.startsWith('__reactFiber$'))];
    while (fiber) {
      for (const candidate of [fiber, fiber.alternate]) {
        for (let state = candidate?.memoizedState; state; state = state.next) {
          const map = state.memoizedState?.map ?? state.memoizedState?.current;
          if (map?.getZoom) { window.testMap = map; return; }
        }
      }
      fiber = fiber.return;
    }
    throw new Error('Leaflet map not found');
  });
}

(async () => {
  const browser = await chromium.launch({ channel: process.env.MAP_TEST_BROWSER_CHANNEL || 'chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 },
      permissions: ['geolocation'], geolocation: { latitude: -14.3, longitude: -52 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await load(page);

    const disease = page.getByRole('button', { name: /^Doenças/ });
    const section = disease.locator('..');
    assert.equal(await disease.getAttribute('aria-expanded'), 'false');
    assert.equal(await section.getByRole('checkbox').count(), 0);
    for (const name of ['Vetores', 'Hospedeiros', 'Estados']) {
      assert.equal(await page.getByRole('button', { name, exact: true }).getAttribute('aria-expanded'), 'false');
    }
    await disease.click();
    const option = section.getByRole('checkbox', { name: /Doença A/ });
    await option.check();
    const waitForOccurrences = count => page.waitForFunction(count => {
      let total = 0;
      window.testMap.eachLayer(layer => { if (layer.options.iconCreateFunction) total = layer.getLayers().length; });
      return total === count;
    }, count);
    await waitForOccurrences(9);
    await disease.click();
    await disease.click();
    assert.equal(await option.isChecked(), true);
    await option.uncheck();
    await waitForOccurrences(fixture.length);
    console.log('PASS Diseases starts closed, expands, preserves selections and still filters occurrences');

    await page.getByRole('button', { name: 'Legenda', exact: true }).click();
    await page.getByText('Agrupamento de ocorrências', { exact: true }).waitFor();
    for (let index = 0; index < CLUSTER_COUNT_BANDS.length; index++) {
      const band = CLUSTER_COUNT_BANDS[index];
      const next = CLUSTER_COUNT_BANDS[index + 1];
      const range = next ? `${band.minCount}–${next.minCount - 1}` : `${band.minCount}+`;
      await page.getByText(`${range} ocorrências`, { exact: true }).waitFor();
    }
    const checks = await page.evaluate(bands => {
      let group;
      window.testMap.eachLayer(layer => { if (layer.options.iconCreateFunction) group = layer; });
      return [2, 9, 10, 49, 50, 99, 100, 101, 1000].map(count => {
        const icon = group.options.iconCreateFunction({ getChildCount: () => count }).createIcon();
        document.body.append(icon);
        const band = bands.findLast(band => count >= band.minCount);
        const sample = document.querySelector(`div[aria-hidden="true"].${band.className}`);
        const result = { count, classMatches: icon.classList.contains(band.className),
          outerMatches: getComputedStyle(icon).backgroundColor === getComputedStyle(sample).backgroundColor,
          innerMatches: getComputedStyle(icon.firstElementChild).backgroundColor === getComputedStyle(sample.firstElementChild).backgroundColor };
        icon.remove();
        return result;
      });
    }, CLUSTER_COUNT_BANDS);
    for (const check of checks) {
      assert.equal(check.classMatches, true, `Threshold agrees for ${check.count}`);
      assert.equal(check.outerMatches, true, `Halo color agrees for ${check.count}`);
      assert.equal(check.innerMatches, true, `Center color agrees for ${check.count}`);
    }
    await page.screenshot({ path: path.join(os.tmpdir(), 'sidpb-map-adjustments-legend.png') });
    console.log('PASS legend labels, actual plugin thresholds and both CSS colors');

    const satellite = page.getByRole('button', { name: 'Modo satélite', exact: true });
    const waitForView = view => page.waitForFunction(view => {
      let hasSatellite = false;
      window.testMap.eachLayer(layer => {
        if (layer._url?.includes('World_Imagery')) hasSatellite = true;
      });
      return hasSatellite === (view === 'satellite');
    }, view);
    await page.evaluate(() => window.testMap.setView([-14.235, -51.925], 4, { animate: false }));
    await page.evaluate(() => {
      window.testOccurrenceMoves = 0;
      window.testOccurrenceMoveListeners = [];
      window.testMap.eachLayer(layer => {
        if (!layer.options.iconCreateFunction) return;
        for (const marker of layer.getLayers()) {
          const listener = () => { window.testOccurrenceMoves++; };
          marker.on('move', listener);
          window.testOccurrenceMoveListeners.push([marker, listener]);
        }
      });
    });
    const zoomListeners = await page.evaluate(() => window.testMap._events.zoomend.length);
    await satellite.click();
    await waitForView('satellite');
    assert.equal(await page.evaluate(() => {
      for (const [marker, listener] of window.testOccurrenceMoveListeners) marker.off('move', listener);
      return window.testOccurrenceMoves;
    }), 0, 'Changing the map view must not reposition or recluster unchanged occurrences');
    await page.evaluate(() => window.testMap.setZoom(4, { animate: false }));
    await waitForView('satellite');
    await page.evaluate(() => window.testMap.setZoom(5, { animate: false }));
    await waitForView('street');
    await page.evaluate(() => window.testMap.setZoom(6, { animate: false }));
    await waitForView('street');
    await page.evaluate(() => window.testMap.setZoom(4, { animate: false }));
    await satellite.click();
    await waitForView('satellite');
    console.log('PASS satellite stays at zoom 4, switches above 4, street stays street, manual toggle still works');

    await page.evaluate(() => {
      window.testFlights = [];
      window.testFrames = [];
      window.testCameraOverrides = [];
      window.testLastMoveEnd = null;
      window.testMap.on('moveend', () => { window.testLastMoveEnd = performance.now(); });
      const flyTo = window.testMap.flyTo;
      window.testMap.flyTo = function(center, zoom, options) {
        let pinExists = false;
        this.eachLayer(layer => { if (layer.options.alt === 'Localização do usuário') pinExists = true; });
        window.testFlights.push({ zoom, beforeZoom: this.getZoom(), animate: options.animate, pinExists });
        return flyTo.call(this, center, zoom, options);
      };
      for (const name of ['setZoom', 'setView', 'fitBounds']) {
        const method = window.testMap[name];
        window.testMap[name] = function(...args) {
          window.testCameraOverrides.push(name);
          return method.apply(this, args);
        };
      }
      window.testMap.on('move', () => {
        const center = window.testMap.getCenter();
        window.testFrames.push({ zoom: window.testMap.getZoom(), lat: center.lat, lng: center.lng });
      });
    });
    let markerId;
    for (const [zoom, latitude, longitude] of [[4, -14.3, -52], [10, -14.301, -52.001], [12, -14.302, -52.002], [MAX_ZOOM, -14.303, -52.003]]) {
      await context.setGeolocation({ latitude, longitude });
      await page.evaluate(zoom => {
        window.testMap.setZoom(zoom, { animate: false });
        window.testFrames = [];
        window.testCameraOverrides = [];
      }, zoom);
      const flightsBefore = await page.evaluate(() => window.testFlights.length);
      await page.getByRole('button', { name: 'Localizar', exact: true }).click();
      await page.waitForFunction(flightsBefore => window.testFlights.length > flightsBefore, flightsBefore);
      // Trigger React renders while Leaflet flies; they must not restore the previous zoom.
      await page.getByRole('button', { name: 'Legenda', exact: true }).click();
      await page.getByRole('button', { name: 'Legenda', exact: true }).click();
      await page.waitForFunction(({ flightsBefore, latitude, longitude, targetZoom }) => {
        const center = window.testMap.getCenter();
        return window.testFlights.length > flightsBefore && window.testMap.getZoom() === targetZoom &&
          Math.abs(center.lat - latitude) < 0.000001 && Math.abs(center.lng - longitude) < 0.000001;
      }, { flightsBefore, latitude, longitude, targetZoom: MAX_ZOOM });
      const result = await page.evaluate(() => {
        const markers = [];
        window.testMap.eachLayer(layer => {
          if (layer.options.alt !== 'Localização do usuário') return;
          const element = layer.getElement();
          markers.push({ id: layer._leaflet_id, title: element.getAttribute('title'),
            tooltip: Boolean(layer.getTooltip()), fill: element.querySelector('path').getAttribute('fill'),
            background: getComputedStyle(element).backgroundColor, animation: getComputedStyle(element).animationName });
        });
        return { flight: window.testFlights.at(-1), zoom: window.testMap.getZoom(),
          frames: window.testFrames, overrides: window.testCameraOverrides, markers };
      });
      assert.deepEqual(result.flight, { beforeZoom: zoom, zoom: MAX_ZOOM, animate: true, pinExists: true });
      assert.equal(result.zoom, MAX_ZOOM);
      await waitForView('street');
      assert.ok(result.frames.length > 2, 'Camera moves over multiple frames');
      if (zoom < MAX_ZOOM) {
        assert.ok(result.frames.some(frame => frame.zoom > zoom + 0.01 && frame.zoom < MAX_ZOOM - 0.01 &&
          (Math.abs(frame.lat - latitude) > 1e-8 || Math.abs(frame.lng - longitude) > 1e-8)),
        'Center and zoom both change during the flight, before reaching the destination');
      }
      assert.deepEqual(result.overrides, [], 'No later setZoom, setView or fitBounds interrupts the flight');
      assert.equal(result.markers.length, 1);
      markerId ??= result.markers[0].id;
      assert.deepEqual(result.markers[0], { id: markerId, title: null, tooltip: false, fill: '#ea4335',
        background: 'rgba(0, 0, 0, 0)', animation: 'none' });
      const pin = page.locator('svg[aria-label="Localização do usuário"]');
      await pin.hover({ force: true });
      assert.equal(await page.locator('.leaflet-tooltip').count(), 0);
      await page.getByRole('button', { name: 'Modo satélite', exact: true }).click();
      await page.getByRole('button', { name: 'Modo satélite', exact: true }).click();
      await page.waitForTimeout(300);
      assert.equal(await page.evaluate(() => window.testMap.getZoom()), MAX_ZOOM, 'Zoom remains at maximum after further renders');
    }
    await page.screenshot({ path: path.join(os.tmpdir(), 'sidpb-user-location-red-pin.png') });
    console.log('PASS continuous center/zoom animation to MAX_ZOOM from 4, 10 and 12, stable after React renders; unique red pin without hover/tooltip');

    // Retry near expiry with a delayed geolocation response: cancellation happens at click time.
    await page.waitForFunction(() => performance.now() - window.testLastMoveEnd >= 4000);
    await page.evaluate(() => {
      const geolocation = navigator.geolocation;
      const getPosition = geolocation.getCurrentPosition.bind(geolocation);
      geolocation.getCurrentPosition = (success, error, options) => {
        getPosition(position => setTimeout(() => success(position), 1600), error, options);
      };
    });
    await context.setGeolocation({ latitude: -14.304, longitude: -52.004 });
    const flightsBeforeRetry = await page.evaluate(() => window.testFlights.length);
    await page.getByRole('button', { name: 'Localizar', exact: true }).click();
    await page.waitForTimeout(1200);
    assert.equal(await page.locator('svg[aria-label="Localização do usuário"]').count(), 1,
      'The old timeout is cancelled while the new geolocation is still pending');
    await page.waitForFunction(before => window.testFlights.length > before, flightsBeforeRetry);
    await page.waitForFunction(() => window.testMap.getCenter().distanceTo([-14.304, -52.004]) < 0.01);
    const retry = await page.evaluate(() => {
      const markers = [];
      window.testMap.eachLayer(layer => { if (layer.options.alt === 'Localização do usuário') markers.push(layer._leaflet_id); });
      return markers;
    });
    assert.deepEqual(retry, [markerId], 'The retry reuses the same marker');
    await page.waitForFunction(() => performance.now() - window.testLastMoveEnd >= 4500);
    const pin = page.locator('svg[aria-label="Localização do usuário"]');
    assert.equal(await pin.count(), 1);
    assert.equal(await pin.evaluate(element => getComputedStyle(element).opacity), '1');
    assert.equal(await pin.evaluate(element => getComputedStyle(element).transitionDuration), '0.3s');
    await page.waitForFunction(() => {
      const pin = document.querySelector('svg[aria-label="Localização do usuário"]');
      const opacity = pin ? Number(getComputedStyle(pin).opacity) : -1;
      if (opacity > 0 && opacity < 1) {
        window.testFadeStartedAfter = performance.now() - window.testLastMoveEnd;
        return true;
      }
      return false;
    }, null, { polling: 'raf' });
    assert.ok(await page.evaluate(() => window.testFadeStartedAfter >= 4950), 'Fade begins only after approximately 5s');
    await pin.waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => window.testMap._events.zoomend.length), zoomListeners,
      'Zoom listeners remain stable after repeated flights and view toggles');
    console.log('PASS delayed retry cancels the previous timer at click, reuses the pin, waits 5s after flight, and fades for 300ms');

    await page.evaluate(() => localStorage.setItem('sidpb-auth-user', JSON.stringify({
      id: 1, name: 'Curador', email: 'curador@example.com', role: 'CURATOR',
    })));
    await page.route('**/api/curation/submissions?**', route => route.fulfill({ json: { items: [], page: 0, size: 10, totalElements: 0, totalPages: 0 } }));
    await page.reload();
    await page.getByRole('button', { name: 'Menu do usuário', exact: true }).click();
    const action = page.getByRole('menuitem', { name: 'Revisão de artigos', exact: true });
    assert.equal(await page.getByRole('menuitem', { name: 'Curadoria', exact: true }).count(), 0);
    assert.equal(await action.getAttribute('href'), new URL(frontend).pathname + '/curador/');
    await action.click();
    await page.waitForURL(frontend + '/curador/');
    await page.getByRole('heading', { name: 'Revisão de artigos', exact: true, level: 1 }).waitFor();
    await page.getByRole('heading', { name: 'Fila de artigos', exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS CURATOR label, unchanged route and existing article queue');
    await context.close();

    const denied = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const deniedPage = await denied.newPage();
    await load(deniedPage);
    // Let the initial MapMover animation finish before recording the error baseline.
    await deniedPage.waitForTimeout(2000);
    const cdp = await denied.newCDPSession(deniedPage);
    await cdp.send('Browser.setPermission', { permission: { name: 'geolocation' }, setting: 'denied', origin: new URL(frontend).origin });
    const before = await deniedPage.evaluate(() => {
      window.testMap.stop();
      window.testMap.setView([-14.235, -51.925], 6, { animate: false });
      return { zoom: window.testMap.getZoom(), center: window.testMap.getCenter() };
    });
    await deniedPage.getByRole('button', { name: 'Localizar', exact: true }).click();
    await deniedPage.getByRole('alert').filter({ hasText: 'Permissão de localização negada' }).waitFor();
    assert.deepEqual(await deniedPage.evaluate(() => ({ zoom: window.testMap.getZoom(), center: window.testMap.getCenter() })), before);
    assert.equal(await deniedPage.getByRole('button', { name: 'Localizar', exact: true }).isEnabled(), true);
    console.log('PASS denied geolocation keeps the camera and restores the Locate button');
    await denied.close();
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
