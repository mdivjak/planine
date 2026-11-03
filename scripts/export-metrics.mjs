import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';

const root = new URL('../', import.meta.url);
const hikesRoot = new URL('src/content/hikes/', root);
const publicRoot = new URL('public/', root);
const output = process.argv[2] ?? 'data/route-metrics-review.csv';
if (process.argv.length > 3) throw new Error('Usage: npm run export:metrics -- [output.csv]');

const walk = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => {
    const url = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
    return entry.isDirectory() ? walk(url) : [url];
  }))).flat();
};

const columns = [
  'record_type', 'markdown_path', 'hike_title', 'track_mode', 'gpx_path', 'track_label',
  'current_distance_km', 'current_elevation_gain_m',
  'corrected_distance_km', 'corrected_elevation_gain_m', 'review_status', 'source', 'notes',
];
const rows = [];
const assigned = new Set();
const gpxFiles = (await walk(new URL('gpx/', publicRoot)))
  .filter((file) => file.pathname.toLowerCase().endsWith('.gpx'))
  .sort((a, b) => a.pathname.localeCompare(b.pathname, 'en'));
const gpxPaths = new Set(gpxFiles.map((file) => `/${path.relative(publicRoot.pathname, file.pathname)}`));
const hikeFiles = (await walk(hikesRoot))
  .filter((file) => /\.mdx?$/.test(file.pathname))
  .sort((a, b) => a.pathname.localeCompare(b.pathname, 'en'));

for (const file of hikeFiles) {
  const content = await readFile(file, 'utf8');
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  if (!frontmatter) throw new Error(`Missing frontmatter: ${file.pathname}`);
  const hike = parse(frontmatter);
  if (!hike.title || !['single', 'variants', 'segments'].includes(hike.trackMode) ||
      !Array.isArray(hike.gpxTracks) || !hike.gpxTracks.length) {
    throw new Error(`Invalid hike metadata: ${file.pathname}`);
  }
  const markdownPath = path.relative(root.pathname, file.pathname);
  const row = (type, track, notes = '') => [
    type, markdownPath, hike.title, hike.trackMode, track.src ?? '', track.label ?? '',
    track.distanceKm ?? '', track.elevationM ?? '', '', '', 'pending', '', notes,
  ];
  rows.push(row('hike', hike,
    hike.trackMode === 'variants' ? 'Alternative tracks must not be summed.' :
      hike.trackMode === 'segments' ? 'Summary of consecutive segments; review against segment totals.' :
        'Review summary together with its single track.'));
  for (const track of hike.gpxTracks) {
    if (!gpxPaths.has(track.src)) throw new Error(`Missing GPX: ${track.src} (${markdownPath})`);
    if (assigned.has(track.src)) throw new Error(`GPX assigned more than once: ${track.src}`);
    assigned.add(track.src);
    rows.push(row('track', track));
  }
}

for (const gpxPath of gpxPaths) {
  if (!assigned.has(gpxPath)) {
    rows.push([
      'unassigned_track', '', '', '', gpxPath, '', '', '', '', '', 'pending', '',
      'No hike references this GPX. No published metrics to correct; review before assigning or removing.',
    ]);
  }
}

const escape = (value) => `"${String(value).replaceAll('"', '""')}"`;
const csv = [columns, ...rows].map((row) => row.map(escape).join(',')).join('\r\n');
// Never overwrite a spreadsheet that may already contain reviewed values.
await writeFile(output, `\uFEFF${csv}\r\n`, { encoding: 'utf8', flag: 'wx' });
console.log(`Exported ${hikeFiles.length} hikes and ${gpxFiles.length} GPX files to ${output}.`);
