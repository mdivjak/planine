---
layout: default
---

# Fruška gora

## Vrdnik - Zmajevac - Stari Rakovac - Beli Majdan

[GPX fajl](./fruska-gora-1.gpx)

<div id="map" style="height:400px;"></div>
<script type="module">
    const map = L.map('map');
    L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: 'Map data &copy; <a href="http://www.osm.org">OpenStreetMap</a>'
    }).addTo(map);

    // URL to your GPX file or the GPX itself as a XML string.
    const url = './fruska-gora-1.gpx';
    const options = {
        async: true,
        polyline_options: { color: 'red' },
    };

    const gpx = new L.GPX(url, options).on('loaded', (e) => {
        map.fitBounds(e.target.getBounds());
    }).addTo(map);
</script>

## Manastir Novo Hopovo - Iriški venac

[GPX fajl](./fruska-gora-2.gpx)

<div id="map2" style="height:400px;"></div>
<script type="module">
    const map = L.map('map2');
    L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: 'Map data &copy; <a href="http://www.osm.org">OpenStreetMap</a>'
    }).addTo(map);

    // URL to your GPX file or the GPX itself as a XML string.
    const url = './fruska-gora-2.gpx';
    const options = {
        async: true,
        polyline_options: { color: 'red' },
    };

    const gpx = new L.GPX(url, options).on('loaded', (e) => {
        map.fitBounds(e.target.getBounds());
    }).addTo(map);
</script>