import type { CollectionEntry } from 'astro:content';

export type Hike = CollectionEntry<'hikes'>;
export type Guide = CollectionEntry<'guides'>;
export interface HikeRecord {
  hike: Hike;
  guide: Guide;
}

export const guidePath = (guide: Guide) => `/ture/${guide.id.replace(/\.mdx?$/, '')}/`;

export const hikePath = ({ hike, guide }: HikeRecord) =>
  `${guidePath(guide)}#${hike.data.anchor}`;

export const connectHikes = (hikes: Hike[], guides: Guide[]): HikeRecord[] => {
  const guideById = new Map(guides.map((guide) => [guide.id, guide]));
  return hikes.map((hike) => {
    const guide = guideById.get(hike.data.guide.id);
    if (!guide) throw new Error(`Nedostaje vodič ${hike.data.guide.id} za turu ${hike.id}.`);
    return { hike, guide };
  });
};

export const withBase = (path: string) =>
  `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}${path.replace(/^\/+/, '')}`;

export const formatDate = (date: Date) =>
  new Intl.DateTimeFormat('sr-Latn-RS', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);

export const countrySummaries: Record<
  string,
  { title: string; description: string; eyebrow: string }
> = {
  srbija: {
    title: 'Srbija',
    eyebrow: 'Staze blizu kuće',
    description:
      'Od pitomih grebena Fruške gore do visokih vrhova Stare planine — ideje za jednodnevne i vikend ture.',
  },
  'crna-gora': {
    title: 'Crna Gora',
    eyebrow: 'Krš i ledena jezera',
    description:
      'Durmitorski vrhovi, duboki kanjoni i markirane staze kroz jedan od najupečatljivijih predela Dinarida.',
  },
  nepal: {
    title: 'Nepal',
    eyebrow: 'Himalajski horizonti',
    description:
      'Višednevni trekovi kroz sela, rododendronske šume i visoke doline pod najvišim vrhovima sveta.',
  },
  slovenija: {
    title: 'Slovenija',
    eyebrow: 'Alpski grebeni',
    description:
      'Visokogorske staze Kamniško-Savinjskih Alpa, od višednevnog Highlandera do uspona na Grintovec.',
  },
};
