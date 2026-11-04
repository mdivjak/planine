import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parse } from 'yaml';
import { getTrackMetrics, summarizeTrackMetrics, trackMetrics } from '../src/utils/track-metrics.ts';

const root = process.cwd();
const guidesRoot = path.join(root, 'src', 'content', 'guides');
const hikesRoot = path.join(root, 'src', 'content', 'hikes');
const publicRoot = path.join(root, 'public');
const distRoot = path.join(root, 'dist');
const errors = [];

const walk = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(directory, entry.name);
        return entry.isDirectory() ? walk(fullPath) : [fullPath];
      }),
    )
  ).flat();
};

const exists = async (filePath) => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const contentId = (rootPath, filePath) =>
  path.relative(rootPath, filePath).replaceAll(path.sep, '/').replace(/\.mdx?$/, '');
const field = (content, name) =>
  content.match(new RegExp(`^${name}:\\s+\"([^\"]+)\"`, 'm'))?.[1];

const guideFiles = (await walk(guidesRoot)).filter((filePath) => /\.mdx?$/.test(filePath));
const hikeFiles = (await walk(hikesRoot)).filter((filePath) => /\.mdx?$/.test(filePath));
const guideIds = new Set(guideFiles.map((filePath) => contentId(guidesRoot, filePath)));
const anchorsByGuide = new Map();
const referencedGpx = new Map();

for (const filePath of [...guideFiles, ...hikeFiles]) {
  const content = await readFile(filePath, 'utf8');
  if (content.includes('{%') || content.includes('{{')) {
    errors.push(`Nerazrešen Liquid izraz: ${path.relative(root, filePath)}`);
  }
}

