# Planine

Astro 5 verzija ličnog planinarskog sajta čuva praktičnost produkcionog Jekyll arhiva, ali razdvaja **planinsku stranicu**, **pojedinačnu turu**, **lokalnu oblast**, **mapu** i **GPX varijantu**. Tako nekoliko kratkih izleta može ostati na jednom korisnom vodiču, dok imenik, pretraga i pregledna mapa i dalje rade sa svakom turom zasebno.

Početna stranica odmah prikazuje kompletan imenik od 51 ture, grupisan po zemlji i planini. Pretraga filtrira naziv ture, planinu, lokalnu oblast, region, zemlju i oznake; bez JavaScripta ostaje dostupan ceo povezani imenik. Mapa ispod imenika početno učitava samo 51 lagano polazište, a GPX izabrane ture preuzima tek na zahtev.

## Pokretanje i provera

Potreban je Node.js 20 ili noviji.

```sh
npm install
npm run dev
npm run astro -- check
npm run build
npm run validate:content
npm run preview
```

`validate:content` proverava reference tura ka vodičima, jedinstvene anchors, dodelu i postojanje svih GPX datoteka, zaostali Liquid i — nakon build-a — interne linkove i njihove anchors.

Sajt je podešen za GitHub Pages baznu putanju `/planine` u `astro.config.mjs`. Interni linkovi i lokalni resursi prolaze kroz `withBase()`.

Leaflet je u dev režimu izuzet iz Vite `optimizeDeps` keša i usmeren na njegov ESM izvor, pa mape ne zavise od prolaznog `node_modules/.vite/deps/leaflet.js` artefakta. Ako se posle promene Vite konfiguracije ipak koristi stari lokalni keš, dev server treba zaustaviti i jednom pokrenuti:

```powershell
Remove-Item -Recurse -Force node_modules\.vite
npm run dev -- --host localhost
```

## Struktura

```text
src/
├── content/
│   ├── guides/            # Editorialne planinske/destinacijske stranice
│   ├── hikes/             # Pojedinačne ture i njihove GPX datoteke
│   └── pages/             # O sajtu i resursi
├── content.config.ts      # Tipizovane guides/hikes/pages kolekcije
├── components/
│   ├── GpxMap.astro       # Mapa jedne lokalne grupe tragova
│   ├── GpxDownloads.astro # Preuzimanje GPX-a bez JavaScripta
│   ├── HikeDirectory.astro
│   └── TrailExplorerMap.astro
├── pages/
│   ├── destinacije/
│   └── ture/[...slug].astro
├── scripts/gpx-map.ts     # Zajednički GPX parser i Leaflet ponašanje
└── utils/hikes.ts         # Tipizovano povezivanje guides + hikes
public/
├── gpx/archive/           # 74 javne GPX datoteke
└── images/archive/
scripts/
└── validate-content.mjs
```

## Model sadržaja

### `guides`

Vodič predstavlja editorialnu stranicu o planini ili destinaciji. Sadrži zemlju, region, planinu, naslov, uvod, naslovnu fotografiju i izvorni Jekyll put. Jedan vodič generiše jednu URL stranicu:

```text
/ture/srbija/stara-planina/
```

### `hikes`

Tura predstavlja zaseban izlet/rutu unutar vodiča. Polje `guide` je tipizovana Astro referenca, a ne ručno spajanje stringova. Svaka tura ima:

- stabilan `anchor` za direktan link;
- `localArea` za pristupnu zonu ili lokalitet;
- `mapGroup` i `mapGroupTitle`;
- `trackMode`: `single`, `variants` ili `segments`;
- sopstveni opis, metrike, polazište i oznake;
- opcioni niz `photos` vezan baš za tu turu;
- jedan ili više `gpxTracks`, sa nazivom, bojom i raspoloživim statistikama.

Direktan URL pojedinačne ture vodi na njenu sekciju unutar korisnog zajedničkog vodiča:

```text
/ture/srbija/stara-planina/#ponor
```

## Obrasci za uređivanje sadržaja

### Nekoliko kratkih tura na jednom vodiču

Napravi jedan zapis u `guides/`, a po jedan zapis u `hikes/` za svaku turu. Sve ture koriste isti `guide`, ali imaju različite `anchor` vrednosti:

```yaml
guide: "srbija/fruska-gora"
title: "Manastir Novo Hopovo - Iriški venac"
anchor: "manastir-novo-hopovo-iriski-venac"
localArea: "Novo Hopovo"
```

Vodič ostaje jedna koherentna stranica, dok imenik, pretraga i explorer vode direktno na ovu turu.

### Više tura na istoj lokalnoj mapi

Ture koje su geografski povezane dobijaju isti `mapGroup`:

```yaml
mapGroup: "vrdnik"
mapGroupTitle: "Vrdnik i okolina"
```

Njihovi tragovi se prikazuju zajedno samo na toj mapi. To se koristi, na primer, za bliske homoljske ture oko Ždrela, Bistrice i Gornjaka.

### Više mapa na jednom vodiču

Turama iz udaljenih pristupnih zona dodeli različite `mapGroup` vrednosti. Stranica automatski renderuje po jednu mapu za svaku grupu. Durmitor zato ima četiri lokalne mape, a Stara planina tri, umesto jedne preopterećene mape celog planinskog masiva.

