const imageUrl = window.daggerwalkMap.imageUrl;
const imageWidth = 1000, imageHeight = 500;
const bounds = [[0, 0], [imageHeight, imageWidth]];
const SCALAR = 0.15, BASE_EMOJI_SIZE = 14, DOT_COLOR = 'red';
const refreshDataUrl = '/daggerwalk/refresh-data/';
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

  // Fullscreen control
  if (L.control.fullscreen) {
    L.control.fullscreen({ position: 'topleft' }).addTo(map);
  }

  return { map, imageLayer, imgBounds };
}

function createClusterGroup(isPOI = false) {
  const clusterGroup = L.markerClusterGroup({
    maxClusterRadius: 180,
    disableClusteringAtZoom: isPOI ? 3 : 2,
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
function makeIcon({ emoji, dot = false, quest = false, highlight = false }) {
  const baseClass = "map-marker";

  if (dot)
    return L.divIcon({
      html: `<div>${emoji || ""}</div>`,
      className: `${baseClass} log-marker${highlight ? " latest-log" : ""}`,
      iconSize: [8, 8],
      iconAnchor: [4, 4]
    });

  if (quest)
    return L.divIcon({
      html: `<div>${emoji || "⭐"}</div>`,
      className: `${baseClass} quest-marker`,
      iconSize: [8, 8],
      iconAnchor: [4, 4]
    });

  return L.divIcon({
    html: `<div>${emoji || "📍"}</div>`,
    className: `${baseClass} poi-marker`,
    iconSize: [8, 8],
    iconAnchor: [4, 4]
  });
}

// Hover popup builder for logs, quests, and POIs
function popupHtml(item) {
  const tpl = document.getElementById("popup-template");
  const el = tpl.content.cloneNode(true);
  const title = el.querySelector(".popup-title");
  const subtitle = el.querySelector(".popup-subtitle");
  const body = el.querySelector(".popup-body");

  const WEATHER_EMOJIS = {
    Sunny: "☀️",
    Clear: "🌙",
    Overcast: "🌥️",
    Cloudy: "☁️",
    Foggy: "🌫️",
    Rainy: "🌧️",
    Snowy: "🌨️",
    Thunderstorm: "⛈️"
  };

  const SEASON_EMOJIS = {
    Winter: "☃️",
    Spring: "🌸",
    Summer: "🌻",
    Autumn: "🍂"
  };

  const isQuest = !!item.quest_name;
  const isLog = !!item.player_x && !isQuest;
  const source = item.poi || item;

  // Only use source.region if it's an object, not a string
  const region =
    (typeof source.region === "object" && source.region) ||
    item.region_fk ||
    {};

  const regionEmoji = region.emoji || "";
  const regionName = region.name || "";
  const province = region.province || "";
  const climate = region.climate || "";

  // Title & subtitle
  title.textContent = `${source.emoji || regionEmoji || "📍"} ${
    source.name || item.quest_name || item.location || "(Unknown)"
  }`;
  subtitle.textContent = [regionName, province].filter(Boolean).join(", ");

  const add = html => (body.innerHTML += html);

  if (isQuest) {
    add(
      [
        item.description && `<div class="popup-description">${item.description}</div>`,
        item.quest_giver_name && `<div><b>Quest Giver:</b> ${item.quest_giver_name}</div>`,
        item.xp && `<div><b>XP:</b> ${item.xp}</div>`,
        item.quest_giver_img_url &&
          `<img src="${item.quest_giver_img_url}" width="64" height="64" class="popup-quest-img">`,
      ]
        .filter(Boolean)
        .join("")
    );
  } else if (isLog) {
    const weatherEmoji = WEATHER_EMOJIS[item.weather] || "";
    const seasonEmoji = SEASON_EMOJIS[item.season] || "";
    const song = item.current_song?.replace("song_", "");

    add(`
      <div><b>Weather:</b> ${weatherEmoji} ${item.weather || "—"}</div>
      <div><b>Season:</b> ${seasonEmoji} ${item.season || "—"}</div>
      <div><b>Climate:</b> ${regionEmoji} ${climate || "—"}</div>
      ${song ? `<div><b>Song:</b> 🎵 ${song}</div>` : ""}
      <hr class="popup-divider">
      <div><b>Date:</b> ${item.date}</div>
      <div><b>Recorded:</b> ${new Date(item.created_at).toLocaleString("en-US")}</div>
      <div class="popup-coords"><b>Coords:</b> X${item.player_x}, Y${item.player_y}, Z${item.player_z}</div>
    `);
  } else {
    add(
      [
        source.description && `<div>${source.description}</div>`,
        source.discovered &&
          `<div class="popup-discovered">Discovered: ${new Date(source.discovered).toLocaleDateString("en-US")}</div>`,
      ]
        .filter(Boolean)
        .join("")
    );
  }

  return el.firstElementChild.outerHTML;
}

// Marker creation
function createMarker(lat, lng, icon, item) {
  const marker = L.marker([lat, lng], { icon });
  marker.options.item = item;

  // Configure popup — stays open on touch until user closes it
  marker.bindPopup(popupHtml(item), {
    autoPan: false,
    closeOnClick: true,  // clicking another popup closes the previous one
    closeButton: true,
  });

  // Detect touch vs. mouse devices
  const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;

  if (isTouch) {
    // On touch devices: tap to open (handled by Leaflet)
    marker.on("click", e => {
      e.originalEvent.stopPropagation();
      e.target.openPopup();
    });
  } else {
    // On mouse devices: hover only
    marker.on("mouseover", e => e.target.openPopup());
    marker.on("mouseout", e => e.target.closePopup());
  }

  return marker;
}

function buildLayer(data, { isPOI = false, isQuest = false, highlightId = null }) {
  const layer = createClusterGroup(isPOI);
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
      icon = isPOI ? makeIcon({ emoji: item.emoji }) : makeIcon({ emoji: item.emoji, dot: true, highlight });
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

async function refreshMapData() {
  const btn = document.getElementById("refresh-map");
  btn.disabled = true;
  btn.textContent = "Refreshing...";

  try {
    const res = await fetch(refreshDataUrl);
    if (!res.ok) throw new Error("Failed to refresh map data");
    const data = await res.json();

    // Update JSON script contents so filters use fresh data
    document.getElementById("logs-data").textContent = JSON.stringify(data.logs);
    document.getElementById("poi-data").textContent = JSON.stringify(data.pois);
    document.getElementById("quest-data").textContent = JSON.stringify(data.quests);
    document.getElementById("shape-data").textContent = JSON.stringify(data.shapes);

    // Remove old layers
    [logLayer, poiLayer, questLayer].forEach(layer => {
      if (map.hasLayer(layer)) map.removeLayer(layer);
    });

    // Build new layers
    const latest = data.logs.reduce((a, b) =>
      new Date(a.created_at) > new Date(b.created_at) ? a : b, data.logs[0]);

    poiLayer = buildLayer(data.pois, { isPOI: true });
    logLayer = buildLayer(data.logs, { highlightId: latest.id });
    questLayer = buildLayer(data.quests, { isQuest: true });

    // Re-add according to toggles
    if (document.getElementById("toggle-logs").checked) map.addLayer(logLayer);
    if (document.getElementById("toggle-quest").checked) map.addLayer(questLayer);
    if (document.getElementById("toggle-pois").checked) map.addLayer(poiLayer);

    highlightLatestMarker();
    drawLogTrail(logLayer);

    // Reapply filters and shapes
    filterLogsByDate();
    if (document.getElementById("toggle-shapes").checked) {
      drawRegionShapes(true);
    }
  } catch (err) {
    console.error("Refresh failed:", err);
  } finally {
    btn.disabled = false;
    btn.textContent = "Refresh";
  }
}

function filterLogsByDate() {
  const value = document.getElementById("log-date-filter").value;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start = null, end = now;

  switch (value) {
    case "today": {
      start = todayStart; // today 00:00 → now
      break;
    }
    case "yesterday": {
      end = todayStart; // yesterday 00:00 → today 00:00
      start = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
      break;
    }
    case "thisweek": {
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      end = now; // up to now
      break;
    }
    case "lastweek": {
      end = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);   // 7 days ago
      start = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000); // 14–7 days ago
      break;
    }
    default: {
      // "all" → show all logs (no filtering)
      start = null;
      break;
    }
  }

  const allLogs = JSON.parse(document.getElementById('logs-data').textContent);
  const filtered = start
    ? allLogs.filter(l => {
        const t = new Date(l.created_at);
        return t >= start && t < end; // end-exclusive
      })
    : allLogs;

  if (!filtered.length) return;

  const latest = filtered.reduce((a, b) =>
    new Date(a.created_at) > new Date(b.created_at) ? a : b, filtered[0]);

  if (map.hasLayer(logLayer)) map.removeLayer(logLayer);
  logLayer = buildLayer(filtered, { highlightId: latest.id });
  map.addLayer(logLayer);
  highlightLatestMarker();
  drawLogTrail(logLayer);
}

function bindUIEvents() {
  const toggle = (id, getLayer, isLog = false) => {
    const checkbox = document.getElementById(id);
    checkbox.addEventListener("change", e => {
      const layer = getLayer(); // always fetch current layer
      if (e.target.checked) {
        map.addLayer(layer);
        if (isLog) drawLogTrail(layer);
      } else {
        if (map.hasLayer(layer)) map.removeLayer(layer);
        if (isLog && map._logTrail) {
          map.removeLayer(map._logTrail);
          map._logTrail = null;
        }
      }
    });
  };

  toggle("toggle-pois", () => poiLayer);
  toggle("toggle-logs", () => logLayer, true);
  toggle("toggle-quest", () => questLayer);
  document.getElementById("toggle-shapes").addEventListener("change", e => drawRegionShapes(e.target.checked));
  document.getElementById("refresh-map").addEventListener("click", refreshMapData);
  document.getElementById("log-date-filter").addEventListener("change", filterLogsByDate);
}

function focusMapOn(x, y, zoom = 3) {
  if (!map) return;
  const lat = imageHeight - y;
  const lng = x;
  map.setView([lat, lng], zoom, { animate: true });
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

  filterLogsByDate();
}