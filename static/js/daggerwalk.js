class MapViewer {
  constructor() {
    this.provinceShapes = {};
    this.regionMap = {};
    this.mousePos = { x: 0, y: 0 };
    this.hoveredProvince = null;
    this.fetchTimer = null;
    this.worldMapMarkers = new Map();
    this.markerSize = 32;
    this.markerImage = new Image();
    this.regionCenters = {};
    
    // DOM elements
    this.elements = {
      worldMapView: document.getElementById('worldMapView'),
      regionMapView: document.getElementById('regionMapView'),
      worldMap: document.getElementById('worldMap'),
      regionMap: document.getElementById('regionMap'),
      canvas: document.getElementById('overlay'),
      loading: document.getElementById('loading')
    };
    
    this.ctx = this.elements.canvas.getContext('2d');
    
    // Constants
    this.config = {
      regionFetchInterval: 20000,
      baseS3Url: window.BASE_S3_URL,
      dataUrls: {
        shapes: 'https://kershnerportfolio.s3.us-east-2.amazonaws.com/static/daggerwalk/data/province_shapes.json',
        regions: 'https://kershnerportfolio.s3.us-east-2.amazonaws.com/static/daggerwalk/data/region_fmap_mapping.json'
      }
    };

    this.bindEvents();
  }

  async init() {
    await this.loadMapData();
    this.calculateRegionCenters();
    this.handleUrlParams();
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

      this.provinceShapes = await shapesResponse.json();
      this.regionMap = await regionsResponse.json();

      this.elements.loading.classList.add('hidden');
      this.elements.worldMapView.classList.remove('hidden');
    } catch (error) {
      console.error('Error loading map data:', error);
      this.elements.loading.textContent = 'Error loading map data. Please refresh the page.';
      this.elements.loading.classList.add('error');
    }
  }

  calculateRegionCenters() {
    Object.entries(this.provinceShapes).forEach(([provinceName, points]) => {
      if (this.regionMap[provinceName]) {
        // Calculate centroid using the polygon area method
        let area = 0;
        let cx = 0;
        let cy = 0;
        const len = points.length;
        
        for (let i = 0; i < len; i++) {
          const j = (i + 1) % len;
          const [xi, yi] = points[i];
          const [xj, yj] = points[j];
          
          const factor = (xi * yj - xj * yi);
          area += factor;
          cx += (xi + xj) * factor;
          cy += (yi + yj) * factor;
        }
        
        area /= 2;
        const areaFactor = 1 / (6 * area);
        
        this.regionCenters[provinceName] = {
          x: Math.abs(cx * areaFactor),
          y: Math.abs(cy * areaFactor)
        };
      }
    });
  }

  initializeMap() {
    const onLoad = () => {
      this.mapDimensions = {
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

  handleUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const region = params.get('region');
    const x = params.get('x');
    const y = params.get('y');

    if (region && this.regionMap[region]) {
      this.showRegionMap(region, x, y);
      x && y ? this.addMarker(region, x, y) : this.fetchDaggerwalkLogs(region);
    }
  }

  async fetchDaggerwalkLogs(region) {
    try {
      const response = await fetch(`/daggerwalk/logs/?region=${encodeURIComponent(region)}`);
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      
      const data = await response.json();
      this.clearMarkers();
      data.forEach(log => this.addMarker(log.region, log.map_pixel_x, log.map_pixel_y));

      this.startLogPolling(region);
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  }

  startLogPolling(region) {
    this.stopLogPolling();
    this.fetchTimer = setInterval(
      () => this.fetchDaggerwalkLogs(region),
      this.config.regionFetchInterval
    );
  }

  stopLogPolling() {
    if (this.fetchTimer) {
      clearInterval(this.fetchTimer);
      this.fetchTimer = null;
    }
  }

  showWorldMap() {
    this.elements.worldMapView.classList.remove('hidden');
    this.elements.regionMapView.classList.add('hidden');
    this.stopLogPolling();
    history.pushState({}, '', window.location.pathname);
    this.addAllWorldMapMarkers();
  }

  showRegionMap(regionName, x, y) {
    if (!this.regionMap[regionName]) return;

    this.elements.worldMapView.classList.add('hidden');
    this.elements.regionMapView.classList.remove('hidden');

    const regionData = this.regionMap[regionName];
    const selectedPart = this.getSelectedRegionPart(regionData, x, y);
    const newSrc = `${this.config.baseS3Url}/img/daggerwalk/maps/${selectedPart.fmap_image}`;

    if (this.elements.regionMap.src !== newSrc) {
      this.elements.regionMap.src = newSrc;
    }

    this.clearMarkers();
  }

  addAllWorldMapMarkers() {
    this.clearWorldMapMarkers();
    for (let i = 0; i < window.REGION_MARKERS.length; i++) {
      this.addWorldMapMarker({
        'regionName': window.REGION_MARKERS[i],
        'order': i
      });
    }
  }

  addWorldMapMarker(markerData) {
    // Add marker to Map
    this.worldMapMarkers.set(markerData.regionName, {
      order: markerData.order,
      regionName: markerData.regionName
    });
    
    // Force redraw
    this.drawProvinceShapes();
  }

  clearWorldMapMarkers() {
    this.worldMapMarkers.clear();
    this.drawProvinceShapes();
  }

  addMarker(regionName, x, y) {
    if (!x || !y) return;
  
    requestAnimationFrame(() => {
      const regionData = this.regionMap[regionName];
      if (!regionData) return;
  
      const selectedPart = this.getSelectedRegionPart(regionData, x, y);
      const mapContainer = document.querySelector('#regionMapView .map-container');
  
      document.querySelectorAll('.marker').forEach(marker => marker.classList.remove('recent'));
  
      const scaleFactor = this.calculateRegionMapScale();
      const scale = selectedPart.fmap_image === 'FMAP0I19.PNG' ? 4 : 1;
      const screenX = (x - selectedPart.offset.x) * scale * scaleFactor;
      const screenY = (y - selectedPart.offset.y) * scale * scaleFactor;
  
      const marker = document.createElement('div');
      marker.classList.add('marker', 'recent');
      marker.style.left = `${screenX}px`;
      marker.style.top = `${screenY}px`;
      mapContainer.appendChild(marker);
    });
  }

  getSelectedRegionPart(regionData, x, y) {
    if (!regionData) return null;
    
    if (regionData.multi_part) {
      return regionData.parts.find(part => 
        x >= part.offset.x && y >= part.offset.y
      ) || regionData.parts[0];
    }
    
    return regionData;
  }

  clearMarkers() {
    document.querySelectorAll('#regionMapView .marker').forEach(marker => marker.remove());
  }

  calculateRegionMapScale() {
    return this.elements.regionMap.clientWidth / this.elements.regionMap.naturalWidth;
  }

  getMapScale() {
    const img = this.elements.worldMap;
    const containerWidth = img.clientWidth;
    const containerHeight = img.clientHeight;
    
    const imageAspectRatio = this.mapDimensions.width / this.mapDimensions.height;
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
      scaleX: renderedWidth / this.mapDimensions.width,
      scaleY: renderedHeight / this.mapDimensions.height,
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
    // Pulse effect settings
    const PULSE_DURATION = 1500; // Time in milliseconds (lower = faster pulse)
    const PULSE_INTENSITY = 0.2; // How much it grows (0.3 = 30% bigger)
    const PULSE_MIN_SCALE = 1.0; // Base size (1.0 = no scaling at min pulse)
    const container = document.querySelector('.map-container');
    this.elements.canvas.width = container.clientWidth;
    this.elements.canvas.height = container.clientHeight;

    this.ctx.clearRect(0, 0, this.elements.canvas.width, this.elements.canvas.height);
    this.elements.worldMap.style.cursor = this.hoveredProvince ? 'pointer' : 'default';

    const scale = this.getMapScale();

    // Get the most recent marker
    const markersArray = Array.from(this.worldMapMarkers.values());
    const lastMarker = markersArray[0];

    // Calculate the pulse effect for the most recent marker
    const pulseTime = (Date.now() % PULSE_DURATION) / PULSE_DURATION; // Normalized cycle time
    const pulseScale = PULSE_MIN_SCALE + PULSE_INTENSITY * Math.sin(pulseTime * Math.PI * 2); // Smooth pulse

    // Draw connecting lines between markers
    if (this.worldMapMarkers.size > 1) {
      const sortedMarkers = markersArray
        .map(marker => ({
          ...marker,
          center: this.regionCenters[marker.regionName]
        }))
        .sort((a, b) => a.order - b.order);

      this.ctx.strokeStyle = 'white';
      this.ctx.lineWidth = 2;

      for (let i = 0; i < sortedMarkers.length - 1; i++) {
        const current = sortedMarkers[i];
        const next = sortedMarkers[i + 1];

        if (current.center && next.center) {
          const fromX = current.center.x * scale.scaleX + scale.offsetX;
          const fromY = current.center.y * scale.scaleY + scale.offsetY;
          const toX = next.center.x * scale.scaleX + scale.offsetX;
          const toY = next.center.y * scale.scaleY + scale.offsetY;

          this.ctx.beginPath();
          this.ctx.moveTo(fromX, fromY);
          this.ctx.lineTo(toX, toY);
          this.ctx.stroke();
        }
      }
    }

    // Draw all markers
    for (const [region, marker] of this.worldMapMarkers) {
      const center = this.regionCenters[region];
      if (center) {
        const x = center.x * scale.scaleX + scale.offsetX;
        const y = center.y * scale.scaleY + scale.offsetY;

        const isRecent = marker === lastMarker;
        const markerSize = isRecent ? this.markerSize * pulseScale : this.markerSize; // Apply pulse effect

        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.arc(x, y, markerSize / 2, 0, 2 * Math.PI);
        this.ctx.clip();

        this.ctx.drawImage(
          this.markerImage,
          x - markerSize / 2,
          y - markerSize / 2,
          markerSize,
          markerSize
        );

        this.ctx.restore();

        // Draw marker border
        this.ctx.beginPath();
        this.ctx.arc(x, y, markerSize / 2, 0, 2 * Math.PI);
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
      }
    }

    // Draw hovered province label if applicable
    if (this.hoveredProvince) {
      this.drawProvinceLabel();
    }

    requestAnimationFrame(() => this.drawProvinceShapes()); // Keep animation running smoothly
  }

  drawProvinceLabel() {
    this.ctx.fillStyle = 'white';
    this.ctx.strokeStyle = 'black';
    this.ctx.lineWidth = 3;
    this.ctx.font = 'bold 16px Arial';
    
    const textMetrics = this.ctx.measureText(this.hoveredProvince);
    const textWidth = textMetrics.width;
    const textHeight = 16;
    const padding = 10;
    
    let textX = this.mousePos.x + padding;
    let textY = this.mousePos.y + padding;
    
    if (textX > this.elements.canvas.width - textWidth - padding) {
      textX = this.mousePos.x - 5;
      this.ctx.textAlign = 'right';
    } else {
      this.ctx.textAlign = 'left';
    }
    
    if (textY > this.elements.canvas.height - textHeight - padding) {
      textY = this.mousePos.y - textHeight - padding;
      this.ctx.textBaseline = 'bottom';
    } else {
      this.ctx.textBaseline = 'top';
    }
    
    this.ctx.strokeText(this.hoveredProvince, textX, textY);
    this.ctx.fillText(this.hoveredProvince, textX, textY);
  }

  bindEvents() {
    this.elements.worldMap.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.elements.worldMap.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
    this.elements.worldMap.addEventListener('mousedown', () => this.drawProvinceShapes());
    this.elements.worldMap.addEventListener('mouseup', () => this.drawProvinceShapes());
    this.elements.worldMap.addEventListener('click', this.handleWorldMapClick.bind(this));
    this.elements.regionMap.addEventListener('click', () => this.showWorldMap());
    window.onpopstate = () => this.handleUrlParams();
  }

  handleMouseMove(event) {
    const rect = event.target.getBoundingClientRect();
    const scale = this.getMapScale();
    
    this.mousePos = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
    
    const x = (this.mousePos.x - scale.offsetX) / scale.scaleX;
    const y = (this.mousePos.y - scale.offsetY) / scale.scaleY;
    
    const found = Object.entries(this.provinceShapes).find(([_, points]) => 
      this.isPointInPolygon(x, y, points, 5)
    )?.[0] || null;

    if (found !== this.hoveredProvince) {
      this.hoveredProvince = found;
      this.drawProvinceShapes();
    } else if (this.hoveredProvince) {
      this.drawProvinceShapes();
    }
  }

  handleMouseLeave() {
    this.hoveredProvince = null;
    this.drawProvinceShapes();
  }

  handleWorldMapClick(event) {
    const rect = event.target.getBoundingClientRect();
    const scale = this.getMapScale();
    
    const x = Math.round((event.clientX - rect.left - scale.offsetX) / scale.scaleX);
    const y = Math.round((event.clientY - rect.top - scale.offsetY) / scale.scaleY);
    
    if (this.hoveredProvince && this.regionMap[this.hoveredProvince]) {
      this.showRegionMap(this.hoveredProvince, x, y);
      this.fetchDaggerwalkLogs(this.hoveredProvince);
      const params = new URLSearchParams(window.location.search);
      params.set('region', this.hoveredProvince);
      history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);
    }
  }
}

// Initialize the map viewer
window.onload = async () => {
  const mapViewer = new MapViewer();
  mapViewer.markerImage.src = `${mapViewer.config.baseS3Url}/img/daggerwalk/Daggerwalk.ico`;
  await mapViewer.init();
  mapViewer.addAllWorldMapMarkers();
};