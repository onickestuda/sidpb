const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

// Use the existing Node test runner and installed TypeScript, without new dependencies.
const compile = (filename) => ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true,
  },
  fileName: filename,
}).outputText;

for (const extension of ['.ts', '.tsx']) {
  require.extensions[extension] = (module, filename) => module._compile(compile(filename), filename);
}

function loadComponent(relativePath, overrides = {}) {
  const filename = path.resolve(__dirname, '../src', relativePath);
  const loadedModule = new Module(filename, module);
  loadedModule.filename = filename;
  loadedModule.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = loadedModule.require.bind(loadedModule);
  loadedModule.require = (request) => {
    if (Object.hasOwn(overrides, request)) return overrides[request];
    if (request.startsWith('@/')) return originalRequire(path.resolve(__dirname, '../src', request.slice(2)));
    return originalRequire(request);
  };
  loadedModule._compile(compile(filename), filename);
  return loadedModule.exports;
}

const storage = new Map();
global.window = { localStorage: {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
} };

const { useFiltersStore } = require('../src/modules/filters/store/filtersStore.ts');
const { useMapStore } = require('../src/modules/map/store/mapStore.ts');
const { MIN_ZOOM, MAX_ZOOM } = require('../src/modules/map/components/LeafletMap/map-zoom.ts');
const { CLUSTER_COUNT_BANDS } = require('../src/modules/map/components/LeafletMap/occurrence-cluster.ts');
const { LeftSidebarFilters } = loadComponent('modules/dashboard/components/DashboardLeftSidebar/LeftSidebarFilters.tsx', {
  // Server rendering normally reads the initial snapshot; render the current store for each assertion.
  '@/modules/filters/store/filtersStore': { useFiltersStore: (selector) => selector(useFiltersStore.getState()) },
});

const options = {
  diseases: [{ label: 'Doença A', count: 4 }, { label: 'Doença B', count: 2 }],
  vectors: [{ label: 'Vetor A', count: 3 }],
  hosts: [{ label: 'Hospedeiro A', count: 1 }],
  states: [{ label: 'MA', count: 2 }, { label: 'PA', count: 1 }, { label: 'PI', count: 1 }],
};
const renderFilters = () => renderToStaticMarkup(React.createElement(LeftSidebarFilters, { options }));
const activeBadges = () => [...renderFilters().matchAll(/aria-label="(\d+) filtros ativos"/g)].map((match) => Number(match[1]));

test('all filter sections start collapsed, including Diseases with existing selections', () => {
  useFiltersStore.getState().setSelectedDiseases(['Doença A']);
  const html = renderFilters();
  assert.equal([...html.matchAll(/aria-expanded="false"/g)].length, 5, 'Curadoria, Doenças, Agentes, Hospedeiros, Estados');
  assert.doesNotMatch(html, /type="checkbox"/);
  assert.deepEqual(useFiltersStore.getState().selectedDiseases, ['Doença A']);
  assert.deepEqual(activeBadges(), [1]);
  useFiltersStore.getState().clearFilters();
});

