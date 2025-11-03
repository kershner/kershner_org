const imageUrl = window.daggerwalkMap.imageUrl;
const imageWidth = 1000, imageHeight = 500;
const bounds = [[0, 0], [imageHeight, imageWidth]];
const SCALAR = 0.15, BASE_EMOJI_SIZE = 14, DOT_COLOR = 'red';
let map, poiLayer, logLayer, questLayer, regionShapeLayer;

function setupMap() {
  const imgBounds = (bounds instanceof L.LatLngBounds) ? bounds : L.latLngBounds(bounds);
  const imageLayer = L.imageOverlay(imageUrl, imgBounds);

  const map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: 0,
    maxZoom: 6,
    zoomControl: false,
    zoomAnimation: true,
    markerZoomAnimation: true,
    fadeAnimation: true,
    inertia: true,
    wheelPxPerZoomLevel: 120,
    scrollWheelZoom: 'center',
    zoomSnap: 0.25,
    zoomDelta: 0.5,
    bounceAtZoomLimits: false,
    maxBoundsViscosity: 1.0,
    attributionControl: false,
    preferCanvas: true,
    renderer: L.canvas(),
    dragging: true,
    touchZoom: true,
    doubleClickZoom: false,
    keyboard: false
  });

  imageLayer.addTo(map);
  map.fitBounds(imgBounds);
  map.setMaxBounds(imgBounds.pad(0.5));

  // Controls
  L.control.scale({ position: 'bottomleft', imperial: false }).addTo(map);
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // Fullscreen control
  if (L.control.fullscreen) {
    L.control.fullscreen({ position: 'topleft' }).addTo(map);
  }

  return { map, imageLayer, imgBounds };
}

function createClusterGroup() {
  const clusterGroup = L.markerClusterGroup({
    maxClusterRadius: zoom => Math.min(200, 90 - zoom * 5),
    disableClusteringAtZoom: 3,
    chunkedLoading: true,
    chunkInterval: 100,
    chunkDelay: 30,
    removeOutsideVisibleBounds: true,
    animate: false,
    spiderfyOnMaxZoom: false,
    showCoverageOnHover: false,

    iconCreateFunction: cluster => {
      const markers = cluster.getAllChildMarkers();
      const count = cluster.getChildCount();
      const zoom = map.getZoom ? map.getZoom() : 1;
      const scale = Math.max(0.6, 1 - (2 - Math.min(zoom, 2)) * SCALAR);
      const hasLatest = markers.some(m => m.options.isLatest);
      const isPOICluster = markers.every(m => m.options.isPOI);

      const cls = [
        "custom-cluster",
        isPOICluster ? "poi-cluster" : "log-cluster",
        hasLatest ? "latest-log" : ""
      ].join(" ");

      const html = isPOICluster
        ? `<div class="cluster-circle">
             <span class="cluster-emoji">📍</span>
             <span class="cluster-count">${count}</span>
           </div>`
        : `<div class="cluster-icon"></div>`;

      return L.divIcon({
        html,
        className: cls,
        iconSize: [36 * scale, 36 * scale],
      });
    },
  });

  attachClusterTooltip(clusterGroup);
  return clusterGroup;
}

function attachClusterTooltip(clusterGroup) {
  clusterGroup.on('clustermouseover', e => {
    const markers = e.layer.getAllChildMarkers();

    // only show for log clusters
    const isLogCluster = markers.some(m => !m.options.isPOI && !m.options.isQuest);
    if (!isLogCluster) return;

    const logs = markers
      .map(m => m.options.item)
      .filter(i => i?.created_at)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    const count = logs.length;
    const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const range = count > 1 ? `${fmt(new Date(logs[0].created_at))} – ${fmt(new Date(logs[count - 1].created_at))}` : '';

    const html = `<div style="text-align:center;">
      <b>${count}</b> logs<br>${range || ''}
    </div>`;

    e.layer.bindTooltip(html, { direction: 'top', offset: [0, -10] }).openTooltip();
  });
}

