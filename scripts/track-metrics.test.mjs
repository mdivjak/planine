import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getTrackMetrics, summarizeTrackMetrics, trackMetricsSchema,
} from '../src/utils/track-metrics.ts';

const src = '/gpx/test.gpx';
const entry = {
  distanceKm: 1.234, elevationGainM: 0, durationHours: 0.75, highestPointM: -5,
  date: '2024-02-29', reviewStatus: 'pending', source: 'private source', notes: 'private note',
};

test('validation accepts unknown metrics and rejects malformed metadata', () => {
  assert.ok(trackMetricsSchema.safeParse({ [src]: entry }).success);
  assert.ok(trackMetricsSchema.safeParse({
    [src]: { reviewStatus: 'pending', source: '', notes: '' },
  }).success);
  for (const invalid of [
    { distanceKm: 0 }, { distanceKm: -1 }, { distanceKm: Infinity },
    { elevationGainM: -1 }, { elevationGainM: 1.5 }, { elevationGainM: null },
    { durationHours: 0 }, { highestPointM: 1.5 }, { date: '2023-02-29' },
    { reviewStatus: 'approved' }, { elevationM: 200 }, { distanceKm: '1.2' },
  ]) {
    assert.equal(trackMetricsSchema.safeParse({ [src]: { ...entry, ...invalid } }).success, false);
  }
  assert.equal(trackMetricsSchema.safeParse({ '/other/test.gpx': entry }).success, false);
});

test('public metrics exclude review annotations regardless of review status', () => {
  const pending = getTrackMetrics(src, { [src]: entry });
  const verified = getTrackMetrics(src, { [src]: { ...entry, reviewStatus: 'verified' } });
  assert.deepEqual(pending, verified);
  assert.deepEqual(Object.keys(pending).sort(),
    ['date', 'distanceKm', 'durationHours', 'elevationGainM', 'highestPointM']);
  assert.doesNotMatch(JSON.stringify(pending), /reviewStatus|private source|private note/);
  assert.throws(() => getTrackMetrics('/gpx/missing.gpx', {}), /Missing centralized/);
});

test('single summaries use exact track values, including zero ascent', () => {
  assert.deepEqual(summarizeTrackMetrics('single', [entry]), {
    distanceKm: 1.234, elevationGainM: 0, durationHours: 0.75, highestPointM: -5,
  });
  assert.throws(() => summarizeTrackMetrics('single', [entry, entry]), /exactly one/);
  assert.throws(() => summarizeTrackMetrics('segments', []), /at least one/);
  assert.throws(() => summarizeTrackMetrics('unknown', [entry]), /Unknown GPX track mode/);
});

test('segments sum and round totals once, take the highest point, and never sum alternatives', () => {
  const tracks = [
    { distanceKm: 1.234, elevationGainM: 0, durationHours: 0.1, highestPointM: 100 },
    { distanceKm: 2.234, elevationGainM: 50, durationHours: 0.2, highestPointM: 200 },
  ];
  assert.deepEqual(summarizeTrackMetrics('segments', tracks), {
    distanceKm: 3.47, elevationGainM: 50, durationHours: 0.3, highestPointM: 200,
  });
  assert.deepEqual(summarizeTrackMetrics('variants', tracks), {});
});

test('a missing segment metric stays unknown instead of becoming a partial total', () => {
  assert.deepEqual(summarizeTrackMetrics('segments', [entry, { elevationGainM: 25 }]), {
    distanceKm: undefined, elevationGainM: 25, durationHours: undefined, highestPointM: undefined,
  });
});