test('legend bands agree with the installed markercluster icon factory at every boundary', () => {
  // Exercise the plugin's actual default function without requiring a browser in Node.
  const filename = require.resolve('leaflet.markercluster');
  const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true);
  let factory;
  function visit(node) {
    if (ts.isPropertyAssignment(node) && node.name.getText(source) === '_defaultIconCreateFunction') {
      factory = node.initializer.getText(source);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(factory, 'The installed plugin exposes its default icon factory');
  const createIcon = vm.runInNewContext(`(${factory})`, { L: {
    DivIcon: class { constructor(options) { this.options = options; } },
    Point: class {},
  } });
  for (let index = 0; index < CLUSTER_COUNT_BANDS.length; index++) {
    const band = CLUSTER_COUNT_BANDS[index];
    const next = CLUSTER_COUNT_BANDS[index + 1];
    for (const count of [band.minCount, next ? next.minCount - 1 : band.minCount * 10]) {
      const icon = createIcon({ getChildCount: () => count });
      assert.ok(icon.options.className.split(' ').includes(band.className), `Band agrees for ${count} occurrences`);
    }
  }
});

test('filter badges reflect each category immediately, disappear at zero, and clear with existing filters', () => {
  const filters = useFiltersStore.getState();
  filters.clearFilters();
  assert.deepEqual(activeBadges(), []);
  filters.toggleDisease('Doença A');
  filters.toggleDisease('Doença B');
  assert.deepEqual(activeBadges(), [2]);
  assert.match(renderFilters(), /Doenças<\/span><span[^>]*><span aria-label="2 filtros ativos"/);
  filters.toggleVector('Vetor A');
  assert.deepEqual(activeBadges(), [2, 1]);
  assert.match(renderFilters(), /Agentes etiológicos<\/span><span[^>]*><span aria-label="1 filtros ativos"/);
  filters.toggleHost('Hospedeiro A');
  for (const state of ['MA', 'PA', 'PI']) filters.toggleState(state);
  assert.deepEqual(activeBadges(), [2, 1, 1, 3]);
  filters.toggleDisease('Doença A');
  filters.toggleVector('Vetor A');
  assert.deepEqual(activeBadges(), [1, 1, 3]);
  filters.clearFilters();
  assert.deepEqual(activeBadges(), []);
});

function createMap(zoom = MIN_ZOOM) {
  const map = new EventEmitter();
  map.layers = new Set();
  map.locateCalls = [];
  map.flights = [];
  map.setMinZoom = (value) => { map.minZoom = value; };
  map.setMaxZoom = (value) => { map.maxZoom = value; };
  map.getZoom = () => zoom;
  map.setZoom = (nextZoom) => { zoom = nextZoom; map.emit('zoomend', { target: map }); };
  map.hasLayer = (layer) => map.layers.has(layer);
  map.fire = (name, event) => { map.emit(name, event); return map; };
  map.locate = (settings) => { map.locateCalls.push(settings); };
  map.stopLocate = () => { map.stopped = true; };
  map.flyTo = (latlng, targetZoom, settings) => {
    map.flights.push({ latlng, zoom: targetZoom, settings, markerPosition: [...map.layers][0]?.latlng });
    map.emit('movestart');
  };
  useMapStore.setState({ map: null, mapView: 'street', currentZoom: zoom, isLocating: false, locationError: null });
  useMapStore.getState().registerMap(map);
  return map;
}

function mountUserMarker(map) {
  const markers = [];
  const circles = [];
  const cleanups = [];
  const layer = (kind, latlng, settings) => ({
    kind, latlng, settings, radius: settings?.radius,
    setLatLng(next) { this.latlng = next; return this; },
    setRadius(next) { this.radius = next; return this; },
    addTo(target) { target.layers.add(this); return this; },
    remove() { map.layers.delete(this); },
  });
  const leaflet = {
    icon: (settings) => settings,
    marker: (latlng, settings) => { const marker = layer('marker', latlng, settings); markers.push(marker); return marker; },
    circle: (latlng, settings) => { const circle = layer('circle', latlng, settings); circles.push(circle); return circle; },
  };
  const { UserLocationMarker } = loadComponent('modules/map/components/LeafletMap/UserLocationMarker.tsx', {
    leaflet,
    react: { useRef: () => ({ current: null }), useEffect: (effect) => cleanups.push(effect()) },
    'react-leaflet': { useMap: () => map },
    '@/lib/publicConfig': { basePath: '/sidpb' },
  });
  UserLocationMarker();
  return { markers, circles, unmount: () => cleanups.forEach((cleanup) => cleanup()) };
}

test('location places one violet pin with accuracy circle before flying to MAX_ZOOM, and reuses it', () => {
  for (const zoom of [4, 10, 12, MAX_ZOOM]) {
    const map = createMap(zoom);
    const { markers, circles, unmount } = mountUserMarker(map);
    const occurrences = useMapStore.getState().selectedOccurrences;
    for (const [latlng, accuracy] of [[{ lat: -2, lng: -44 }, 30], [{ lat: -3, lng: -45 }, 12], [{ lat: -4, lng: -46 }, undefined]]) {
      useMapStore.getState().locateUser();
      assert.equal(useMapStore.getState().isLocating, true);
      assert.deepEqual(map.locateCalls.at(-1), { setView: false, timeout: 10000 });
      map.emit('locationfound', { latlng, accuracy });
      assert.equal(markers.length, 1);
      assert.equal(circles.length, 1);
      assert.equal(map.layers.size, 2, 'pin + accuracy circle');
      assert.equal(markers[0].latlng, latlng);
      assert.equal(circles[0].latlng, latlng);
      assert.equal(circles[0].radius ?? 0, accuracy ?? 0);
      assert.equal(markers[0].settings.alt, 'Sua localização');
      assert.equal(markers[0].settings.interactive, false);
      assert.equal(markers[0].settings.keyboard, false);
      assert.match(markers[0].settings.icon.iconUrl, /^\/sidpb\/map\/location-marker\/marker-icon-violet\.png$/);
      assert.match(markers[0].settings.icon.iconRetinaUrl, /marker-icon-2x-violet\.png$/);
      assert.deepEqual(markers[0].settings.icon.iconSize, [25, 41]);
      assert.deepEqual(map.flights.at(-1), {
        latlng, zoom: MAX_ZOOM, settings: { animate: true, duration: 1.5 }, markerPosition: latlng,
      });
      assert.equal(useMapStore.getState().isLocating, false);
      assert.equal(map.listenerCount('locationerror'), 0, 'request listeners are detached after success');
      assert.equal(map.listenerCount('locationfound'), 1, 'only the marker listener remains');
      assert.equal(useMapStore.getState().selectedOccurrences, occurrences);
    }
    unmount();
    assert.equal(map.layers.size, 0);
    assert.equal(map.listenerCount('locationfound'), 0);
  }
});

test('the position stays on the map: camera moves and time never remove it', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const map = createMap();
  const { unmount } = mountUserMarker(map);
  useMapStore.getState().locateUser();
  map.emit('locationfound', { latlng: { lat: -2, lng: -44 }, accuracy: 20 });
  map.emit('moveend');
  map.emit('movestart');
  map.emit('moveend');
  t.mock.timers.tick(60 * 60 * 1000);
  assert.equal(map.layers.size, 2);
  unmount();
});

