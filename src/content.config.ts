import { defineCollection, reference, z } from 'astro:content';
import { glob } from 'astro/loaders';

const gpxTrack = z.object({
  src: z.string(),
  label: z.string(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  distanceKm: z.number().positive().optional(),
  elevationM: z.number().int().nonnegative().optional(),
  durationHours: z.number().positive().optional(),
  highestPointM: z.number().int().optional(),
  date: z.coerce.date().optional(),
});

const guides = defineCollection({
  loader: glob({ base: './src/content/guides', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    country: z.string(),
    countrySlug: z.string(),
    region: z.string(),
    mountain: z.string(),
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    featured: z.boolean().default(false),
    cover: z.string(),
    coverAlt: z.string(),
    tags: z.array(z.string()).default([]),
    sourcePath: z.string().optional(),
  }),
});

const hikes = defineCollection({
  loader: glob({ base: './src/content/hikes', pattern: '**/*.{md,mdx}' }),
  schema: ({ image }) => z.object({
    guide: reference('guides'),
    title: z.string(),
    anchor: z.string(),
    description: z.string(),
    localArea: z.string(),
    mapGroup: z.string(),
    mapGroupTitle: z.string(),
    trackMode: z.enum(['single', 'variants', 'segments']),
    date: z.coerce.date(),
    distanceKm: z.number().positive().optional(),
    elevationM: z.number().int().positive().optional(),
    durationHours: z.number().positive().optional(),
    highestPointM: z.number().int().positive().optional(),
    featured: z.boolean().default(false),
    sourceOrder: z.number().int().nonnegative(),
    tags: z.array(z.string()).default([]),
    trailhead: z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      label: z.string().optional(),
    }),
    photos: z.array(
      z.object({
        src: image(),
        alt: z.string().min(1),
        caption: z.string().min(1),
        emphasis: z.enum(['wide']).optional(),
      }),
    ).default([]),
    gpxTracks: z.array(gpxTrack).min(1),
  }),
});

const pages = defineCollection({
  loader: glob({ base: './src/content/pages', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
  }),
});

export const collections = { guides, hikes, pages };
