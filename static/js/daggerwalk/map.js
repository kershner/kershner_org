const imageUrl = window.daggerwalkMap.imageUrl;
const imageWidth = 1000, imageHeight = 500;
const bounds = [[0, 0], [imageHeight, imageWidth]];
const SCALAR = 0.15, BASE_EMOJI_SIZE = 14, DOT_COLOR = 'red';
const WEATHER_EMOJIS = {
  Sunny: "☀️", Clear: "🌙", Overcast: "🌥️", Cloudy: "☁️",
  Foggy: "🌫️", Rainy: "🌧️", Snowy: "🌨️", Thunderstorm: "⛈️"
};
const SEASON_EMOJIS = {
  Winter: "☃️", Spring: "🌸", Summer: "🌻", Autumn: "🍂"
};
const refreshDataUrl = '/daggerwalk/refresh-data/';
let map, poiLayer, logLayer, questLayer, regionShapeLayer;
let CURRENT_LOG_TYPE_FILTER = "default";
let logLineLayer = null;

/* -------------------- Map Setup -------------------- */
function setupMap() {
  const imgBounds = (bounds instanceof L.LatLngBounds) ? bounds : L.latLngBounds(bounds);
  const imageLayer = L.imageOverlay(imageUrl, imgBounds);

  const map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -2,
    maxZoom: 6,
    zoomControl: false,
    zoomAnimation: true,
    markerZoomAnimation: true,
    fadeAnimation: true,
    inertia: true,
    wheelPxPerZoomLevel: 120,
    scrollWheelZoom: 'center',
    zoomSnap: 1,
    zoomDelta: 1,
    bounceAtZoomLimits: false,
    maxBoundsViscosity: 1.0,
    attributionControl: false,
    preferCanvas: true,
    renderer: L.canvas(),
    dragging: true,
    touchZoom: true,
    doubleClickZoom: false,
    keyboard: false,
  });

  imageLayer.addTo(map);
  map.fitBounds(imgBounds);
  map.setMaxBounds(imgBounds.pad(0.5));

  // Start two levels above minZoom
  map.setZoom(map.getMinZoom() + 2);

  L.control.scale({ position: 'bottomleft', imperial: false }).addTo(map);

  document.getElementById('fullscreen-map').onclick = () => {
    const el = map.getContainer();
    if (!document.fullscreenElement) el.requestFullscreen();
    else document.exitFullscreen();
  };

  return { map, imageLayer, imgBounds };
}

/* -------------------- Utilities -------------------- */
function isAltMapActive() {
  return map?.getZoom?.() < 0;
}

function getMapData() {
  return {
    pois: JSON.parse(document.getElementById('poi-data').textContent),
    logs: JSON.parse(document.getElementById('logs-data').textContent),
    quests: JSON.parse(document.getElementById('quest-data').textContent),
    shapes: JSON.parse(document.getElementById('shape-data').textContent),
  };
}

function computeShapeExtents(shapes) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  shapes.forEach(s => s.coordinates.forEach(([x, y]) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }));
  return { minX, minY, maxX, maxY, spanX: maxX - minX, spanY: maxY - minY };
}

function rebuildLogLayer(logs) {
  if (map.hasLayer(logLayer)) map.removeLayer(logLayer);
  logLayer = buildLayer(logs);
  map.addLayer(logLayer);
  drawLogLine(true);
}

/* -------------------- Clustering (POIs only) -------------------- */
function createClusterGroup(isPOI = false) {
  if (window.DISABLE_CLUSTERING) return L.layerGroup();

  const clusterGroup = L.markerClusterGroup({
    maxClusterRadius: 90,
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
        ? `<div class="cluster-circle"><span class="cluster-emoji">📍</span><span class="cluster-count">${count}</span></div>`
        : `<div class="cluster-icon"></div>`;
      return L.divIcon({ html, className: cls, iconSize: [36 * scale, 36 * scale] });
    },
  });

  attachClusterTooltip(clusterGroup);
  return clusterGroup;
}

