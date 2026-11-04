import { z } from 'astro/zod';
import rawMetrics from '../data/track-metrics.json' with { type: 'json' };

export const trackMetricsSchema = z.record(
  z.string().regex(/^\/gpx\/(?:[^/.][^/]*\/)*[^/]+\.gpx$/),
  z.object({
    distanceKm: z.number().finite().positive().optional(),
    elevationGainM: z.number().finite().int().nonnegative().optional(),
    durationHours: z.number().finite().positive().optional(),
    highestPointM: z.number().finite().int().optional(),
    date: z.string().date().optional(),
    reviewStatus: z.enum(['pending', 'verified']),
    source: z.string(),
    notes: z.string(),
  }).strict(),
);

export const trackMetrics = trackMetricsSchema.parse(rawMetrics);
export type TrackMetricsRegistry = z.infer<typeof trackMetricsSchema>;
type TrackMetrics = TrackMetricsRegistry[string];
export type PublishedTrackMetrics = Pick<
  TrackMetrics,
  'distanceKm' | 'elevationGainM' | 'durationHours' | 'highestPointM' | 'date'
>;
export type TrackMode = 'single' | 'segments' | 'variants';

export const getTrackMetrics = (
  src: string,
  registry: TrackMetricsRegistry = trackMetrics,
): PublishedTrackMetrics => {
  const entry = registry[src];
  if (!entry) throw new Error(`Missing centralized GPX metadata: ${src}`);
  // Review annotations are repository-only and must not enter page or map data.
  return {
    distanceKm: entry.distanceKm,
    elevationGainM: entry.elevationGainM,
    durationHours: entry.durationHours,
    highestPointM: entry.highestPointM,
    date: entry.date,
  };
};

export const summarizeTrackMetrics = (
  mode: TrackMode,
  tracks: PublishedTrackMetrics[],
): Omit<PublishedTrackMetrics, 'date'> => {
  if (!['single', 'segments', 'variants'].includes(mode)) {
    throw new Error(`Unknown GPX track mode: ${mode}`);
  }
  if (!tracks.length) throw new Error('A hike must reference at least one GPX track.');
  if (mode === 'single' && tracks.length !== 1) {
    throw new Error('A single hike must reference exactly one GPX track.');
  }
  if (mode === 'variants') return {};
  if (mode === 'single') {
    const { distanceKm, elevationGainM, durationHours, highestPointM } = tracks[0];
    return { distanceKm, elevationGainM, durationHours, highestPointM };
  }

  const sum = (field: 'distanceKm' | 'elevationGainM' | 'durationHours') => {
    const values = tracks.map((track) => track[field]);
    if (values.some((value) => value === undefined)) return undefined;
    return Math.round(
      values.filter((value) => value !== undefined).reduce((total, value) => total + value, 0) * 100,
    ) / 100;
  };
  const heights = tracks.map((track) => track.highestPointM);
  return {
    distanceKm: sum('distanceKm'),
    elevationGainM: sum('elevationGainM'),
    durationHours: sum('durationHours'),
    highestPointM: heights.some((height) => height === undefined)
      ? undefined
      : Math.max(...heights.filter((height) => height !== undefined)),
  };
};