function drawLogTrail(clusterGroup) {
  if (!map) return;

  // remove existing trail
  if (map._logTrail) {
    map.removeLayer(map._logTrail);
    map._logTrail = null;
  }

  // collect visible cluster centers only (ignores individual markers)
  const centers = [];
  clusterGroup._featureGroup.eachLayer(layer => {
    if (layer instanceof L.MarkerCluster) {
      const markers = layer.getAllChildMarkers();
      const isLogCluster = markers.some(m => !m.options.isPOI && !m.options.isQuest);
      if (isLogCluster) centers.push({ latlng: layer.getLatLng(), markers });
    }
  });

  if (centers.length < 2) return;

  // sort by earliest log timestamp in each cluster
  centers.sort((a, b) => {
    const aTime = Math.min(...a.markers.map(m => new Date(m.options.item?.created_at || 0)));
    const bTime = Math.min(...b.markers.map(m => new Date(m.options.item?.created_at || 0)));
    return aTime - bTime;
  });

  const points = centers.map(c => c.latlng);

  // create dotted polyline
  const color = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim()
  const trail = L.polyline(points, {
    color: color,
    weight: 2,
    opacity: 1,
    dashArray: '5,8'
  }).addTo(map);

  map._logTrail = trail;
}

// Marker icon styles
function makeIcon({ emoji, scale = 1, dot = false, quest = false, highlight = false }) {
  if (dot)
    return L.divIcon({
      html: `<div></div>`,
      className: highlight ? "log-marker latest-log" : "log-marker",
      iconSize: [6, 6],
      iconAnchor: [3, 3],
    });
  if (quest)
    return L.divIcon({
      html: `<span>${emoji || "⭐"}</span>`,
      className: "quest-marker",
      iconSize: [22 * scale, 22 * scale],
      iconAnchor: [11 * scale, 11 * scale],
    });
  return L.divIcon({
    html: `<span style="font-size:${BASE_EMOJI_SIZE * scale}px">${emoji || "📍"}</span>`,
    className: "poi-marker",
    iconSize: [20 * scale, 20 * scale],
    iconAnchor: [10 * scale, 10 * scale],
  });
}

// Hover popup builder for logs, quests, and POIs
function popupHtml(item) {
  const questData = item.poi || null;
  const isQuest = !!item.quest_name;
  const isLog = !!item.player_x && !isQuest;
  const source = questData || item;
  const emoji = source.emoji || source.region?.emoji || "📍";
  const name = source.name || item.quest_name || item.location || "(Unknown)";
  const region = source.region?.name || source.region_fk?.name || "";
  const province = source.region?.province || source.region_fk?.province || "";
  let html = `<div style="min-width:180px;font-family:sans-serif">
                <div style="font-size:16px;font-weight:bold;margin-bottom:4px">${emoji} ${name}</div>
                <div style="color:#666">${region}${province ? `, ${province}` : ""}</div>`;
  if (isQuest) {
    html += `<div style="margin-top:6px;font-style:italic">${item.description || ""}</div>`;
    if (item.quest_giver_name) html += `<div><b>Quest Giver:</b> ${item.quest_giver_name}</div>`;
    if (item.xp) html += `<div><b>XP:</b> ${item.xp}</div>`;
    if (item.quest_giver_img_url)
      html += `<img src="${item.quest_giver_img_url}" width="64" height="64"
                style="border-radius:4px;margin-top:6px">`;
  } else if (isLog) {
    const weather = item.weather || "";
    const song = item.current_song ? item.current_song.replace("song_", "") : "";
    html += `<div style="margin-top:6px"><b>Weather:</b> ${weather || "—"}</div>
             <div><b>Season:</b> ${item.season || "—"}</div>
             ${song ? `<div><b>Song:</b> 🎵 ${song}</div>` : ""}
             <hr style="margin:6px 0;border:none;border-top:1px solid #ccc">
             <div><b>Date:</b> ${item.date}</div>
             <div><b>Recorded:</b> ${new Date(item.created_at).toLocaleString("en-US")}</div>
             <div style="margin-top:4px;font-size:12px;color:#666">
             <b>Coords:</b> X${item.player_x}, Y${item.player_y}, Z${item.player_z}</div>`;
  } else {
    if (source.type) html += `<div style="margin-top:6px"><i>${source.type}</i></div>`;
    if (source.description) html += `<div>${source.description}</div>`;
    if (source.discovered)
      html += `<div style="font-size:12px;color:#666">
               Discovered: ${new Date(source.discovered).toLocaleDateString("en-US")}</div>`;
  }
  return html + "</div>";
}

// Marker creation
function createMarker(lat, lng, icon, item) {
  const marker = L.marker([lat, lng], { icon });

  // attach the full data object for cluster tooltips later
  marker.options.item = item;

  return marker
    .bindPopup(popupHtml(item))
    .on("mouseover", e => e.target.openPopup())
    .on("mouseout", e => e.target.closePopup());
}

