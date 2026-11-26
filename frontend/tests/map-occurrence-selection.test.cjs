const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ts = require('typescript');

// Run pure TS modules and Zustand actions with Node's test runner, without a new framework.
require.extensions['.ts'] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const { useMapStore } = require('../src/modules/map/store/mapStore.ts');
const { shouldOpenClusterSidebar, MAX_CLUSTER_ITEMS_FOR_SIDEBAR } = require('../src/modules/map/components/LeafletMap/occurrence-cluster.ts');
const { CLUSTER_MAX_ZOOM } = require('../src/modules/map/components/LeafletMap/map-zoom.ts');
const { sortOccurrences, occurrenceDateKey, validSourceUrl, occurrenceField, sharedOccurrenceLocation } = require('../src/modules/occurrences/utils/occurrence-presentation.ts');
const { mapOccurrenceDtoToFeature, filterOccurrenceCollection } = require('../src/entities/occurrence/occurrence.mappers.ts');

const item = (id, date = '') => ({ id: String(id), coordinates: [-44 + id / 1000, -2], date, city: 'City', state: 'MA', articles: [] });

test('selection starts closed, supports markers and groups, preserves group on card selection, and clears both states', () => {
  const store = useMapStore.getState();
  assert.deepEqual(store.selectedOccurrences, []);
  assert.equal(store.selectedOccurrence, null);
  const a = item(1), b = item(2);
  store.selectOccurrences([a]);
  assert.equal(useMapStore.getState().selectedOccurrence, a);
  store.selectOccurrences([a, b, a]);
  const group = useMapStore.getState().selectedOccurrences;
  assert.deepEqual(group, [a, b]);
  assert.equal(useMapStore.getState().selectedOccurrence, null);
  store.setSelectedOccurrence(b);
  assert.equal(useMapStore.getState().selectedOccurrences, group);
  assert.equal(useMapStore.getState().selectedOccurrence, b);
  store.setSelectedOccurrence(null);
  assert.deepEqual(useMapStore.getState().selectedOccurrences, []);
  assert.equal(useMapStore.getState().selectedOccurrence, null);
});

test('filter reconciliation removes hidden selections and refreshes available records without adding other occurrences', () => {
  const store = useMapStore.getState();
  const a = item(1), b = item(2), c = item(3);
  store.selectOccurrences([a, b]);
  store.setSelectedOccurrence(b);
  const refreshed = { ...a, date: '2025' };
  store.reconcileOccurrenceSelection([refreshed, c]);
  assert.deepEqual(useMapStore.getState().selectedOccurrences, [refreshed]);
  assert.equal(useMapStore.getState().selectedOccurrence, null);
  store.reconcileOccurrenceSelection([]);
  assert.deepEqual(useMapStore.getState().selectedOccurrences, []);
  store.setSelectedOccurrence(c);
  assert.deepEqual(useMapStore.getState().selectedOccurrences, [c]);
  store.clearOccurrenceSelection();
});

test('small clusters open; large dispersed clusters zoom; co-located and maximum-zoom groups remain inspectable', () => {
  const small = Array.from({ length: MAX_CLUSTER_ITEMS_FOR_SIDEBAR }, (_, i) => item(i));
  const large = [...small, item(MAX_CLUSTER_ITEMS_FOR_SIDEBAR)];
  assert.equal(shouldOpenClusterSidebar([], 4), false);
  assert.equal(shouldOpenClusterSidebar(small, 4), true);
  assert.equal(shouldOpenClusterSidebar(large, 4), false);
  assert.equal(shouldOpenClusterSidebar(large, CLUSTER_MAX_ZOOM), true);
  assert.equal(shouldOpenClusterSidebar(large.map(x => ({ ...x, coordinates: [-44, -2] })), 4), true);
});

test('date sorting handles ISO dates and partial years, keeps undated items last, and does not mutate selection', () => {
  const items = [item(1, ''), item(2, '2024'), item(3, '2025-02-01'), item(4, '2025-02-30')];
  assert.deepEqual(sortOccurrences(items, 'newest').map(x => x.id), ['3', '2', '1', '4']);
  assert.deepEqual(sortOccurrences(items, 'oldest').map(x => x.id), ['2', '3', '1', '4']);
  assert.deepEqual(items.map(x => x.id), ['1', '2', '3', '4']);
  assert.equal(occurrenceDateKey('2025-02-30'), null);
  assert.equal(occurrenceDateKey('2025-13'), null);
  assert.equal(occurrenceDateKey('15/06/2025'), null);
  assert.notEqual(occurrenceDateKey('2024-02-29'), null);
});

test('source actions accept only absolute HTTP(S) URLs and location requires complete shared fields', () => {
  for (const url of ['', undefined, '/article', 'not a url', 'javascript:alert(1)', 'data:text/html,hi']) {
    assert.equal(validSourceUrl(url), undefined);
  }
  assert.equal(validSourceUrl('https://example.com/article'), 'https://example.com/article');
  assert.equal(validSourceUrl('http://example.com/article'), 'http://example.com/article');
  assert.equal(occurrenceField('Nao informado'), undefined);
  assert.equal(occurrenceField('UF nao informada'), undefined);
  assert.equal(occurrenceField('-'), undefined);
  assert.equal(sharedOccurrenceLocation([item(1), item(2)]), 'City - MA');
  assert.equal(sharedOccurrenceLocation([item(1), { ...item(2), city: 'Other' }]), undefined);
  assert.equal(sharedOccurrenceLocation([{ ...item(1), city: 'Municipio nao informado' }]), undefined);
});

test('missing vector is not fabricated from the parasite and the parasite remains filterable', () => {
  const feature = mapOccurrenceDtoToFeature({
    idOcorrencia: 1, latitude: -2, longitude: -44,
    vetorNomeCientifico: null, parasitoNomeCientifico: 'Test parasite', fontes: [],
  });
  assert.equal(feature.properties.vector, '');
  assert.equal(feature.properties.parasite, 'Test parasite');
  const filtered = filterOccurrenceCollection({ type: 'FeatureCollection', features: [feature] }, { vectors: ['Test parasite'] });
  assert.equal(filtered.features.length, 1);
});
