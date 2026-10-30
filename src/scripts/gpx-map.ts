import * as L from 'leaflet';

export interface GpxTrackConfig {
  src: string;
  label: string;
  color: string;
  title?: string;
  subtitle?: string;
  href?: string;
}

export interface ExplorerHikeConfig {
  id: string;
  title: string;
  mountain: string;
  country: string;
  href: string;
  color: string;
  trailhead: {
    lat: number;
    lng: number;
    label?: string;
  };
  tracks: GpxTrackConfig[];
}

const SERBIA_CENTER: L.LatLngTuple = [44.05, 20.75];
const SERBIA_ZOOM = 7;

const parseGpx = (xml: string) => {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.querySelector('parsererror')) throw new Error('GPX datoteka nije ispravna.');

  return [...document.querySelectorAll('trkseg')]
    .map((segment) =>
      [...segment.querySelectorAll('trkpt')]
        .map((point) => [
          Number(point.getAttribute('lat')),
          Number(point.getAttribute('lon')),
        ] as L.LatLngTuple)
        .filter(([latitude, longitude]) => Number.isFinite(latitude) && Number.isFinite(longitude)),
    )
    .filter((segment) => segment.length > 1);
};

const loadGpx = async (src: string, signal?: AbortSignal) => {
  const response = await fetch(src, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const segments = parseGpx(await response.text());
  if (!segments.length) throw new Error('Trag nema tačke.');
  return segments;
};

const createTrackPopup = (track: GpxTrackConfig) => {
  const popup = document.createElement('div');
  popup.className = 'trail-popup';

  const title = document.createElement('strong');
  title.textContent = track.title ?? track.label;
  popup.append(title);

  if (track.subtitle) {
    const subtitle = document.createElement('span');
    subtitle.textContent = track.subtitle;
    popup.append(subtitle);
  }

  if (track.href) {
    const link = document.createElement('a');
    link.href = track.href;
    link.textContent = 'Otvori detalje ture →';
    popup.append(link);
  }

  return popup;
};

const fullscreenEnterLabel = 'Prikaži mapu preko celog ekrana';
const fullscreenExitLabel = 'Izađi iz prikaza preko celog ekrana';

const addFullscreenControl = (map: L.Map, mapElement: HTMLElement) => {
  if (!document.fullscreenEnabled || !mapElement.requestFullscreen) {
    mapElement.dataset.fullscreenControl = 'unavailable';
    return;
  }

  const container = L.DomUtil.create(
    'div',
    'leaflet-bar leaflet-control leaflet-control-fullscreen',
  );
  const button = L.DomUtil.create(
    'button',
    'leaflet-control-fullscreen-button',
    container,
  ) as HTMLButtonElement;
  button.type = 'button';
  button.setAttribute('aria-pressed', 'false');
  button.setAttribute('aria-label', fullscreenEnterLabel);
  button.title = fullscreenEnterLabel;
  button.innerHTML = `
    <svg class="fullscreen-enter-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 3H3v6M15 3h6v6M21 15v6h-6M9 21H3v-6"></path>
    </svg>
    <svg class="fullscreen-exit-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 9h6V3M21 9h-6V3M21 15h-6v6M3 15h6v6"></path>
    </svg>
  `;

  const control = new L.Control({ position: 'topright' });
  control.onAdd = () => container;
  control.addTo(map);
  L.DomEvent.disableClickPropagation(container);
  L.DomEvent.disableScrollPropagation(container);
  mapElement.dataset.fullscreenControl = 'enabled';

  let active = false;
  const sync = () => {
    const nextActive = document.fullscreenElement === mapElement;
    if (nextActive === active) return;
    const center = map.getCenter();
    const zoom = map.getZoom();
    active = nextActive;
    const label = active ? fullscreenExitLabel : fullscreenEnterLabel;
    button.setAttribute('aria-pressed', String(active));
    button.setAttribute('aria-label', label);
    button.title = label;
    mapElement.dataset.fullscreen = String(active);
    requestAnimationFrame(() => {
      map.invalidateSize({ animate: false, pan: false });
      map.setView(center, zoom, { animate: false });
    });
  };

  button.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      if (document.fullscreenElement === mapElement) await document.exitFullscreen();
      else await mapElement.requestFullscreen();
    } catch {
      control.remove();
      mapElement.dataset.fullscreenControl = 'unavailable';
    }
  });
  document.addEventListener('fullscreenchange', sync);
};