function buildLayer(data, { isPOI = false, isQuest = false, highlightId = null }) {
  const layer = createClusterGroup();
  data.forEach(item => {
    let lat, lng, icon;
    if (isQuest) {
      const poi = item.poi;
      lat = imageHeight - poi.map_pixel_y;
      lng = poi.map_pixel_x;
      icon = makeIcon({ emoji: poi.emoji, quest: true });
    } else {
      lat = imageHeight - item.map_pixel_y;
      lng = item.map_pixel_x;
      const highlight = highlightId && item.id === highlightId;
      icon = isPOI ? makeIcon({ emoji: item.emoji }) : makeIcon({ dot: true, highlight });
    }
    const marker = createMarker(lat, lng, icon, item);
    if (isPOI) marker.options.isPOI = true;
    if (!isPOI && !isQuest && highlightId && item.id === highlightId) {
        marker.options.isLatest = true;
    }
    if (marker.options.isLatest) marker._icon?.classList.add('latest-log');
    layer.addLayer(marker);
  });
  return layer;
}

function highlightLatestMarker() {
  // Wait a bit so clusters render first
  setTimeout(() => {
    // Find the Leaflet marker element tagged as latest
    const latestMarker = document.querySelector('.log-marker.latest-log');
    if (!latestMarker) return;

    // Highlight the cluster that contains it (if any)
    const cluster = latestMarker.closest('.marker-cluster');
    if (cluster) cluster.classList.add('latest-log');
  }, 300);
}

// Compute coordinate scaling for region outlines
function projectShapePoint(x, y) {
  const sx = imageWidth / SHAPE_EXTENTS.spanX;
  const sy = imageHeight / SHAPE_EXTENTS.spanY;
  const px = (x - SHAPE_EXTENTS.minX) * sx + 15;
  const py = (y - SHAPE_EXTENTS.minY) * sy;
  return [imageHeight - py, px];
}

function drawRegionShapes(show = true) {
  const shapes = window.shapes || []
  if (regionShapeLayer) map.removeLayer(regionShapeLayer);
  if (!show) return;
  regionShapeLayer = L.layerGroup();
  shapes.forEach(shape => {
    const points = shape.coordinates.map(([x, y]) => projectShapePoint(x, y));
    const poly = L.polygon(points, { opacity: 0, fillOpacity: 0 }).addTo(regionShapeLayer);
    const center = poly.getBounds().getCenter();
    L.marker(center, {
      icon: L.divIcon({ className: 'region-label', html: shape.name, iconSize: [100, 20] })
    }).addTo(regionShapeLayer);
  });
  regionShapeLayer.addTo(map);
}

function bindUIEvents() {
  const toggle = (id, layer) =>
    document.getElementById(id).addEventListener("change", e => {
      if (e.target.checked) {
        map.addLayer(layer);
        drawLogTrail(logLayer);
      } else {
        map.removeLayer(layer);
        if (map._logTrail) {
          map.removeLayer(map._logTrail);
          map._logTrail = null;
        }
      }
    });

  toggle("toggle-pois", poiLayer);
  toggle("toggle-logs", logLayer);
  toggle("toggle-quest", questLayer);
  document.getElementById("toggle-shapes").addEventListener("change", e => drawRegionShapes(e.target.checked));
}

// Main entry point
function daggerwalkMapInit() {
  // assign destructured return so global "map" is defined
  const { map: leafletMap } = setupMap();
  map = leafletMap; // make it global for other functions

  const pois = JSON.parse(document.getElementById('poi-data').textContent);
  const logs = JSON.parse(document.getElementById('logs-data').textContent);
  const quest = JSON.parse(document.getElementById('quest-data').textContent);
  window.shapes = JSON.parse(document.getElementById('shape-data').textContent);

  window.SHAPE_EXTENTS = (() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    (window.shapes || []).forEach(s => s.coordinates.forEach(([x, y]) => {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
    }));
    return { minX, minY, maxX, maxY, spanX: maxX - minX, spanY: maxY - minY };
  })();

  const latest = logs.reduce((a, b) =>
    new Date(a.created_at) > new Date(b.created_at) ? a : b, logs[0]);

  poiLayer = buildLayer(pois, { isPOI: true });
  logLayer = buildLayer(logs, { highlightId: latest.id });
  questLayer = buildLayer(quest, { isQuest: true });

  map.addLayer(logLayer);
  map.addLayer(questLayer);
  highlightLatestMarker();
  bindUIEvents();

  drawLogTrail(logLayer);
  map.on('zoomend moveend', () => drawLogTrail(logLayer));
  logLayer.on('layeradd layerremove', () => drawLogTrail(logLayer));
}