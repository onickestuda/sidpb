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
  assert.equal([...html.matchAll(/aria-expanded="false"/g)].length, 4);
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
  const cleanups = [];
  const leaflet = {
    divIcon: (settings) => settings,
    marker: (latlng, settings) => {
      const classes = new Set();
      const element = { classList: {
        add: (name) => classes.add(name), remove: (name) => classes.delete(name), contains: (name) => classes.has(name),
      } };
      const marker = {
        latlng, settings,
        getElement: () => element,
        setLatLng(next) { this.latlng = next; return this; },
        bindTooltip(text) { this.tooltip = text; return this; },
        addTo(target) { target.layers.add(this); return this; },
        remove() { map.layers.delete(this); },
      };
      markers.push(marker);
      return marker;
    },
  };
  const { UserLocationMarker } = loadComponent('modules/map/components/LeafletMap/UserLocationMarker.tsx', {
    leaflet,
    react: { useRef: () => ({ current: null }), useEffect: (effect) => cleanups.push(effect()) },
    'react-leaflet': { useMap: () => map },
    './UserLocationMarker.module.css': { marker: 'user-marker', pin: 'user-pin', fading: 'user-fading' },
  });
  UserLocationMarker();
  return { markers, unmount: () => cleanups.forEach((cleanup) => cleanup()) };
}

test('location creates one independent red pin before flyTo, reuses it, and flies to MAX_ZOOM', () => {
  for (const zoom of [4, 10, 12, MAX_ZOOM]) {
    const map = createMap(zoom);
    const { markers, unmount } = mountUserMarker(map);
    const occurrences = useMapStore.getState().selectedOccurrences;
    for (const latlng of [{ lat: -2, lng: -44 }, { lat: -3, lng: -45 }, { lat: -4, lng: -46 }]) {
      useMapStore.getState().locateUser();
      assert.equal(useMapStore.getState().isLocating, true);
      assert.deepEqual(map.locateCalls.at(-1), { setView: false, timeout: 10000 });
      map.emit('locationfound', { latlng });
      assert.equal(markers.length, 1);
      assert.equal(map.layers.size, 1);
      assert.equal(markers[0].latlng, latlng);
      assert.equal(markers[0].tooltip, undefined);
      assert.equal(markers[0].settings.title, undefined);
      assert.equal(markers[0].settings.alt, 'Localização do usuário');
      assert.equal(markers[0].settings.interactive, false);
      assert.equal(markers[0].settings.keyboard, false);
      assert.match(markers[0].settings.icon.html, /<svg/);
      assert.match(markers[0].settings.icon.html, /fill="#ea4335"/);
      assert.deepEqual(markers[0].settings.icon.iconSize, [24, 32]);
      assert.deepEqual(map.flights.at(-1), {
        latlng, zoom: MAX_ZOOM, settings: { animate: true, duration: 1.5 }, markerPosition: latlng,
      });
      assert.equal(useMapStore.getState().isLocating, false);
      assert.equal(map.listenerCount('locationerror'), 1, 'Only the local marker listener remains');
      assert.equal(map.listenerCount('unload'), 1, 'Only the local marker listener remains');
      assert.equal(useMapStore.getState().selectedOccurrences, occurrences);
    }
    unmount();
    assert.equal(map.layers.size, 0);
    assert.equal(map.listenerCount('locationfound'), 0);
  }
});

test('pending requests are deduplicated; errors restore the button and allow a successful retry', () => {
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
    assert.equal(map.listenerCount('locationerror'), 1);
    useMapStore.getState().locateUser();
    assert.equal(useMapStore.getState().locationError, null);
    map.emit('locationfound', { latlng: { lat: -2, lng: -44 } });
    assert.equal(markers.length, 1);
    assert.equal(map.flights.length, 1);
    // A later failed attempt preserves the previously obtained marker and camera.
    useMapStore.getState().locateUser();
    map.emit('locationerror', { code });
    assert.equal(markers.length, 1);
    assert.equal(map.layers.size, 1);
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

test('the pin stays visible throughout the flight, waits 5s after moveend, and fades before removal', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const map = createMap();
  const { markers, unmount } = mountUserMarker(map);
  useMapStore.getState().locateUser();
  map.emit('locationfound', { latlng: { lat: -2, lng: -44 } });
  t.mock.timers.tick(10000);
  assert.equal(map.layers.size, 1, 'No expiry timer runs during the flight');
  assert.equal(map.listenerCount('moveend'), 1);
  map.emit('moveend');
  assert.equal(map.listenerCount('moveend'), 0);
  t.mock.timers.tick(4999);
  assert.equal(markers[0].getElement().classList.contains('user-fading'), false);
  map.emit('moveend'); // Unrelated camera events must not reset or duplicate the timer.
  t.mock.timers.tick(1);
  assert.equal(markers[0].getElement().classList.contains('user-fading'), true);
  assert.equal(map.layers.size, 1, 'The pin remains attached during its fade');
  t.mock.timers.tick(299);
  assert.equal(map.layers.size, 1);
  t.mock.timers.tick(1);
  assert.equal(map.layers.size, 0);
  useMapStore.getState().locateUser();
  map.emit('locationfound', { latlng: { lat: -3, lng: -45 } });
  assert.equal(markers.length, 1, 'The same marker can reappear even after removal');
  assert.equal(markers[0].getElement().classList.contains('user-fading'), false);
  unmount();
});

test('a repeated click cancels expiry immediately, reuses the pin, and waits for the new flight', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const map = createMap();
  const { markers, unmount } = mountUserMarker(map);
  useMapStore.getState().locateUser();
  map.emit('locationfound', { latlng: { lat: -2, lng: -44 } });
  map.emit('moveend');
  t.mock.timers.tick(4500);
  useMapStore.getState().locateUser();
  t.mock.timers.tick(6000); // Geolocation may take longer than the old marker lifetime.
  assert.equal(map.layers.size, 1);
  assert.equal(markers[0].getElement().classList.contains('user-fading'), false);
  const next = { lat: -3, lng: -45 };
  map.emit('locationfound', { latlng: next });
  assert.equal(markers.length, 1);
  assert.equal(markers[0].latlng, next);
  assert.equal(map.listenerCount('moveend'), 1);
  t.mock.timers.tick(6000);
  assert.equal(map.layers.size, 1);
  map.emit('moveend');
  t.mock.timers.tick(5000);
  assert.equal(markers[0].getElement().classList.contains('user-fading'), true);
  t.mock.timers.tick(300);
  assert.equal(map.layers.size, 0);
  unmount();
});

