class MapViewer {
  constructor() {
    this.state = {
      provinceShapes: {},
      regionMap: {},
      mousePos: { x: 0, y: 0 },
      hoveredProvince: null,
      fetchTimer: null,
      worldMapMarkers: new Map(),
      regionCenters: {},
      mapDimensions: { width: 0, height: 0 },
      currentRegion: null
    };

    this.config = {
      markerSize: 32,
      regionFetchInterval: 20000,
      baseS3Url: window.BASE_S3_URL,
      worldMapMarkerStyle: {
        lineColor: 'white',
        lineOpacity: 0.8
      },
      dataUrls: {
        shapes: 'https://kershnerportfolio.s3.us-east-2.amazonaws.com/static/daggerwalk/data/province_shapes_optimized.json',
        regions: 'https://kershnerportfolio.s3.us-east-2.amazonaws.com/static/daggerwalk/data/region_fmap_mapping.json'
      },
      mapConstants: {
        width: 92,
        height: 80
      }
    };

    this.elements = {
      worldMapView: document.getElementById('worldMapView'),
      regionMapView: document.getElementById('regionMapView'),
      worldMap: document.getElementById('worldMap'),
      regionName: document.getElementById('regionName'),
      regionMap: document.getElementById('regionMap'),
      canvas: document.getElementById('overlay'),
      loading: document.getElementById('loading')
    };

    this.ctx = this.elements.canvas.getContext('2d');
    this.markerImage = new Image();
    this.initTooltip();
    this.bindEvents();
  }

  async init() {
    await this.loadMapData();
    this.calculateRegionCenters();
    this.initializeMap();
  }

  async loadMapData() {
    try {
      const [shapesResponse, regionsResponse] = await Promise.all([
        fetch(this.config.dataUrls.shapes),
        fetch(this.config.dataUrls.regions)
      ]);

      if (!shapesResponse.ok || !regionsResponse.ok) {
        throw new Error('Failed to fetch map data');
      }

      this.state.provinceShapes = await shapesResponse.json();
      this.state.regionMap = await regionsResponse.json();

      this.elements.loading.classList.add('hidden');
      this.elements.worldMapView.classList.remove('hidden');
    } catch (error) {
      console.error('Error loading map data:', error);
      this.elements.loading.textContent = 'Error loading map data. Please refresh the page.';
      this.elements.loading.classList.add('error');
    }
  }

  calculateRegionCenters() {
    Object.entries(this.state.provinceShapes).forEach(([provinceName, points]) => {
      if (this.state.regionMap[provinceName]) {
        const uniquePoints = this.getUniquePoints(points);
        const bounds = this.calculateBounds(uniquePoints);
        this.state.regionCenters[provinceName] = {
          x: (bounds.minX + bounds.maxX) / 2,
          y: (bounds.minY + bounds.maxY) / 2
        };
      }
    });
  }

  getUniquePoints(points) {
    return points.filter((point, index) => {
      const nextPoint = points[index + 1];
      return !nextPoint || point[0] !== nextPoint[0] || point[1] !== nextPoint[1];
    });
  }

  initializeMap() {
    const onLoad = () => {
      this.state.mapDimensions = {
        width: this.elements.worldMap.naturalWidth,
        height: this.elements.worldMap.naturalHeight
      };
      this.elements.canvas.width = this.elements.worldMap.width;
      this.elements.canvas.height = this.elements.worldMap.height;
      this.drawProvinceShapes();
    };

    if (this.elements.worldMap.complete) {
      onLoad();
    } else {
      this.elements.worldMap.onload = onLoad;
    }
  }

  initTooltip(selector = '.log-marker') {
    const tooltip = document.createElement('div')
    tooltip.className = 'tooltip'
    document.body.appendChild(tooltip)
  
    document.addEventListener('mouseover', e => {
      const el = e.target.closest(selector)
      if (el) {
        const {left, top, width} = el.getBoundingClientRect()
        tooltip.innerHTML = Object.entries(el.dataset)
          .map(([k, v]) => {
            const formatted = k
              .replace(/([A-Z])/g, ' $1')
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ')
            return `<div class="row"><span class="key">${formatted}</span><span class="value">${v}</span></div>`
          })
          .join('')
        tooltip.style.left = left + width/2 + 'px'
        tooltip.style.top = top - 10 + 'px'
        tooltip.classList.add('visible')
      }
    })
  
    document.addEventListener('mouseout', e => {
      if (e.target.closest(selector)) {
        tooltip.classList.remove('visible')
      }
    })
  
    // Return cleanup function
    return () => tooltip.remove()
  }