for (const filePath of hikeFiles) {
  const content = await readFile(filePath, 'utf8');
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  if (!frontmatter) throw new Error(`Missing frontmatter: ${filePath}`);
  const hike = parse(frontmatter);
  const hikeId = contentId(hikesRoot, filePath);
  const guide = field(content, 'guide');
  const anchor = field(content, 'anchor');
  const mapGroup = field(content, 'mapGroup');

  if (!guide || !guideIds.has(guide)) errors.push(`Tura ${hikeId} referencira nepostojeći vodič: ${guide}`);
  if (!anchor) errors.push(`Tura ${hikeId} nema stabilan anchor.`);
  if (!mapGroup) errors.push(`Tura ${hikeId} nema mapGroup.`);

  if (guide && anchor) {
    const anchors = anchorsByGuide.get(guide) ?? new Set();
    if (anchors.has(anchor)) errors.push(`Dupliran anchor ${anchor} u vodiču ${guide}.`);
    anchors.add(anchor);
    anchorsByGuide.set(guide, anchors);
  }

  const metricFields = ['distanceKm', 'elevationM', 'elevationGainM', 'durationHours', 'highestPointM'];
  for (const entry of [hike, ...hike.gpxTracks]) {
    for (const key of [...metricFields, ...(entry === hike ? [] : ['date'])]) {
      if (key in entry) errors.push(`Metrike pripadaju src/data/track-metrics.json: ${hikeId} (${key}).`);
    }
  }
  summarizeTrackMetrics(hike.trackMode, hike.gpxTracks.map((track) => getTrackMetrics(track.src)));
  for (const track of hike.gpxTracks) {
    referencedGpx.set(track.src, (referencedGpx.get(track.src) ?? 0) + 1);
    const assetPath = path.join(publicRoot, ...track.src.replace(/^\//, '').split('/'));
    if (!(await exists(assetPath))) errors.push(`Nedostaje GPX za ${hikeId}: ${track.src}`);
  }
}

for (const [gpxPath, usageCount] of referencedGpx) {
  if (usageCount > 1) errors.push(`GPX je dodeljen više puta (${usageCount}): ${gpxPath}`);
}

const allGpx = (await walk(path.join(publicRoot, 'gpx')))
  .filter((filePath) => filePath.toLowerCase().endsWith('.gpx'))
  .map((filePath) => `/${path.relative(publicRoot, filePath).replaceAll(path.sep, '/')}`);
const archiveGpx = allGpx.filter((gpxPath) => gpxPath.startsWith('/gpx/archive/'));
const allGpxPaths = new Set(allGpx);
for (const gpxPath of allGpxPaths) {
  if (!Object.hasOwn(trackMetrics, gpxPath)) errors.push(`Nedostaju centralne GPX metrike: ${gpxPath}`);
}
for (const gpxPath of Object.keys(trackMetrics)) {
  if (!allGpxPaths.has(gpxPath)) errors.push(`Centralne metrike referenciraju nepostojeći GPX: ${gpxPath}`);
}
for (const gpxPath of archiveGpx) {
  if (!referencedGpx.has(gpxPath)) errors.push(`Arhivski GPX nije dodeljen turi: ${gpxPath}`);
}

if (await exists(distRoot)) {
  const htmlFiles = (await walk(distRoot)).filter((filePath) => filePath.endsWith('.html'));
  const htmlByRoute = new Map();
  for (const filePath of htmlFiles) {
    const relative = path.relative(distRoot, filePath).replaceAll(path.sep, '/');
    const route =
      relative === 'index.html'
        ? '/'
        : relative.endsWith('/index.html')
          ? `/${relative.slice(0, -'index.html'.length)}`
          : `/${relative}`;
    htmlByRoute.set(route, await readFile(filePath, 'utf8'));
  }

  for (const [sourceRoute, html] of htmlByRoute) {
    for (const match of html.matchAll(/href="(\/planine\/[^"#?]*\/?)(?:#([^"]+))?"/g)) {
      const pathname = new URL(match[1], 'https://example.test').pathname.replace(/^\/planine/, '') || '/';
      const anchor = match[2];
      if (pathname.startsWith('/_astro/')) continue;
      if (path.extname(pathname)) {
        const assetPath = path.join(distRoot, ...pathname.replace(/^\//, '').split('/'));
        if (!(await exists(assetPath))) errors.push(`Polomljen asset link iz ${sourceRoute}: ${match[1]}`);
        continue;
      }
      const targetHtml = htmlByRoute.get(pathname.endsWith('/') ? pathname : `${pathname}/`);
      if (!targetHtml) {
        errors.push(`Polomljen interni link iz ${sourceRoute}: ${match[1]}`);
      } else if (anchor && !targetHtml.includes(`id="${anchor}"`)) {
        errors.push(`Nepostojeći anchor iz ${sourceRoute}: ${match[1]}#${anchor}`);
      }
    }

    const imageUrls = [
      ...[...html.matchAll(/src="(\/planine\/[^"]+)"/g)].map((match) => match[1]),
      ...[...html.matchAll(/srcset="([^"]+)"/g)].flatMap((match) =>
        match[1]
          .split(',')
          .map((candidate) => candidate.trim().split(/\s+/)[0])
          .filter((candidate) => candidate.startsWith('/planine/')),
      ),
    ];
    for (const imageUrl of imageUrls) {
      const pathname = new URL(imageUrl, 'https://example.test').pathname.replace(/^\/planine/, '');
      const assetPath = path.join(distRoot, ...decodeURIComponent(pathname).replace(/^\//, '').split('/'));
      if (!(await exists(assetPath))) errors.push(`Polomljena slika iz ${sourceRoute}: ${imageUrl}`);
    }
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    JSON.stringify(
      {
        guides: guideFiles.length,
        hikes: hikeFiles.length,
        referencedGpx: referencedGpx.size,
        archiveGpx: archiveGpx.length,
        centralizedGpx: Object.keys(trackMetrics).length,
        internalLinks: (await exists(distRoot)) ? 'checked' : 'build dist/ to check',
      },
      null,
      2,
    ),
  );
}