test('pending requests are deduplicated; errors restore the button and keep the last position', () => {
  for (const [code, message] of [[1, /Permissão/], [2, /Não foi possível/], [3, /esgotou/], [0, /navegador/]]) {
    const map = createMap();
    const { markers, unmount } = mountUserMarker(map);
    useMapStore.getState().locateUser();
    useMapStore.getState().locateUser();
    assert.equal(map.locateCalls.length, 1);
    map.emit('locationerror', { code });
    assert.equal(useMapStore.getState().isLocating, false);
    assert.match(useMapStore.getState().locationError, message);
    assert.equal(map.flights.length, 0);
    assert.equal(markers.length, 0);
    assert.equal(map.listenerCount('locationerror'), 0);
    useMapStore.getState().locateUser();
    assert.equal(useMapStore.getState().locationError, null);
    map.emit('locationfound', { latlng: { lat: -2, lng: -44 } });
    assert.equal(markers.length, 1);
    assert.equal(map.flights.length, 1);
    // A later failed attempt preserves the previously obtained position and camera.
    useMapStore.getState().locateUser();
    map.emit('locationerror', { code });
    assert.equal(map.layers.size, 2);
    assert.equal(map.flights.length, 1);
    unmount();
  }
});

test('missing maps, synchronous geolocation failures, and unmount during a request stay safe', () => {
  useMapStore.setState({ map: null, isLocating: false });
  assert.doesNotThrow(() => useMapStore.getState().locateUser());
  const map = createMap();
  map.locate = () => { throw new Error('Unsupported'); };
  assert.doesNotThrow(() => useMapStore.getState().locateUser());
  assert.equal(useMapStore.getState().isLocating, false);
  assert.match(useMapStore.getState().locationError, /navegador/);
  assert.equal(map.listenerCount('locationfound'), 0);
  map.locate = () => {};
  useMapStore.getState().locateUser();
  map.emit('unload');
  assert.equal(map.stopped, true);
  assert.equal(useMapStore.getState().map, null);
  assert.equal(useMapStore.getState().isLocating, false);
  map.emit('locationfound', { latlng: { lat: 0, lng: 0 } });
  assert.equal(map.flights.length, 0);
  assert.equal(map.listenerCount('locationerror'), 0);
});

test('unmount and map destruction remove the pin, the circle and every listener', () => {
  for (const stage of ['request', 'found']) {
    for (const destroy of [false, true]) {
      const map = createMap();
      const { unmount } = mountUserMarker(map);
      useMapStore.getState().locateUser();
      if (stage === 'found') map.emit('locationfound', { latlng: { lat: -2, lng: -44 }, accuracy: 10 });
      if (destroy) map.emit('unload');
      unmount();
      if (!destroy) map.emit('unload');
      assert.equal(map.layers.size, 0);
      assert.deepEqual(map.eventNames(), [], `${stage}: all map listeners removed`);
    }
  }
});

test('zoom tracking never switches the base layer on its own', () => {
  const map = createMap();
  const cleanups = [];
  const { MapZoomTracker } = loadComponent('modules/map/components/LeafletMap/MapZoomTracker.tsx', {
    'react-leaflet': { useMapEvents: (handlers) => {
      for (const [event, handler] of Object.entries(handlers)) map.on(event, handler);
      cleanups.push(() => {
        for (const [event, handler] of Object.entries(handlers)) map.off(event, handler);
      });
    } },
  });
  MapZoomTracker({ onZoomChange: useMapStore.getState().setCurrentZoom });
  assert.equal(map.listenerCount('zoomend'), 1);
  useMapStore.getState().toggleMapView();
  for (const zoom of [4, 5, 12, MAX_ZOOM, 4]) {
    map.setZoom(zoom);
    assert.equal(useMapStore.getState().currentZoom, zoom);
    assert.equal(useMapStore.getState().mapView, 'satellite', 'satellite stays until the user turns it off');
  }
  useMapStore.getState().toggleMapView();
  assert.equal(useMapStore.getState().mapView, 'street');
  cleanups.forEach((cleanup) => cleanup());
  assert.equal(map.listenerCount('zoomend'), 0);
});