test('a click during fade cancels removal and restores the existing pin', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const map = createMap();
  const { markers, unmount } = mountUserMarker(map);
  useMapStore.getState().locateUser();
  map.emit('locationfound', { latlng: { lat: -2, lng: -44 } });
  map.emit('moveend');
  t.mock.timers.tick(5000);
  assert.equal(markers[0].getElement().classList.contains('user-fading'), true);
  useMapStore.getState().locateUser();
  assert.equal(markers[0].getElement().classList.contains('user-fading'), false);
  t.mock.timers.tick(1000);
  assert.equal(map.layers.size, 1);
  map.emit('locationfound', { latlng: { lat: -3, lng: -45 } });
  assert.equal(markers.length, 1);
  unmount();
});

test('the previous pan ending before the new flyTo starts does not start expiry', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const map = createMap();
  const { unmount } = mountUserMarker(map);
  map.flyTo = () => {
    map.emit('moveend'); // Leaflet flyTo stops a previous pan before firing movestart.
    map.emit('movestart');
  };
  useMapStore.getState().locateUser();
  map.emit('locationfound', { latlng: { lat: -2, lng: -44 } });
  t.mock.timers.tick(6000);
  assert.equal(map.layers.size, 1);
  map.emit('moveend');
  t.mock.timers.tick(5000);
  t.mock.timers.tick(300);
  assert.equal(map.layers.size, 0);
  unmount();
});

test('unmount and map destruction cancel every lifetime stage and leave no listeners or callbacks', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const stage of ['request', 'flight', 'visible', 'fade']) {
    for (const destroy of [false, true]) {
      const map = createMap();
      const { markers, unmount } = mountUserMarker(map);
      useMapStore.getState().locateUser();
      if (stage !== 'request') map.emit('locationfound', { latlng: { lat: -2, lng: -44 } });
      if (stage === 'visible' || stage === 'fade') map.emit('moveend');
      if (stage === 'fade') t.mock.timers.tick(5000);
      if (destroy) map.emit('unload');
      unmount();
      // Pending geolocation listeners belong to the store and are cleared by map unload.
      if (!destroy) map.emit('unload');
      assert.equal(map.layers.size, 0);
      assert.deepEqual(map.eventNames(), [], `${stage}: all map listeners removed`);
      let residualCallbacks = 0;
      for (const marker of markers) {
        marker.remove = () => { residualCallbacks++; };
        marker.getElement = () => { residualCallbacks++; return undefined; };
      }
      t.mock.timers.tick(20000);
      map.emit('moveend');
      map.emit('locationfound', { latlng: { lat: 0, lng: 0 } });
      assert.equal(residualCallbacks, 0);
    }
  }
});

test('a failed retry still lets a previous marker expire', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const map = createMap();
  const { unmount } = mountUserMarker(map);
  useMapStore.getState().locateUser();
  map.emit('locationfound', { latlng: { lat: -2, lng: -44 } });
  map.emit('moveend');
  useMapStore.getState().locateUser();
  map.emit('locationerror', { code: 1 });
  t.mock.timers.tick(5000);
  t.mock.timers.tick(300);
  assert.equal(map.layers.size, 0);
  unmount();
});

test('the existing zoomend tracker switches satellite above 4 for any zoom origin without loops', () => {
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
  map.setZoom(4);
  assert.equal(useMapStore.getState().mapView, 'satellite');
  map.setZoom(5);
  assert.equal(useMapStore.getState().mapView, 'street');
  let notifications = 0;
  const unsubscribe = useMapStore.subscribe(() => { notifications++; });
  map.setZoom(5);
  assert.equal(notifications, 0, 'The same zoom on street does not trigger another render');
  map.setZoom(6);
  assert.equal(useMapStore.getState().mapView, 'street');
  assert.equal(notifications, 1);
  map.setZoom(4);
  assert.equal(useMapStore.getState().mapView, 'street', 'Zooming out does not automatically restore satellite');
  useMapStore.getState().toggleMapView();
  assert.equal(useMapStore.getState().mapView, 'satellite', 'Manual toggle remains available');
  const { unmount } = mountUserMarker(map);
  useMapStore.getState().locateUser();
  map.emit('locationfound', { latlng: { lat: -2, lng: -44 } });
  map.setZoom(MAX_ZOOM);
  assert.equal(useMapStore.getState().mapView, 'street', 'The same rule applies to the Locate flight');
  assert.equal(map.flights.at(-1).zoom, MAX_ZOOM);
  assert.equal(map.listenerCount('zoomend'), 1);
  unmount();
  unsubscribe();
  cleanups.forEach((cleanup) => cleanup());
  assert.equal(map.listenerCount('zoomend'), 0);
});