### Jedna tura sa GPX varijantama

Alternativni, sezonski ili pristupni tragovi pripadaju istoj turi:

```yaml
trackMode: "variants"
gpxTracks:
  - src: "/gpx/archive/srbija/beljanica/beljanica-inout.gpx"
    label: "Standardna varijanta"
  - src: "/gpx/archive/srbija/beljanica/beljanica-zimi.gpx"
    label: "Zimska varijanta"
```

Varijante se ne sabiraju u lažnu ukupnu dužinu. Svaka ostaje posebno dostupna za preuzimanje.

### Višednevna tura u segmentima

Za uzastopne deonice iste ture koristi `trackMode: "segments"`. Metrike se tada mogu sabrati, a mapa i preuzimanja zadržavaju svaku dnevnu deonicu zasebno. Tako su modelovani Annapurna Base Camp i Highlander.

### Samostalna tura

Za dugu turu kojoj odgovara posebna stranica napravi jedan vodič i jednu turu koja ga referencira. Isti renderer tada prirodno daje samostalno detail iskustvo bez posebnog tipa stranice ili dupliranog koda.

### Fotografije ture

Originalne fotografije čuvaju se u `src/assets/photos/<zemlja>/<planina>/`, da bi `astro:assets` mogao da generiše responsive WebP prikaze. Galerija pripada pojedinačnom `hikes` zapisu i automatski se prikazuje posle teksta ture, a pre GPX preuzimanja i mape:

```yaml
photos:
  - src: "../../../../assets/photos/srbija/fruska-gora/fruska-3-1.jpeg"
    alt: "Visibabe među suvim lišćem u šumi na Fruškoj gori"
    caption: "Visibabe uz stazu kroz šumu iznad Vrdnika."
  - src: "../../../../assets/photos/srbija/zagajicka-brda/zagajica-dron.jpg"
    alt: "Pogled iz vazduha na valovita zelena Zagajička brda"
    caption: "Zagajička brda iz vazduha, sa dolinama koje preseca staza."
    emphasis: "wide"
```

`alt` kratko opisuje ono što se vidi korisniku čitača ekrana; `caption` daje kontekst ture i uvek je vidljiv ispod fotografije. `emphasis: "wide"` je opcioni izuzetak za naročito koristan panoramski kadar. Preporučeni su JPEG/WebP originali širine 1600–2400 px; manji originali se ne uvećavaju. Thumbnail slike se učitavaju lenjo, a veća lightbox verzija tek kada korisnik aktivira fotografiju. Direktan link ka većoj slici ostaje no-JavaScript fallback.

## Mape i GPX

`GpxMap.astro` i pregledna mapa dele parser iz `src/scripts/gpx-map.ts`:

- lokalni GPX se parsira u pregledaču bez GPX plugina;
- svaka lokalna mapa može prikazati jednu turu, varijante ili više bliskih tura;
- svaki GPX fajl je zaseban, imenovan overlay koji se može uključiti ili isključiti bez ponovnog preuzimanja i promene viewporta; svi njegovi `<trkseg>` segmenti ostaju u istoj checkbox grupi;
- javni `download` linkovi koriste iste base-path-safe izvore kao mapa;
- greška jednog GPX-a ne prekida ostale tragove;
- wheel zoom radi kada je pokazivač iznad mape, a touch uređaji zadržavaju pinch zoom;
- svaka mapa ima Leaflet-style fullscreen kontrolu unutar gornjeg desnog ugla; native Fullscreen API proširuje samo map viewport, sa srpskim labelama, Escape izlazom i Leaflet `invalidateSize()` sinhronizacijom.

Globalni explorer počinje iznad Srbije i Balkana. Markeri se grupišu bez dodatnog Leaflet plugina. Izbor markera učitava samo GPX te pojedinačne ture (ili njene eksplicitne varijante/segmente), pa arhiva može da raste bez početnog preuzimanja svih putanja. Trag može da se sakrije i ponovo prikaže bez novog zahteva, a reset vraća mapu na Srbiju.

OpenStreetMap pločice zahtevaju internet; GPX datoteke su deo statičkog sajta i javno se preuzimaju sa `/planine/gpx/archive/...`.

## Jekyll → Astro

| Jekyll | Astro |
|---|---|
| Jedna planinska Markdown stranica | Jedan `guides` zapis |
| H2 sekcija sa GPX include-om | Jedan `hikes` zapis i stabilan anchor |
| Jedan include sa više povezanih fajlova | `variants` ili `segments` iste ture |
| Više odvojenih include mapa na stranici | Različiti `mapGroup` zapisi |
| Liquid GPX mapa | `<GpxMap />` i `<GpxDownloads />` |
| Ručni navigacioni spisak | Kolekcije, tipizovane reference i build-time grupisanje |
| Jekyll carousel | Responzivna galerija originalnih fotografija |
| GPX pored Markdown-a | `public/gpx/archive/`, uz `/planine` baznu putanju |

Ovaj model čuva korisne objedinjene planinske vodiče, ali više ne tretira čitav Durmitor ili Staru planinu kao jednu turu na početnoj mapi.
