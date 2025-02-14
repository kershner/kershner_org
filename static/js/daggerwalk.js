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
    this.worldMapMarkerLineColor = 'white';
    this.worldMapMarkerLineOpacity = 0.8;
    
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
        shapes: 'https://kershnerportfolio.s3.us-east-2.amazonaws.com/static/daggerwalk/data/province_shapes_optimized.json',
        regions: 'https://kershnerportfolio.s3.us-east-2.amazonaws.com/static/daggerwalk/data/region_fmap_mapping.json'
      }
    };

    this.bindEvents();
  }

  async init() {
    await this.loadMapData();
    this.calculateRegionCenters();
    await this.handleUrlParams();
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
        const uniquePoints = points.filter((point, index) => {
          const nextPoint = points[index + 1];
          return !nextPoint || point[0] !== nextPoint[0] || point[1] !== nextPoint[1];
        });

        const xValues = uniquePoints.map(([x, _]) => x);
        const yValues = uniquePoints.map(([_, y]) => y);
        const minX = Math.min(...xValues);
        const maxX = Math.max(...xValues);
        const minY = Math.min(...yValues);
        const maxY = Math.max(...yValues);

        this.regionCenters[provinceName] = {
          x: (minX + maxX) / 2,
          y: (minY + maxY) / 2
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

  async handleUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const region = params.get('region');
    const x = params.get('x');
    const y = params.get('y');

    if (region && this.regionMap[region]) {
        if (x && y) {
            // If we have specific coordinates, use those
            const regionData = this.regionMap[region];
            const selectedPart = this.getSelectedRegionPart(regionData, parseInt(x), parseInt(y));
            
            await this.showRegionMap(region, parseInt(x), parseInt(y), selectedPart);
            this.addLogMarker(region, parseInt(x), parseInt(y), selectedPart);
            
            // Update URL
            const params = new URLSearchParams(window.location.search);
            params.set('region', region);
            history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);
        } else {
            // Otherwise fetch all logs
            await this.fetchDaggerwalkLogs(region);
        }
    }
  }

  async fetchDaggerwalkLogs(region) {
    try {
      const response = await fetch(`/daggerwalk/logs/?region=${encodeURIComponent(region)}`);
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      
      const data = await response.json();
      if (!data.length) return;

      const sortedData = [...data].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      const mostRecentLog = sortedData[0];
      const regionData = this.regionMap[region];
      const selectedPart = this.getSelectedRegionPart(regionData, mostRecentLog.map_pixel_x, mostRecentLog.map_pixel_y);

      await this.showRegionMap(
          region, 
          mostRecentLog.map_pixel_x, 
          mostRecentLog.map_pixel_y,
          selectedPart
      );

      this.clearLogMarkers();

      const filteredLogs = sortedData.filter(log => {
          const logPart = this.getSelectedRegionPart(regionData, log.map_pixel_x, log.map_pixel_y);
          return logPart.fmap_image === selectedPart.fmap_image;
      });

      filteredLogs.forEach(log => {
          this.addLogMarker(log.region, log.map_pixel_x, log.map_pixel_y, selectedPart);
      });

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

  async showRegionMap(regionName, x, y, forcePart = null) {
    if (!this.regionMap[regionName]) return Promise.resolve();

    this.elements.worldMapView.classList.add('hidden');
    this.elements.regionMapView.classList.remove('hidden');

    const regionData = this.regionMap[regionName];
    const selectedPart = forcePart || 
        (x && y ? this.getSelectedRegionPart(regionData, x, y) : regionData.parts[0]);
    
    const newSrc = `${this.config.baseS3Url}/img/daggerwalk/maps/${selectedPart.fmap_image}`;

    return new Promise((resolve) => {
        this.elements.regionMap.onload = () => {
            this.clearLogMarkers();
            resolve();
        };
        this.elements.regionMap.src = newSrc;
    });
  }

  // Helper method to check if point is within part bounds
  isPointWithinPart(x, y, part) {
    if (!part.offset) return false;
    
    const MAP_WIDTH = 92;
    const MAP_HEIGHT = 80;
    
    const startX = part.offset.x;
    const startY = part.offset.y;
    const endX = startX + MAP_WIDTH;
    const endY = startY + MAP_HEIGHT;
    
    return x >= startX && x < endX && y >= startY && y < endY;
  }

  addAllWorldMapMarkers() {
    this.clearWorldMapMarkers();
    if (window.REGION_DATA) {
      window.REGION_DATA.forEach((data, i) => {
        this.addWorldMapMarker({
          regionName: data.region,
          latestDate: data.latest_date,
          reset: data.latest_reset,
          location: data.latest_location,
          weather: data.latest_weather,
          currentSong: data.latest_current_song,
          order: i
        });
      });
    }
  }

  addWorldMapMarker(markerData) {
    this.worldMapMarkers.set(markerData.regionName, markerData);
    this.drawProvinceShapes();
  }

  clearWorldMapMarkers() {
    this.worldMapMarkers.clear();
    this.drawProvinceShapes();
  }

  addLogMarker(regionName, x, y, forcePart = null) {
    if (!x || !y) return;
  
    requestAnimationFrame(() => {
        const regionData = this.regionMap[regionName];
        if (!regionData) return;
  
        const selectedPart = forcePart || this.getSelectedRegionPart(regionData, x, y);
        if (!selectedPart || !selectedPart.offset) return;

        const mapContainer = document.querySelector('#regionMapView .map-container');
        document.querySelectorAll('.marker').forEach(marker => marker.classList.remove('recent'));
  
        const scaleFactor = this.elements.regionMap.clientWidth / this.elements.regionMap.naturalWidth;
        const scale = selectedPart.fmap_image === 'FMAP0I19.PNG' ? 4 : 1;
        const adjustedX = (x - selectedPart.offset.x) * scale * scaleFactor;
        const adjustedY = (y - selectedPart.offset.y) * scale * scaleFactor;
  
        const marker = document.createElement('div');
        marker.classList.add('marker', 'recent');
        marker.style.left = `${adjustedX}px`;
        marker.style.top = `${adjustedY}px`;
        mapContainer.appendChild(marker);
    });
  }

  clearLogMarkers() {
    document.querySelectorAll(`#${this.elements.regionMapView.id} .marker`).forEach(marker => marker.remove());
  }

  getSelectedRegionPart(regionData, x, y) {
    if (!regionData?.multi_part || !regionData?.parts?.length) {
        return regionData;
    }

    x = parseInt(x);
    y = parseInt(y);
    
    const MAP_WIDTH = 92;
    const MAP_HEIGHT = 80;
    
    // Try to find exact part match
    const exactPart = regionData.parts.find(part => {
        if (!part.offset) return false;
        const startX = part.offset.x;
        const startY = part.offset.y;
        return x >= startX && x < (startX + MAP_WIDTH) && 
               y >= startY && y < (startY + MAP_HEIGHT);
    });
    
    if (exactPart) return exactPart;
    
    // Find closest part if no exact match
    if (!isNaN(x) && !isNaN(y)) {
        return regionData.parts.reduce((closest, part) => {
            if (!closest || !part.offset) return closest || part;
            
            const closestCenter = {
                x: closest.offset.x + MAP_WIDTH/2,
                y: closest.offset.y + MAP_HEIGHT/2
            };
            
            const thisCenter = {
                x: part.offset.x + MAP_WIDTH/2,
                y: part.offset.y + MAP_HEIGHT/2
            };
            
            const closestDist = Math.hypot(x - closestCenter.x, y - closestCenter.y);
            const thisDist = Math.hypot(x - thisCenter.x, y - thisCenter.y);
            
            return thisDist < closestDist ? part : closest;
        }, null);
    }
    
    return regionData.parts[0];
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
    // Set up canvas
    const container = document.querySelector('.map-container');
    this.elements.canvas.width = container.clientWidth;
    this.elements.canvas.height = container.clientHeight;
    this.ctx.clearRect(0, 0, this.elements.canvas.width, this.elements.canvas.height);
    this.elements.worldMap.style.cursor = this.hoveredProvince ? 'pointer' : 'default';

    const scale = this.getMapScale();
    const markersArray = Array.from(this.worldMapMarkers.values());
    const lastMarker = markersArray[0];

    // Pulse effect settings
    const pulseTime = (Date.now() % 1500) / 1500;
    const pulseScale = 1.0 + 0.2 * Math.sin(pulseTime * Math.PI * 2);

    // Draw connecting lines between markers
    if (this.worldMapMarkers.size > 1) {
      this.drawConnectingLines(markersArray, scale);
    }

    // Draw world map markers
    this.drawWorldMapMarkers(markersArray, scale, pulseScale, lastMarker);

    // Draw province label if hovering
    if (this.hoveredProvince) {
      this.drawProvinceLabel();
    }

    requestAnimationFrame(() => this.drawProvinceShapes());
  }

  drawConnectingLines(markers, scale) {
    const sortedMarkers = markers
      .map(marker => ({
        ...marker,
        center: this.regionCenters[marker.regionName]
      }))
      .sort((a, b) => a.order - b.order);

    // Convert rgb color to rgba with opacity
    const lineColor = this.worldMapMarkerLineColor.replace('rgb', 'rgba').replace(')', `,${this.worldMapMarkerLineOpacity})`);
    this.ctx.strokeStyle = lineColor;
    this.ctx.fillStyle = lineColor;
    this.ctx.lineWidth = 2;
    
    for (let i = 0; i < sortedMarkers.length - 1; i++) {
      const current = sortedMarkers[i];
      const next = sortedMarkers[i + 1];

      if (current.reset || next.reset || !current.center || !next.center) continue;

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
        this.ctx.arc(x, y, 2.5, 0, Math.PI * 2); // Slightly smaller dots
        this.ctx.fill();
      }
    }
  }

  drawWorldMapMarkers(markers, scale, pulseScale, lastMarker) {
    markers.forEach(marker => {
      const center = this.regionCenters[marker.regionName];
      if (!center) return;

      const x = center.x * scale.scaleX + scale.offsetX;
      const y = center.y * scale.scaleY + scale.offsetY;
      const size = marker === lastMarker ? 
        this.markerSize * pulseScale : 
        this.markerSize;

      // Draw marker with border
      this.ctx.save();
      
      // Draw border
      this.ctx.beginPath();
      this.ctx.arc(x, y, size / 2 + 2, 0, 2 * Math.PI);
      this.ctx.strokeStyle = this.worldMapMarkerLineColor.replace('rgb', 'rgba').replace(')', `,${
        marker === lastMarker ? this.worldMapMarkerLineOpacity * 1.2 : this.worldMapMarkerLineOpacity
      })`);
      this.ctx.lineWidth = marker === lastMarker ? 3 : 2;
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
    });
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
    const { worldMap, regionMap } = this.elements;
    
    worldMap.addEventListener('mousemove', this.handleMouseMove.bind(this));
    worldMap.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
    worldMap.addEventListener('mousedown', () => this.drawProvinceShapes());
    worldMap.addEventListener('mouseup', () => this.drawProvinceShapes());
    worldMap.addEventListener('click', this.handleWorldMapClick.bind(this));
    regionMap.addEventListener('click', () => this.showWorldMap());
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
    
    // Find all regions containing this point
    const containingRegions = Object.entries(this.provinceShapes)
      .filter(([_, points]) => this.isPointInPolygon(x, y, points, 5))
      .map(([name]) => name);

    // If we found any regions, select the smallest one (child)
    if (containingRegions.length > 0) {
      const smallestRegion = containingRegions.reduce((smallest, current) => {
        if (!smallest) return current;
        
        const currentPoints = this.provinceShapes[current];
        const smallestPoints = this.provinceShapes[smallest];
        
        // Calculate bounding boxes
        const currentBounds = this.calculateBounds(currentPoints);
        const smallestBounds = this.calculateBounds(smallestPoints);
        
        // Compare areas
        const currentArea = (currentBounds.maxX - currentBounds.minX) * 
                          (currentBounds.maxY - currentBounds.minY);
        const smallestArea = (smallestBounds.maxX - smallestBounds.minX) * 
                           (smallestBounds.maxY - smallestBounds.minY);
        
        return currentArea < smallestArea ? current : smallest;
      }, null);

      if (smallestRegion !== this.hoveredProvince) {
        this.hoveredProvince = smallestRegion;
        this.drawProvinceShapes();
      }
    } else if (this.hoveredProvince) {
      this.hoveredProvince = null;
      this.drawProvinceShapes();
    }
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