  updateUrl(region) {
    const params = new URLSearchParams(window.location.search);
    params.set('region', region);
    history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);
  }

  createMarkerData(log) {
    return {
      season: log.season,
      weather: log.weather,
      currentSong: log.current_song,
      location: log.location,
      reset: log.reset,
      createdAt: this.convertToEST(log.created_at)
    };
  }

  async fetchDaggerwalkLogs(region) {
    try {
        const response = await fetch(`/daggerwalk/logs/?region=${encodeURIComponent(region)}`);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        
        const data = await response.json();
        if (!data.length) return;

        const mostRecentLog = data[data.length - 1];
        const regionData = this.state.regionMap[region];
        const selectedPart = this.getSelectedRegionPart(
            regionData, 
            parseInt(mostRecentLog.map_pixel_x),
            parseInt(mostRecentLog.map_pixel_y)
        );

        await this.showRegionMap(
            region,
            parseInt(mostRecentLog.map_pixel_x),
            parseInt(mostRecentLog.map_pixel_y),
            selectedPart
        );

        this.clearLogMarkers();
        data.forEach(log => this.addLogMarker(
            log.region, 
            parseInt(log.map_pixel_x), 
            parseInt(log.map_pixel_y), 
            selectedPart,
            this.createMarkerData(log)
        ));

        this.scheduleNextLogFetch(); // Schedule the next fetch
    } catch (error) {
        this.scheduleNextLogFetch(10000); // Retry in 10 seconds if fetch fails
    }
  }

  scheduleNextLogFetch() {
    if (this.state.fetchTimer) {
        clearTimeout(this.state.fetchTimer);
        this.state.fetchTimer = null;
    }

    this.calculateNextLogFetchDelay().then((nextFetchDelay) => {
        if (isNaN(nextFetchDelay) || nextFetchDelay <= 0) {
            nextFetchDelay = 10000; // Default retry delay
        }

        this.state.fetchTimer = setTimeout(() => {
            if (!this.state.currentRegion) {
                return;
            }
            this.fetchDaggerwalkLogs(this.state.currentRegion);
        }, nextFetchDelay);
    }).catch(err => {
        this.scheduleNextLogFetch(10000); // Fallback to 10s retry on error
    });
  }

  calculateNextLogFetchDelay(retryInterval = 1000, maxWaitTime = 30000) {
    const buffer = 10000; // 10 seconds
    const fiveMinutesAndBuffer = (5 * 60 * 1000) + buffer; // 5 minutes + 10 sec buffer
    let elapsedTime = 0;

    return new Promise((resolve) => {
        const checkMarker = () => {
            const recentMarker = document.querySelector('.log-marker.recent');

            if (!recentMarker) {
                if (elapsedTime >= maxWaitTime) {
                    return resolve(buffer);
                }

                elapsedTime += retryInterval;
                setTimeout(checkMarker, retryInterval);
                return;
            }

            const createdAtStr = recentMarker.dataset.createdAt;
            if (!createdAtStr) {
                setTimeout(checkMarker, retryInterval);
                return;
            }

            const lastLogTime = new Date(createdAtStr).getTime();
            if (isNaN(lastLogTime)) {
                setTimeout(checkMarker, retryInterval);
                return;
            }

            const nextFetchTime = lastLogTime + fiveMinutesAndBuffer;
            const delay = Math.max(nextFetchTime - Date.now(), buffer); // Ensure at least 10 sec delay

            resolve(delay);
        };

        checkMarker(); // Start checking
    });
  }

  startLogPolling(region) {
    this.stopLogPolling(); // Clear any previous polling
    this.currentRegion = region;
    this.fetchDaggerwalkLogs(region);
  }

  stopLogPolling() {
    if (this.state.fetchTimer) {
        clearTimeout(this.state.fetchTimer);
        this.state.fetchTimer = null;
    }
  }

  showWorldMap() {
    this.elements.worldMapView.classList.remove('hidden');
    this.elements.regionMapView.classList.add('hidden');
    this.stopLogPolling();
    history.pushState({}, '', window.location.pathname);
    this.clearLogMarkers();
    this.elements.regionName.textContent = '';
    this.addAllWorldMapMarkers();
    this.state.currentRegion = null;
  }

  async showRegionMap(regionName, x, y, forcePart = null) {
    if (!this.state.regionMap[regionName]) return;

    this.elements.worldMapView.classList.add('hidden');
    this.elements.regionMapView.classList.remove('hidden');
    this.state.currentRegion = regionName;

    const regionData = this.state.regionMap[regionName];
    const selectedPart = forcePart || 
      (x && y ? this.getSelectedRegionPart(regionData, x, y) : regionData.parts[0]);
    
    return new Promise((resolve) => {
      this.elements.regionMap.onload = () => {
        this.elements.regionName.textContent = regionName;
        this.clearLogMarkers();
        resolve();
      };
      this.elements.regionMap.src = `${this.config.baseS3Url}/img/daggerwalk/maps/${selectedPart.fmap_image}`;
    });
  }

  addAllWorldMapMarkers() {
    this.clearWorldMapMarkers();
    if (window.REGION_DATA) {
      window.REGION_DATA.forEach((data, i) => this.addWorldMapMarker({
        regionName: data.region,
        latestDate: data.latest_date,
        reset: data.latest_reset,
        location: data.latest_location,
        weather: data.latest_weather,
        currentSong: data.latest_current_song,
        order: i
      }));
    }
  }

  addWorldMapMarker(markerData) {
    this.state.worldMapMarkers.set(markerData.regionName, markerData);
    this.drawProvinceShapes();
  }

  clearWorldMapMarkers() {
    this.state.worldMapMarkers.clear();
    this.drawProvinceShapes();
  }

  addLogMarker(regionName, x, y, forcePart = null, markerData = {}) {
    if (!x || !y) return;
  
    requestAnimationFrame(() => {
      const regionData = this.state.regionMap[regionName];
      if (!regionData) return;
  
      const selectedPart = forcePart || this.getSelectedRegionPart(regionData, x, y);
      if (!selectedPart?.offset) return;

      const marker = this.createMarkerElement(x, y, regionName, selectedPart, markerData);
      const mapContainer = document.querySelector('#regionMapView .map-container');
      document.querySelectorAll('.log-marker').forEach(m => m.classList.remove('recent'));
      mapContainer.appendChild(marker);
    });
  }

  createMarkerElement(x, y, regionName, selectedPart, markerData) {
    const scaleFactor = this.elements.regionMap.clientWidth / this.elements.regionMap.naturalWidth;
    const scale = selectedPart.fmap_image === 'FMAP0I19.PNG' ? 4 : 1;
    const adjustedX = (x - selectedPart.offset.x) * scale * scaleFactor;
    const adjustedY = (y - selectedPart.offset.y) * scale * scaleFactor;

    const marker = document.createElement('div');
    marker.classList.add('log-marker', 'recent');
    marker.style.left = `${adjustedX}px`;
    marker.style.top = `${adjustedY}px`;

    const mapPixel = `${x},${y}`;
    this.setMarkerDataAttributes(marker, { mapPixel, ...markerData });
    return marker;
  }

  setMarkerDataAttributes(marker, data) {
    const flattenObject = (obj, prefix = '') => {
      return Object.entries(obj).reduce((acc, [key, value]) => {
        const newKey = prefix ? `${prefix}-${key}` : key;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          return { ...acc, ...flattenObject(value, newKey) };
        }
        return { ...acc, [newKey]: value };
      }, {});
    };

    const flattenedData = flattenObject(data);
    Object.entries(flattenedData).forEach(([key, value]) => {
      if (value != null) {
        marker.dataset[key] = String(value);
      }
    });
  }

  clearLogMarkers() {
    document.querySelectorAll(`#${this.elements.regionMapView.id} .marker`).forEach(marker => marker.remove());
  }

  getSelectedRegionPart(regionData, x, y) {
    if (!regionData?.multi_part || !regionData?.parts?.length) {
      return regionData;
    }

    const { width: MAP_WIDTH, height: MAP_HEIGHT } = this.config.mapConstants;
    
    const exactPart = regionData.parts.find(part => {
      if (!part.offset) return false;
      const { x: startX, y: startY } = part.offset;
      return x >= startX && x < (startX + MAP_WIDTH) && 
             y >= startY && y < (startY + MAP_HEIGHT);
    });
    
    if (exactPart) return exactPart;
    
    if (!isNaN(x) && !isNaN(y)) {
      return this.findClosestPart(regionData.parts, x, y, MAP_WIDTH, MAP_HEIGHT);
    }
    
    return regionData.parts[0];
  }

  findClosestPart(parts, x, y, mapWidth, mapHeight) {
    return parts.reduce((best, part) => {
      if (!part.offset) return best;
      
      const { distance, outsideScore } = this.calculatePartMetrics(
        part, x, y, mapWidth, mapHeight
      );

      if (!best || outsideScore < best.score || 
          (outsideScore === best.score && distance < best.distance)) {
        return { part, distance, score: outsideScore };
      }
      return best;
    }, null)?.part;
  }

  calculatePartMetrics(part, x, y, mapWidth, mapHeight) {
    const centerX = part.offset.x + mapWidth/2;
    const centerY = part.offset.y + mapHeight/2;
    const distance = Math.hypot(x - centerX, y - centerY);
    
    const xOutside = x < part.offset.x ? part.offset.x - x :
                    x >= (part.offset.x + mapWidth) ? x - (part.offset.x + mapWidth) : 0;
    const yOutside = y < part.offset.y ? part.offset.y - y :
                    y >= (part.offset.y + mapHeight) ? y - (part.offset.y + mapHeight) : 0;
    
    return { distance, outsideScore: xOutside + yOutside };
  }

  getMapScale() {
    const img = this.elements.worldMap;
    const containerWidth = img.clientWidth;
    const containerHeight = img.clientHeight;
    
    const imageAspectRatio = this.state.mapDimensions.width / this.state.mapDimensions.height;
    const containerAspectRatio = containerWidth / containerHeight;

    let renderedWidth, renderedHeight;
    if (containerAspectRatio > imageAspectRatio) {
      renderedHeight = containerHeight;
      renderedWidth = containerHeight * imageAspectRatio;
    } else {
      renderedWidth = containerWidth;
      renderedHeight = containerWidth / imageAspectRatio;
    }

    return {
      scaleX: renderedWidth / this.state.mapDimensions.width,
      scaleY: renderedHeight / this.state.mapDimensions.height,
      offsetX: (containerWidth - renderedWidth) / 2,
      offsetY: (containerHeight - renderedHeight) / 2
    };
  }

  isPointInPolygon(x, y, polygon, tolerance = 5) {
    for (let dx = -tolerance; dx <= tolerance; dx++) {
      for (let dy = -tolerance; dy <= tolerance; dy++) {
        if (this.isPointInPolygonCore(x + dx, y + dy, polygon)) {
          return true;
        }
      }
    }
    return false;
  }

  isPointInPolygonCore(x, y, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];
      
      const intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  drawProvinceShapes() {
    this.setupCanvas();
    const scale = this.getMapScale();
    const markersArray = Array.from(this.state.worldMapMarkers.values());
    const lastMarker = markersArray[0];
    const pulseScale = this.calculatePulseScale();

    if (this.state.worldMapMarkers.size > 1) {
      this.drawConnectingLines(markersArray, scale);
    }

    this.drawWorldMapMarkers(markersArray, scale, pulseScale, lastMarker);

    if (this.state.hoveredProvince) {
      this.drawProvinceLabel();
    }

    requestAnimationFrame(() => this.drawProvinceShapes());
  }

  setupCanvas() {
    const container = document.querySelector('.map-container');
    this.elements.canvas.width = container.clientWidth;
    this.elements.canvas.height = container.clientHeight;
    this.ctx.clearRect(0, 0, this.elements.canvas.width, this.elements.canvas.height);
    this.elements.worldMap.style.cursor = this.state.hoveredProvince ? 'pointer' : 'default';
  }

  calculatePulseScale() {
    const pulseTime = (Date.now() % 1500) / 1500;
    return 1.0 + 0.2 * Math.sin(pulseTime * Math.PI * 2);
  }

  drawConnectingLines(markers, scale) {
    const sortedMarkers = this.getSortedMarkers(markers);
    const lineColor = this.getLineColor();
    
    this.ctx.strokeStyle = lineColor;
    this.ctx.fillStyle = lineColor;
    this.ctx.lineWidth = 2;
    
    for (let i = 0; i < sortedMarkers.length - 1; i++) {
      const current = sortedMarkers[i];
      const next = sortedMarkers[i + 1];

      if (current.reset || next.reset || !current.center || !next.center) continue;

      this.drawDottedLine(current, next, scale);
    }
  }

  getSortedMarkers(markers) {
    return markers
      .map(marker => ({
        ...marker,
        center: this.state.regionCenters[marker.regionName]
      }))
      .sort((a, b) => a.order - b.order);
  }

  getLineColor() {
    const { lineColor, lineOpacity } = this.config.worldMapMarkerStyle;
    return lineColor.replace('rgb', 'rgba').replace(')', `,${lineOpacity})`);
  }

  drawDottedLine(current, next, scale) {
    const startX = current.center.x * scale.scaleX + scale.offsetX;
    const startY = current.center.y * scale.scaleY + scale.offsetY;
    const endX = next.center.x * scale.scaleX + scale.offsetX;
    const endY = next.center.y * scale.scaleY + scale.offsetY;
    
    const distance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
    const dotSpacing = 20;
    const numberOfDots = Math.floor(distance / dotSpacing);
    
    for (let j = 0; j <= numberOfDots; j++) {
      const ratio = j / numberOfDots;
      const x = startX + (endX - startX) * ratio;
      const y = startY + (endY - startY) * ratio;
      
      this.ctx.beginPath();
      this.ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  drawWorldMapMarkers(markers, scale, pulseScale, lastMarker) {
    markers.forEach(marker => {
      const center = this.state.regionCenters[marker.regionName];
      if (!center) return;

      const x = center.x * scale.scaleX + scale.offsetX;
      const y = center.y * scale.scaleY + scale.offsetY;
      const size = marker === lastMarker ? 
        this.config.markerSize * pulseScale : 
        this.config.markerSize;

      this.drawMarker(x, y, size, marker === lastMarker);
    });
  }

  drawMarker(x, y, size, isLastMarker) {
    const { lineColor, lineOpacity } = this.config.worldMapMarkerStyle;
    this.ctx.save();
    
    // Draw border
    this.ctx.beginPath();
    this.ctx.arc(x, y, size / 2 + 2, 0, 2 * Math.PI);
    this.ctx.strokeStyle = lineColor.replace('rgb', 'rgba').replace(')', `,${
      isLastMarker ? lineOpacity * 1.2 : lineOpacity
    })`);
    this.ctx.lineWidth = isLastMarker ? 3 : 2;
    this.ctx.stroke();

    // Draw marker image
    this.ctx.beginPath();
    this.ctx.arc(x, y, size / 2, 0, 2 * Math.PI);
    this.ctx.clip();
    this.ctx.drawImage(
      this.markerImage,
      x - size / 2,
      y - size / 2,
      size,
      size
    );
    
    this.ctx.restore();
  }

  drawProvinceLabel() {
    const { x, y } = this.state.mousePos;
    this.setupLabelContext();
    
    const textMetrics = this.ctx.measureText(this.state.hoveredProvince);
    const { textX, textY, textAlign, textBaseline } = this.calculateLabelPosition(
      x, y, textMetrics.width, 16
    );
    
    this.ctx.textAlign = textAlign;
    this.ctx.textBaseline = textBaseline;
    this.ctx.strokeText(this.state.hoveredProvince, textX, textY);
    this.ctx.fillText(this.state.hoveredProvince, textX, textY);
  }

  setupLabelContext() {
    this.ctx.fillStyle = 'white';
    this.ctx.strokeStyle = 'black';
    this.ctx.lineWidth = 3;
    this.ctx.font = 'bold 16px Arial';
  }

  calculateLabelPosition(x, y, textWidth, textHeight, padding = 10) {
    let textX = x + padding;
    let textY = y + padding;
    let textAlign = 'left';
    let textBaseline = 'top';
    
    if (textX > this.elements.canvas.width - textWidth - padding) {
      textX = x - 5;
      textAlign = 'right';
    }
    
    if (textY > this.elements.canvas.height - textHeight - padding) {
      textY = y - textHeight - padding;
      textBaseline = 'bottom';
    }
    
    return { textX, textY, textAlign, textBaseline };
  }

  bindEvents() {
    const { worldMap, regionMap } = this.elements;
    
    worldMap.addEventListener('mousemove', this.handleMouseMove.bind(this));
    worldMap.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
    worldMap.addEventListener('mousedown', () => this.drawProvinceShapes());
    worldMap.addEventListener('mouseup', () => this.drawProvinceShapes());
    worldMap.addEventListener('click', this.handleWorldMapClick.bind(this));
    regionMap.addEventListener('click', () => this.showWorldMap());
  }

  handleMouseMove(event) {
    const rect = event.target.getBoundingClientRect();
    const scale = this.getMapScale();
    
    this.state.mousePos = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
    
    const x = (this.state.mousePos.x - scale.offsetX) / scale.scaleX;
    const y = (this.state.mousePos.y - scale.offsetY) / scale.scaleY;
    
    this.updateHoveredProvince(x, y);
  }

  updateHoveredProvince(x, y) {
    const containingRegions = Object.entries(this.state.provinceShapes)
      .filter(([_, points]) => this.isPointInPolygon(x, y, points, 5))
      .map(([name]) => name);

    if (containingRegions.length > 0) {
      const smallestRegion = this.findSmallestRegion(containingRegions);
      if (smallestRegion !== this.state.hoveredProvince) {
        this.state.hoveredProvince = smallestRegion;
        this.drawProvinceShapes();
      }
    } else if (this.state.hoveredProvince) {
      this.state.hoveredProvince = null;
      this.drawProvinceShapes();
    }
  }

  findSmallestRegion(regions) {
    return regions.reduce((smallest, current) => {
      if (!smallest) return current;
      
      const currentPoints = this.state.provinceShapes[current];
      const smallestPoints = this.state.provinceShapes[smallest];
      
      const currentBounds = this.calculateBounds(currentPoints);
      const smallestBounds = this.calculateBounds(smallestPoints);
      
      const currentArea = (currentBounds.maxX - currentBounds.minX) * 
                        (currentBounds.maxY - currentBounds.minY);
      const smallestArea = (smallestBounds.maxX - smallestBounds.minX) * 
                         (smallestBounds.maxY - smallestBounds.minY);
      
      return currentArea < smallestArea ? current : smallest;
    }, null);
  }

  calculateBounds(points) {
    const xs = points.map(p => p[0]);
    const ys = points.map(p => p[1]);
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys)
    };
  }

  handleMouseLeave() {
    this.state.hoveredProvince = null;
    this.drawProvinceShapes();
  }

  handleWorldMapClick(event) {
    if (!this.state.hoveredProvince || !this.state.regionMap[this.state.hoveredProvince]) return;

    const rect = event.target.getBoundingClientRect();
    const scale = this.getMapScale();
    const x = Math.round((event.clientX - rect.left - scale.offsetX) / scale.scaleX);
    const y = Math.round((event.clientY - rect.top - scale.offsetY) / scale.scaleY);
    
    this.showRegionMap(this.state.hoveredProvince, x, y);
    this.fetchDaggerwalkLogs(this.state.hoveredProvince);
    this.updateUrl(this.state.hoveredProvince);
  }

  convertToEST(dateString) {
    return new Date(dateString).toLocaleString("en-US", {
        timeZone: "America/New_York",
        year: "2-digit",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
    }).replace(",", "");
  }
}

// Initialize the map viewer
window.onload = async () => {
  window.mapViewer = new MapViewer();
  window.mapViewer.markerImage.src = `${mapViewer.config.baseS3Url}/img/daggerwalk/Daggerwalk.ico`;
  await window.mapViewer.init();
  window.mapViewer.addAllWorldMapMarkers();

  // Handle query parameters
  const urlParams = new URLSearchParams(window.location.search);
  const region = urlParams.get("region");
  const x = parseInt(urlParams.get("x"), 10);
  const y = parseInt(urlParams.get("y"), 10);

  if (region in window.mapViewer.state.regionMap) {
    if (!isNaN(x) && !isNaN(y)) {
      window.mapViewer.showRegionMap(region, x, y).then(() => 
        window.mapViewer.addLogMarker(region, x, y)
      );
    } else {
      window.mapViewer.fetchDaggerwalkLogs(region);
      window.mapViewer.showRegionMap(region);
    }
  }
};