function attachClusterTooltip(clusterGroup) {
  clusterGroup.on('clustermouseover', e => {
    const markers = e.layer.getAllChildMarkers();
    const isLogCluster = markers.some(m => !m.options.isPOI && !m.options.isQuest);
    if (!isLogCluster) return;

    const logs = markers
      .map(m => m.options.item)
      .filter(i => i?.created_at)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    const count = logs.length;
    const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const range = count > 1 ? `${fmt(new Date(logs[0].created_at))} – ${fmt(new Date(logs[count - 1].created_at))}` : '';
    const html = `<div style="text-align:center;"><b>${count}</b> logs<br>${range || ''}</div>`;

    e.layer.bindTooltip(html, { direction: 'top', offset: [0, -10] }).openTooltip();
  });
}

/* -------------------- Icons / Popups / Markers -------------------- */
function makeIcon({ emoji, dot = false, quest = false, questImg = null, highlight = false }) {
  const baseClass = "map-marker";
  function baseIconOptions() {
    return {
      iconSize: [8, 8],
      iconAnchor: [4, 4],
      popupAnchor: [0, -8]
    };
  }

  if (dot) return L.divIcon({
    ...baseIconOptions(),
    html: `<div>${emoji || ""}</div>`,
    className: `${baseClass} log-marker${highlight ? " latest-log" : ""}`,
  });
  if (quest) return L.divIcon({
    ...baseIconOptions(),
    html: `<div class="quest-marker"><img src="${questImg}"></img></div>`,
    className: `${baseClass} quest-marker`,
    popupAnchor: [8, -20],
  });
  return L.divIcon({
    ...baseIconOptions(),
    html: `<div>${emoji || "📍"}</div>`,
    className: `${baseClass} poi-marker`,
  });
}