let trackControlId = 0;

const createTrackLayerControl = (map: L.Map, mapElement: HTMLElement) => {
  const container = L.DomUtil.create('div', 'leaflet-control track-layer-control');
  const toggle = L.DomUtil.create(
    'button',
    'leaflet-bar track-layer-toggle',
    container,
  ) as HTMLButtonElement;
  const panel = L.DomUtil.create('div', 'track-layer-panel', container);
  const fieldset = document.createElement('fieldset');
  const legend = document.createElement('legend');
  const list = document.createElement('div');

  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', 'Prikaži izbor GPX tragova');
  toggle.title = 'Prikaži izbor GPX tragova';
  toggle.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 3 8 4-8 4-8-4 8-4Z"></path>
      <path d="m4 12 8 4 8-4M4 17l8 4 8-4"></path>
    </svg>
  `;
  panel.hidden = true;
  legend.textContent = 'GPX tragovi';
  list.className = 'track-layer-list';
  fieldset.append(legend, list);
  panel.append(fieldset);
  container.hidden = true;
  container.dataset.trackControl = 'ready';
  mapElement.dataset.trackControl = 'enabled';

  const control = new L.Control({ position: 'topright' });
  control.onAdd = () => container;
  control.addTo(map);
  L.DomEvent.disableClickPropagation(container);
  L.DomEvent.disableScrollPropagation(container);

  const setOpen = (open: boolean) => {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    const label = open ? 'Sakrij izbor GPX tragova' : 'Prikaži izbor GPX tragova';
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
    if (open) list.querySelector<HTMLInputElement>('input')?.focus();
  };

  toggle.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    setOpen(panel.hidden);
  });
  container.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || panel.hidden) return;
    event.stopPropagation();
    setOpen(false);
    toggle.focus();
  });

  return {
    addTrack(
      track: Pick<GpxTrackConfig, 'label' | 'color'>,
      setVisible: (visible: boolean) => void,
    ) {
      trackControlId += 1;
      const label = document.createElement('label');
      const input = document.createElement('input');
      const swatch = document.createElement('i');
      const name = document.createElement('span');

      input.type = 'checkbox';
      input.id = `track-layer-${trackControlId}`;
      input.checked = true;
      input.addEventListener('change', () => setVisible(input.checked));
      swatch.setAttribute('aria-hidden', 'true');
      swatch.style.setProperty('--track-color', track.color);
      name.textContent = track.label;
      label.htmlFor = input.id;
      label.append(input, swatch, name);
      list.append(label);
      container.hidden = false;
      toggle.disabled = false;
    },
    clear() {
      list.replaceChildren();
      fieldset.disabled = false;
      container.hidden = true;
      toggle.disabled = true;
      setOpen(false);
    },
    setDisabled(disabled: boolean) {
      fieldset.disabled = disabled;
      toggle.disabled = disabled || !list.childElementCount;
      if (disabled) setOpen(false);
    },
  };
};

export const initialiseGpxMaps = () => {
  document.querySelectorAll<HTMLElement>('[data-gpx-map]:not([data-ready])').forEach(async (element) => {
    element.dataset.ready = 'true';
    const status = element.querySelector<HTMLElement>('.map-status');
    const tracks = JSON.parse(element.dataset.tracks ?? '[]') as GpxTrackConfig[];
    const map = L.map(element, {
      scrollWheelZoom: true,
      touchZoom: true,
    });
    addFullscreenControl(map, element);
    const trackControl = createTrackLayerControl(map, element);
    element.dataset.scrollWheelZoom = map.scrollWheelZoom.enabled() ? 'enabled' : 'disabled';
    element.dataset.touchZoom = map.touchZoom.enabled() ? 'enabled' : 'disabled';

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const bounds = L.latLngBounds([]);
    const failures: string[] = [];

    const loadedTracks = await Promise.all(
      tracks.map(async (track) => {
        try {
          const segments = await loadGpx(track.src);
          const trackLayer = L.layerGroup();
          segments.forEach((points) => {
            const line = L.polyline(points, {
              color: track.color,
              weight: 5,
              opacity: 0.9,
            })
              .bindTooltip(track.label)
              .addTo(trackLayer);

            if (track.title || track.href) line.bindPopup(createTrackPopup(track));
            points.forEach((point) => bounds.extend(point));
          });
          return { track, trackLayer };
        } catch (error) {
          failures.push(`${track.label}: ${error instanceof Error ? error.message : 'nepoznata greška'}`);
          return undefined;
        }
      }),
    );

    loadedTracks.forEach((loaded) => {
      if (!loaded) return;
      loaded.trackLayer.addTo(map);
      trackControl.addTrack(loaded.track, (visible) => {
        if (visible) loaded.trackLayer.addTo(map);
        else loaded.trackLayer.removeFrom(map);
      });
    });

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [28, 28] });
    } else {
      map.setView(SERBIA_CENTER, SERBIA_ZOOM);
    }

    if (status) {
      if (failures.length) {
        status.textContent = `Neki tragovi nisu učitani — ${failures.join('; ')}`;
        status.classList.add('has-error');
      } else {
        status.remove();
      }
    }
  });
};

interface MarkerCluster {
  hikes: ExplorerHikeConfig[];
  point: L.Point;
}

const clusterHikes = (hikes: ExplorerHikeConfig[], map: L.Map) => {
  const zoom = map.getZoom();
  const radius = zoom <= 7 ? 280 : zoom <= 8 ? 90 : 55;
  const clusters: MarkerCluster[] = [];

  hikes.forEach((hike) => {
    const point = map.project([hike.trailhead.lat, hike.trailhead.lng], zoom);
    const cluster = clusters.find((candidate) => candidate.point.distanceTo(point) < radius);

    if (!cluster) {
      clusters.push({ hikes: [hike], point });
      return;
    }

    cluster.hikes.push(hike);
    cluster.point = L.point(
      cluster.hikes.reduce(
        (sum, item) => sum + map.project([item.trailhead.lat, item.trailhead.lng], zoom).x,
        0,
      ) / cluster.hikes.length,
      cluster.hikes.reduce(
        (sum, item) => sum + map.project([item.trailhead.lat, item.trailhead.lng], zoom).y,
        0,
      ) / cluster.hikes.length,
    );
  });

  return clusters;
};

const createTrailheadPopup = (
  hike: ExplorerHikeConfig,
  onSelect: (hike: ExplorerHikeConfig) => void,
) => {
  const popup = document.createElement('div');
  popup.className = 'trailhead-popup';

  const title = document.createElement('strong');
  title.textContent = hike.title;
  popup.append(title);

  const location = document.createElement('span');
  location.textContent = `${hike.mountain} · ${hike.country}`;
  popup.append(location);

  if (hike.trailhead.label) {
    const trailhead = document.createElement('small');
    trailhead.textContent = `Polazište: ${hike.trailhead.label}`;
    popup.append(trailhead);
  }

  const actions = document.createElement('div');
  const select = document.createElement('button');
  select.type = 'button';
  select.textContent = 'Prikaži GPX trag';
  select.addEventListener('click', () => onSelect(hike));

  const link = document.createElement('a');
  link.href = hike.href;
  link.textContent = 'Detalji ture →';
  actions.append(select, link);
  popup.append(actions);

  return popup;
};

export const initialiseTrailExplorers = () => {
  document
    .querySelectorAll<HTMLElement>('[data-trail-explorer]:not([data-ready])')
    .forEach((explorer) => {
      explorer.dataset.ready = 'true';
      const mapElement = explorer.querySelector<HTMLElement>('[data-explorer-map]');
      const status = explorer.querySelector<HTMLElement>('[data-explorer-status]');
      const selectionPanel = explorer.querySelector<HTMLElement>('[data-selection-panel]');
      const reset = explorer.querySelector<HTMLButtonElement>('[data-explorer-reset]');
      const visibilityToggle =
        explorer.querySelector<HTMLButtonElement>('[data-route-visibility]');
      const downloads = explorer.querySelector<HTMLElement>('[data-selected-downloads]');
      const selectedDetail = explorer.querySelector<HTMLAnchorElement>('[data-selected-detail]');
      const selectButtons = [
        ...explorer.querySelectorAll<HTMLButtonElement>('[data-hike-select]'),
      ];
      const hikes = JSON.parse(explorer.dataset.hikes ?? '[]') as ExplorerHikeConfig[];

      if (
        !mapElement ||
        !status ||
        !selectionPanel ||
        !reset ||
        !visibilityToggle ||
        !downloads ||
        !selectedDetail
      ) return;

      const map = L.map(mapElement, {
        center: SERBIA_CENTER,
        zoom: SERBIA_ZOOM,
        scrollWheelZoom: true,
        touchZoom: true,
      });
      addFullscreenControl(map, mapElement);
      const trackControl = createTrackLayerControl(map, mapElement);
      trackControl.clear();
      mapElement.dataset.initialCenter = SERBIA_CENTER.join(',');
      mapElement.dataset.initialZoom = String(SERBIA_ZOOM);
      mapElement.dataset.scrollWheelZoom = map.scrollWheelZoom.enabled() ? 'enabled' : 'disabled';
      mapElement.dataset.touchZoom = map.touchZoom.enabled() ? 'enabled' : 'disabled';

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const markerLayer = L.layerGroup().addTo(map);
      const routeLayer = L.layerGroup().addTo(map);
      let activeRequest = 0;
      let controller: AbortController | undefined;

      const setRouteVisibility = (
        state: 'loading' | 'visible' | 'hidden' | 'unavailable',
      ) => {
        const available = state === 'visible' || state === 'hidden';
        const visible = state === 'visible';
        const keepLayerOnMap = visible || state === 'loading';

        if (keepLayerOnMap && !map.hasLayer(routeLayer)) routeLayer.addTo(map);
        if (!keepLayerOnMap && map.hasLayer(routeLayer)) routeLayer.removeFrom(map);

        visibilityToggle.disabled = !available;
        visibilityToggle.dataset.routeState = state;
        visibilityToggle.setAttribute('aria-pressed', String(visible));
        visibilityToggle.textContent =
          state === 'visible'
            ? 'Sakrij trag'
            : state === 'hidden'
              ? 'Prikaži trag'
              : state === 'unavailable'
                ? 'Trag nije dostupan'
                : 'Trag se učitava…';
        mapElement.dataset.routeVisible = String(visible);
        trackControl.setDisabled(!visible);
      };

      const setActiveButton = (hikeId?: string) => {
        selectButtons.forEach((button) => {
          button.setAttribute('aria-pressed', String(button.dataset.hikeSelect === hikeId));
        });
      };

      const setSelectionLinks = (hike: ExplorerHikeConfig) => {
        downloads.replaceChildren(
          ...hike.tracks.map((track) => {
            const link = document.createElement('a');
            const fileName = decodeURIComponent(track.src.split('/').pop() ?? 'planinarski-trag.gpx');
            link.href = track.src;
            link.download = fileName;
            link.textContent = `${track.label} (${fileName})`;
            link.setAttribute('aria-label', `Preuzmi GPX trag ${track.label}`);
            return link;
          }),
        );
        selectedDetail.href = hike.href;
        selectedDetail.setAttribute('aria-label', `Otvori detalje ture ${hike.title}`);
      };

      const selectHike = async (hike: ExplorerHikeConfig) => {
        activeRequest += 1;
        const request = activeRequest;
        controller?.abort();
        controller = new AbortController();
        setRouteVisibility('loading');
        routeLayer.clearLayers();
        trackControl.clear();
        setActiveButton(hike.id);
        setSelectionLinks(hike);
        selectionPanel.hidden = false;
        status.classList.remove('has-error');
        status.textContent = `Učitavanje tragova: ${hike.title}…`;
        map.closePopup();
        map.flyTo([hike.trailhead.lat, hike.trailhead.lng], Math.max(map.getZoom(), 8));

        const bounds = L.latLngBounds([]);
        const failures: string[] = [];
        const loadedTrackLayers: Array<
          { track: GpxTrackConfig; trackLayer: L.LayerGroup } | undefined
        > = [];

        await Promise.all(
          hike.tracks.map(async (track, index) => {
            try {
              const segments = await loadGpx(track.src, controller?.signal);
              if (request !== activeRequest) return;
              const trackLayer = L.layerGroup();
              segments.forEach((points) => {
                L.polyline(points, {
                  color: track.color,
                  weight: 5,
                  opacity: 0.92,
                })
                  .bindTooltip(track.label)
                  .addTo(trackLayer);
                points.forEach((point) => bounds.extend(point));
              });
              loadedTrackLayers[index] = { track, trackLayer };
            } catch (error) {
              if (error instanceof DOMException && error.name === 'AbortError') return;
              failures.push(`${track.label}: ${error instanceof Error ? error.message : 'nepoznata greška'}`);
            }
          }),
        );

        if (request !== activeRequest) return;
        const loadedTracks = loadedTrackLayers.filter(
          (loaded): loaded is { track: GpxTrackConfig; trackLayer: L.LayerGroup } =>
            Boolean(loaded),
        );
        loadedTracks.forEach(({ track, trackLayer }) => {
          routeLayer.addLayer(trackLayer);
          trackControl.addTrack(track, (visible) => {
            if (visible) routeLayer.addLayer(trackLayer);
            else routeLayer.removeLayer(trackLayer);
          });
        });
        if (bounds.isValid()) map.fitBounds(bounds, { padding: [36, 36], maxZoom: 13 });
        setRouteVisibility(loadedTracks.length > 0 ? 'visible' : 'unavailable');
        mapElement.dataset.loadedTrackCount = String(loadedTracks.length);

        if (failures.length) {
          status.textContent = loadedTracks.length
            ? `Prikazano ${loadedTracks.length} od ${hike.tracks.length} tragova. Neuspešno: ${failures.join('; ')}`
            : `Tragovi nisu učitani — ${failures.join('; ')}`;
          status.classList.add('has-error');
        } else {
          status.textContent = `Prikazano ${loadedTracks.length} ${loadedTracks.length === 1 ? 'GPX trag' : 'GPX traga'}: ${hike.title}`;
        }
      };

      const renderMarkers = () => {
        markerLayer.clearLayers();
        const clusters = clusterHikes(hikes, map);
        mapElement.dataset.clusterCount = String(
          clusters.filter((cluster) => cluster.hikes.length > 1).length,
        );
        mapElement.dataset.markerGroupCount = String(clusters.length);

        clusters.forEach((cluster) => {
          if (cluster.hikes.length > 1) {
            const bounds = L.latLngBounds(
              cluster.hikes.map((hike) => [hike.trailhead.lat, hike.trailhead.lng]),
            );
            const marker = L.marker(bounds.getCenter(), {
              icon: L.divIcon({
                className: 'trailhead-cluster-shell',
                html: `<span>${cluster.hikes.length}</span>`,
                iconSize: [44, 44],
                iconAnchor: [22, 22],
              }),
              keyboard: true,
              title: `${cluster.hikes.length} obližnje ture`,
            });
            marker.on('click', () => map.fitBounds(bounds, { padding: [55, 55], maxZoom: 10 }));
            marker.addTo(markerLayer);
            return;
          }

          const hike = cluster.hikes[0];
          const marker = L.marker([hike.trailhead.lat, hike.trailhead.lng], {
            icon: L.divIcon({
              className: 'trailhead-marker-shell',
              html: `<span style="--marker-color: ${hike.color}"></span>`,
              iconSize: [30, 38],
              iconAnchor: [15, 34],
              popupAnchor: [0, -30],
            }),
            keyboard: true,
            title: hike.title,
            alt: `Polazište ture ${hike.title}`,
          });
          marker.bindPopup(createTrailheadPopup(hike, selectHike)).addTo(markerLayer);
        });
      };

      selectButtons.forEach((button) => {
        button.addEventListener('click', () => {
          const hike = hikes.find((item) => item.id === button.dataset.hikeSelect);
          if (hike) selectHike(hike);
        });
      });

      visibilityToggle.addEventListener('click', () => {
        const visible = map.hasLayer(routeLayer);
        setRouteVisibility(visible ? 'hidden' : 'visible');
      });

      reset.addEventListener('click', () => {
        activeRequest += 1;
        controller?.abort();
        routeLayer.clearLayers();
        trackControl.clear();
        setRouteVisibility('unavailable');
        mapElement.dataset.loadedTrackCount = '0';
        selectionPanel.hidden = true;
        status.classList.remove('has-error');
        status.textContent = '';
        downloads.replaceChildren();
        selectedDetail.removeAttribute('href');
        setActiveButton();
        map.setView(SERBIA_CENTER, SERBIA_ZOOM);
      });

      const updateMapState = () => {
        const center = map.getCenter();
        mapElement.dataset.currentCenter = `${center.lat.toFixed(4)},${center.lng.toFixed(4)}`;
        mapElement.dataset.currentZoom = String(map.getZoom());
      };

      map.on('zoomend', renderMarkers);
      map.on('moveend zoomend', updateMapState);
      renderMarkers();
      updateMapState();
    });
};