function popupHtml(item) {
  const tpl = document.getElementById("popup-template");
  const el = tpl.content.cloneNode(true);
  const title = el.querySelector(".popup-title");
  const subtitle = el.querySelector(".popup-subtitle");
  const body = el.querySelector(".popup-body");
  const isQuest = !!item.quest_name;
  const isLog = !!item.date;
  const source = item.poi || item;

  const region =
    (typeof source.region === "object" && source.region) ||
    (item.region_fk__name ? {
      name: item.region_fk__name,
      province: item.region_fk__province,
      climate: item.region_fk__climate,
      emoji: item.region_fk__emoji
    } : {}) || {};

  const regionEmoji = region.emoji || "";
  const regionName = region.name || "";
  const province = region.province || "";
  const climate = region.climate || "";

  title.textContent = `${item.poi__emoji || source.emoji || regionEmoji || "📍"} ${
    item.poi__name || source.name || item.quest_name || item.location || "(Unknown)"
  }`;
  subtitle.textContent = [regionName, province].filter(Boolean).join(", ");

  const add = html => (body.innerHTML += html);

  if (isQuest) {
    add(`
      ${item.description ? `<div class="popup-description">${item.description}</div>` : ""}
      <div class="popup-quest-row">
        ${item.quest_giver_img_url ? `<img src="${item.quest_giver_img_url}" class="popup-quest-img">` : ""}
        <div class="popup-quest-info">
          ${item.quest_giver_name ? `<div class="quest-giver"><b>${item.quest_giver_name}</b></div>` : ""}
          ${item.xp ? `<div class="quest-xp"><b>XP:</b> ${item.xp}</div>` : ""}
        </div>
      </div>
    `);
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
      <div><b>Coordinates:</b> X: ${item.map_pixel_x ?? "?"}, Y: ${item.map_pixel_y ?? "?"}</div>
    `);
  } else {
    add([
      source.description && `<div>${source.description}</div>`,
      source.discovered && `<div class="popup-discovered">Discovered: ${new Date(source.discovered).toLocaleDateString("en-US")}</div>`,
    ].filter(Boolean).join(""));
  }

  return el.firstElementChild.outerHTML;
}

function createMarker(lat, lng, icon, item) {
  const marker = L.marker([lat, lng], { icon });
  marker.options.item = item;

  marker.bindPopup(popupHtml(item), {
    autoPan: false,
    closeOnClick: false,
    closeButton: true
  });

  const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;

  if (isTouch) {
    // Touch: use touchend to ensure popup always opens
    marker.on("touchend", e => {
      e.originalEvent?.stopPropagation();
      e.originalEvent?.preventDefault();

      // Close any other open popups
      map.eachLayer(layer => {
        if (layer instanceof L.Marker && layer !== marker && layer.isPopupOpen()) {
          layer.closePopup();
        }
      });

      // Toggle this popup only, no zoom
      if (marker.isPopupOpen()) marker.closePopup();
      else marker.openPopup();
    });
  } else {
    // Mouse: hover shows popup, click zooms (popup not persistent)
    marker.on("mouseover", e => e.target.openPopup());
    marker.on("mouseout", e => e.target.closePopup());
    marker.on("click", e => {
      e.originalEvent?.stopPropagation();
      const curZoom = map.getZoom?.() ?? 0;
      const maxZoom = map.getMaxZoom?.() ?? 6;
      const targetZoom = Math.max(3, Math.min(curZoom + 1, maxZoom));
      map.setView(e.latlng, targetZoom, { animate: true });
    });
  }

  return marker;
}

/* -------------------- Layers -------------------- */
function buildLayer(data, { isPOI = false, isQuest = false, highlightId = null } = {}) {
  const layer = isPOI ? createClusterGroup(true) : L.layerGroup();
  const zoom = map?.getZoom?.() ?? 1;

  let filteredData = data;
  if (!isPOI && !isQuest && zoom < 2) {
    filteredData = data.filter((_, i) => i % 20 === 0);

    // Always include the latest log so it's visible even when filtered
    if (data.length) {
      const latestLog = data.reduce((a, b) =>
        new Date(a.created_at) > new Date(b.created_at) ? a : b, data[0]);
      if (!filteredData.some(l => l.id === latestLog.id)) {
        filteredData.push(latestLog);
      }
    }
  }

  // Determine which log to highlight
  const effectiveHighlightId =
    highlightId ?? (filteredData[filteredData.length - 1]?.id);

  filteredData.forEach(item => {
    const lat = isQuest ? imageHeight - item.poi.map_pixel_y : imageHeight - item.map_pixel_y;
    const lng = isQuest ? item.poi.map_pixel_x : item.map_pixel_x;
    const highlight = !!(effectiveHighlightId && item.id === effectiveHighlightId);

    const icon = isQuest
      ? makeIcon({ emoji: item.poi.emoji, quest: true, questImg: item.quest_giver_img_url })
      : (isPOI
          ? makeIcon({ emoji: item.emoji })
          : makeIcon({ emoji: item.emoji, dot: true, highlight }));

    const marker = createMarker(lat, lng, icon, item);
    if (isPOI) marker.options.isPOI = true;
    if (!isPOI && !isQuest && highlight) marker.options.isLatest = true;

    layer.addLayer(marker);
  });

  return layer;
}

function highlightLatestMarker() {
  setTimeout(() => {
    const latestMarker = document.querySelector('.log-marker.latest-log');
    if (!latestMarker) return;
    const cluster = latestMarker.closest('.marker-cluster');
    if (cluster) cluster.classList.add('latest-log');
  }, 300);
}

/* -------------------- Region Shapes -------------------- */
function projectShapePoint(x, y) {
  const sx = imageWidth / SHAPE_EXTENTS.spanX;
  const sy = imageHeight / SHAPE_EXTENTS.spanY;
  const px = (x - SHAPE_EXTENTS.minX) * sx + 15;
  const py = (y - SHAPE_EXTENTS.minY) * sy;
  return [imageHeight - py, px];
}

const REGION_LABEL_OFFSETS = {
  "Shalgora": { x: 20, y: 20}, "Daenia": { x: 10, y: 0}, "Phrygias": { x: 0, y: 15},
  "Alcaire": { x: -25, y: 0}, "Wrothgarian Mountains": { x: 25, y: 50},
  "Dragontail Mountains": { x: -60, y: -10}, "Wayrest": { x: -20, y: 0},
  "Gavaudon": { x: -30, y: 20}, "Mournoth": { x: 10, y: 20},
  "Cybiades": { x: 0, y: 30}, "Myrkwasa": { x: 20, y: 0},
  "Pothago": { x: 5, y: 10}, "Kairou": { x: 15, y: 15},
  "Antiphyllos": { x: 20, y: 10}, "Alik'r Desert": { x: -100, y: -40},
};

function drawRegionShapes(show = true) {
  if (isAltMapActive()) {
    if (regionShapeLayer && map.hasLayer(regionShapeLayer))
      map.removeLayer(regionShapeLayer);
    return;
  }

  const shapes = window.shapes || [];
  if (regionShapeLayer) map.removeLayer(regionShapeLayer);
  if (!show) return;

  regionShapeLayer = L.layerGroup();

  shapes.forEach(shape => {
    const points = shape.coordinates.map(([x, y]) => projectShapePoint(x, y));
    const poly = L.polygon(points, { opacity: 0, fillOpacity: 0 }).addTo(regionShapeLayer);
    const center = poly.getBounds().getCenter();

    const offset = REGION_LABEL_OFFSETS[shape.name] || { x: 0, y: 0 };
    const offsetLatLng = L.latLng(center.lat + offset.y, center.lng + offset.x);

    L.marker(offsetLatLng, {
      icon: L.divIcon({ className: 'region-label', html: shape.name, iconSize: [100, 20] })
    }).addTo(regionShapeLayer);
  });

  regionShapeLayer.addTo(map);
}

/* -------------------- Path (Log Line) -------------------- */
function drawLogLine(show = true) {
  // Clear any existing line
  if (logLineLayer) {
    map.removeLayer(logLineLayer);
    logLineLayer = null;
  }
  if (!show || !logLayer) return;

  // Collect all visible log markers in chronological order
  const points = [];
  logLayer.eachLayer(marker => {
    const item = marker.options.item || {};
    const x = item.map_pixel_x, y = item.map_pixel_y, created_at = item.created_at;
    if (Number.isFinite(x) && Number.isFinite(y) && created_at) {
      points.push({ lat: imageHeight - y, lng: x, time: new Date(created_at) });
    }
  });

  points.sort((a, b) => a.time - b.time);
  if (points.length < 2) return;

  const lineColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--accent-color')
    .trim() || 'gold';
  
  logLineLayer = L.polyline(points.map(p => [p.lat, p.lng]), {
    color: lineColor,
    weight: 2,
    opacity: 1,
    dashArray: '4, 8'
  }).addTo(map);
}

function handleZoomImageSwap(map) {
  const el = document.getElementById('map')
  const alt1 = el?.dataset.altImage, alt2 = el?.dataset.altImage2
  if (!alt1 && !alt2) return

  const togglePanes = show =>
    ['shadowPane', 'tooltipPane', 'popupPane']
      .forEach(p => (map.getPanes()[p].style.display = show ? '' : 'none'))

  const alt1Labels = [
    { text: 'High Rock', x: 320, y: 700 },
    { text: 'Hammerfell', x: 500, y: -200 },
  ]

  const clearLayer = name => {
    if (map[name]) { map.removeLayer(map[name]); map[name] = null }
  }

  map.on('zoomend', () => {
    const z = map.getZoom(), minZ = map.getMinZoom()
    const mode = z <= minZ ? 2 : z <= minZ + 1 ? 1 : 0
    const url = mode === 2 ? alt2 : mode === 1 ? alt1 : null

    clearLayer('altImageLayer')
    clearLayer('altLabelLayer')
    el.style.background = mode === 2 ? 'black' : ''

    if (url) {
      ;[poiLayer, logLayer, questLayer, regionShapeLayer, logLineLayer]
        .forEach(l => l && map.hasLayer(l) && map.removeLayer(l))

      togglePanes(false)
      map.dragging.disable()

      if (mode === 2) {
        const bounds = map.getBounds()
        const center = bounds.getCenter()
        const img = new Image()
        img.src = url
        img.onload = () => {
          const imageAspect = img.width / img.height
          const mapAspect =
            (bounds.getEast() - bounds.getWest()) /
            (bounds.getNorth() - bounds.getSouth())

          let imgBounds
          if (imageAspect < mapAspect) {
            // narrower image → full height, letterboxed sides
            const scaledWidth = (bounds.getNorth() - bounds.getSouth()) * imageAspect
            imgBounds = [
              [bounds.getSouth(), center.lng - scaledWidth / 2],
              [bounds.getNorth(), center.lng + scaledWidth / 2]
            ]
          } else {
            // wider image → full width
            const scaledHeight = (bounds.getEast() - bounds.getWest()) / imageAspect
            imgBounds = [
              [center.lat - scaledHeight / 2, bounds.getWest()],
              [center.lat + scaledHeight / 2, bounds.getEast()]
            ]
          }

          map.altImageLayer = L.imageOverlay(url, imgBounds, {
            zIndex: 9999,
            interactive: true
          }).addTo(map)

          map.altImageLayer.on('click', () => map.setZoom(z + 1))
        }
      } else {
        map.altImageLayer = L.imageOverlay(url, map.getBounds(), {
          zIndex: 9999, interactive: true
        }).addTo(map)
        map.altImageLayer.on('click', () => map.setZoom(z + 1))

        // only show labels if not in fullscreen
        if (!document.fullscreenElement) {
          map.altLabelLayer = L.layerGroup(
            alt1Labels.map(l =>
              L.marker([l.y, l.x], {
                icon: L.divIcon({
                  className: 'region-label',
                  html: l.text,
                  iconSize: [100, 20],
                  iconAnchor: [50, 10]
                }),
                interactive: false
              })
            )
          ).addTo(map)
        }
      }
    } else {
      togglePanes(true)
      map.dragging.enable()
      el.style.background = ''

      const toggles = {
        poi: document.getElementById("toggle-pois")?.checked,
        quest: document.getElementById("toggle-quest")?.checked,
        shapes: document.getElementById("toggle-shapes")?.checked
      }

      if (toggles.poi && poiLayer) map.addLayer(poiLayer)
      if (toggles.quest && questLayer) map.addLayer(questLayer)
      if (logLayer) map.addLayer(logLayer)
      if (toggles.shapes) drawRegionShapes(true)
      if (logLineLayer) map.addLayer(logLineLayer)

      filterLogsByDate()
      applyLogTypeFilter()
    }
  })

  // hide altmap-1 labels in fullscreen
  document.addEventListener('fullscreenchange', () => {
    const isFull = !!document.fullscreenElement
    if (map.altLabelLayer) {
      isFull ? map.removeLayer(map.altLabelLayer) : map.addLayer(map.altLabelLayer)
    }
  })
}

/* -------------------- Data Refresh / Filters -------------------- */
async function refreshMapData() {
  const btn = document.getElementById("refresh-map");
  btn.disabled = true;
  btn.textContent = "...";

  try {
    const res = await fetch(refreshDataUrl);
    if (!res.ok) throw new Error("Failed to refresh map data");
    const data = await res.json();

    document.getElementById("logs-data").textContent = JSON.stringify(data.logs);
    document.getElementById("poi-data").textContent = JSON.stringify(data.pois);
    document.getElementById("quest-data").textContent = JSON.stringify(data.quests);
    document.getElementById("shape-data").textContent = JSON.stringify(data.shapes);

    [logLayer, poiLayer, questLayer].forEach(layer => map.hasLayer(layer) && map.removeLayer(layer));

    poiLayer = buildLayer(data.pois, { isPOI: true });
    rebuildLogLayer(data.logs);
    questLayer = buildLayer(data.quests, { isQuest: true });

    if (document.getElementById("toggle-quest").checked) map.addLayer(questLayer);
    if (document.getElementById("toggle-pois").checked) map.addLayer(poiLayer);

    filterLogsByDate();
    applyLogTypeFilter();

    if (document.getElementById("toggle-shapes").checked) {
      drawRegionShapes(true);
    }
  } catch (err) {
    console.error("Refresh failed:", err);
  } finally {
    btn.disabled = false;
    btn.textContent = "↻";
  }
}

function filterLogsByDate() {
  if (isAltMapActive()) return;

  const value = document.getElementById("log-date-filter").value;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start = null, end = now;

  switch (value) {
    case "today": start = todayStart; break;
    case "yesterday": end = todayStart; start = new Date(todayStart.getTime() - 86400000); break;
    case "thisweek": start = new Date(now.getTime() - 7 * 86400000); break;
    case "lastweek": end = new Date(now.getTime() - 7 * 86400000); start = new Date(now.getTime() - 14 * 86400000); break;
    default: start = null; break;
  }

  const { logs: allLogs } = getMapData();
  const filtered = start
    ? allLogs.filter(l => {
        const t = new Date(l.created_at);
        return t >= start && t < end;
      })
    : allLogs;

  if (!filtered.length) return;

  rebuildLogLayer(filtered);
  applyLogTypeFilter();
}

function applyLogTypeFilter() {
  if (isAltMapActive()) return;

  const select = document.getElementById("log-type-filter");
  if (!select || !logLayer) return;

  const type = select.value;
  CURRENT_LOG_TYPE_FILTER = type;

  logLayer.eachLayer(marker => {
    const item = marker.options.item;
    const el = marker.getElement();
    if (!item || !el) return;

    let emoji = "";
    switch (type) {
      case "weather": emoji = WEATHER_EMOJIS[item.weather] || ""; break;
      case "season":  emoji = SEASON_EMOJIS[item.season] || ""; break;
      case "terrain": emoji = item.region_fk__emoji || ""; break;
    }

    if (type === "hidden") {
      el.style.display = "none";
    } else {
      el.style.display = "";
      const div = el.querySelector("div");
      if (div) div.textContent = type === "default" ? "" : emoji;
    }
  });

  if (logLineLayer) {
    if (type === "hidden") map.removeLayer(logLineLayer);
    else if (!map.hasLayer(logLineLayer)) map.addLayer(logLineLayer);
  }
}

/* -------------------- UI Bindings -------------------- */
function bindUIEvents() {
  const toggle = (id, getLayer) => {
    const checkbox = document.getElementById(id);
    checkbox.addEventListener("change", e => {
      const layer = getLayer();
      if (e.target.checked) {
        if (!isAltMapActive() && layer) map.addLayer(layer);
      } else {
        if (layer && map.hasLayer(layer)) map.removeLayer(layer);
      }
    });
  };

  toggle("toggle-pois", () => poiLayer);
  toggle("toggle-quest", () => questLayer);
  document.getElementById("toggle-shapes").addEventListener("change", e => drawRegionShapes(e.target.checked));
  document.getElementById("refresh-map").addEventListener("click", refreshMapData);
  document.getElementById("log-date-filter").addEventListener("change", filterLogsByDate);
  document.getElementById("log-type-filter").addEventListener("change", applyLogTypeFilter);
}

function focusMapOn(x, y, zoom = 3) {
  if (!map) return;
  const lat = imageHeight - y;
  const lng = x;
  map.setView([lat, lng], zoom, { animate: true });
}

/* -------------------- Init -------------------- */
function daggerwalkMapInit() {
  const { map: leafletMap } = setupMap();
  map = leafletMap;
  window.daggerwalkMap = map;
  handleZoomImageSwap(map);

  const { pois, logs, quests, shapes } = getMapData();
  window.shapes = shapes;
  window.SHAPE_EXTENTS = computeShapeExtents(window.shapes || []);

  const latest = logs.reduce((a, b) =>
    new Date(a.created_at) > new Date(b.created_at) ? a : b, logs[0]);

  poiLayer  = buildLayer(pois,  { isPOI: true });
  logLayer  = buildLayer(logs,  { highlightId: latest.id });
  questLayer = buildLayer(quests, { isQuest: true });

  map.addLayer(logLayer);
  map.addLayer(questLayer);
  highlightLatestMarker();
  bindUIEvents();

  map.on('zoomend', () => {
    const z = map.getZoom();
    if (z >= 0) {
      filterLogsByDate();
      applyLogTypeFilter();
    }
  });

  // Emoji overlays respond to pan as well
  map.on('moveend', applyLogTypeFilter);

  filterLogsByDate();
}
