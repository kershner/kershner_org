class MapViewer {
  constructor() {
    this.state = {
      provinceShapes: window.daggerwalkData.provinceShapes,
      regionMap: window.daggerwalkData.regionMap,
      regionData: window.daggerwalkData.regionData,
      mousePos: { x: 0, y: 0 },
      hoveredProvince: null,
      fetchTimer: null,
      worldMapMarkers: new Map(),
      regionCenters: {},
      mapDimensions: { width: 0, height: 0 },
      currentRegion: null,
    };

    this.config = {
      regionFetchInterval: 20000,
      baseS3Url: window.BASE_S3_URL,
      breakpoints: {
        mobile: 768
      },
      worldMapMarkerStyle: {
        size: {
          mobile: 10,
          desktop: 32
        },
        dotSize: {
          mobile: 1.0,
          desktop: 2.5
        },
        lineWidth: 1,
        lineColor: 'white',
        lineOpacity: 0.8
      },
      mapConstants: {
        width: 92,
        height: 80
      },
    };

    this.elements = {
      worldMapView: document.getElementById('worldMapView'),
      regionMapView: document.getElementById('regionMapView'),
      worldMap: document.getElementById('worldMap'),
      regionName: document.getElementById('regionName'),
      provinceName: document.getElementById('provinceName'),
      regionMap: document.getElementById('regionMap'),
      canvas: document.getElementById('overlay'),
      loading: document.getElementById('loading')
    };

    this.ctx = this.elements.canvas.getContext('2d');
    this.markerImage = new Image();
    this.animationFrameId = null;
    this.initTooltip();
    this.bindEvents();
  }

  async init() {
    this.loadMapData();
    this.calculateRegionCenters();
    this.initializeMap();
  }

  async loadMapData() {
    try {
      this.elements.loading.classList.add('hidden');
      this.elements.worldMapView.classList.remove('hidden');
    } catch (error) {
      console.error('Error loading map data:', error);
      this.elements.loading.textContent = 'Error loading map data. Please refresh the page.';
      this.elements.loading.classList.add('error');
    }
  }

  isMobile() {
    return window.innerWidth <= this.config.breakpoints.mobile;
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
      
      // Remove the onload handler to prevent memory leaks
      this.elements.worldMap.onload = null;
    };
  
    if (this.elements.worldMap.complete) {
      onLoad();
    } else {
      this.elements.worldMap.onload = onLoad;
    }
  }

  initTooltip(selector = '.log-marker, .capital-marker') {
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    document.body.appendChild(tooltip);
    
    const weatherEmoji = {
      "Sunny": "☀️", "Clear": "🌙", "Cloudy": "☁️", "Foggy": "🌫️",
      "Rainy": "🌧️", "Snowy": "🌨️", "Thunderstorm": "⛈️", "Blizzard": "❄️"
    };
    
    const seasonEmoji = {
      "Winter": "☃️", "Spring": "🌸", "Summer": "🌻", "Autumn": "🍂"
    };
    
    // Store the handler as a property so we can remove it later
    this.tooltipMouseOverHandler = e => {
      const el = e.target.closest(selector);
      if (el) {
        const {left, top, width} = el.getBoundingClientRect();
        
        tooltip.innerHTML = Object.entries(el.dataset)
        .map(([k, v]) => {
          let prefix = '';
          let displayValue = v;
          
          switch(k) {
            case 'mapPixel': prefix = '🌍'; break;
            case 'season': prefix = seasonEmoji[v] || ''; break;
            case 'weather': prefix = weatherEmoji[v] || ''; break;
            case 'currentSong': prefix = '🎵'; displayValue = v.replace('song_', ''); break;
            case 'createdAt': prefix = '⌚'; break;
            case 'date': prefix = '📅'; break;
            case 'capitalCity': prefix = '🏰'; break;
            case 'location':
              // Find the index of the first alphabetic character
              const alphaIndex = v.search(/[a-zA-Z]/);
              if (alphaIndex > 0) {
                prefix = v.substring(0, alphaIndex);
                displayValue = v.substring(alphaIndex);
              }
              break;
            // Skip the emoji entry
            case 'emoji': return '';
          }

          const key = k.replace(/([A-Z])/g, ' $1')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
            
          return `<div class="row"><span class="key">${key}</span><span class="value"><span>${prefix}</span><span>${displayValue}</span></span></div>`;
        })
        .filter(row => row !== '') // Filter out any empty strings
        .join('');
  
        // Make tooltip visible first with initial position
        tooltip.style.left = left + width/2 + 'px';
        tooltip.style.top = top - 10 + 'px';
        tooltip.style.transform = 'translate(-50%, -100%)';
        tooltip.classList.add('visible');
        
        // Get tooltip dimensions after it's visible
        const tooltipRect = tooltip.getBoundingClientRect();
        const tooltipWidth = tooltipRect.width;
        const tooltipHeight = tooltipRect.height;
        
        // Adjust position if needed
        let finalLeft = left + width/2;
        let finalTop = top - 10;
        
        // Check horizontal boundaries
        if (finalLeft - tooltipWidth/2 < 10) {
          // Too far left - align with left edge + padding
          finalLeft = tooltipWidth/2 + 10;
        } else if (finalLeft + tooltipWidth/2 > window.innerWidth - 10) {
          // Too far right - align with right edge - padding
          finalLeft = window.innerWidth - tooltipWidth/2 - 10;
        }
        
        // Check vertical boundaries
        if (finalTop - tooltipHeight < 10) {
          // Too high - show below the element instead
          finalTop = top + 25;
          tooltip.style.transform = 'translate(-50%, 0)';
        } else {
          tooltip.style.transform = 'translate(-50%, -100%)';
        }
        
        // Apply final position
        tooltip.style.left = finalLeft + 'px';
        tooltip.style.top = finalTop + 'px';
      }
    };
  
    // Store the mouseout handler as well
    this.tooltipMouseOutHandler = e => {
      const el = e.target.closest(selector);
      const relatedTarget = e.relatedTarget?.closest(selector);
      if (el && !relatedTarget) {
        tooltip.classList.remove('visible');
      }
    };
    
    // Store reference to tooltip for potential removal later
    this.tooltip = tooltip;
    
    // Add event listeners with stored handlers
    document.addEventListener('mouseover', this.tooltipMouseOverHandler);
    document.addEventListener('mouseout', this.tooltipMouseOutHandler);
  }

  updateUrl(region) {
    const params = new URLSearchParams(window.location.search);
    params.set('region', region);
    history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);
  }

  // Converts LogMarker.date Elder Scrolls date to 12 hour time format
  convertElderScrollsTime(dateString) {
    const timePart = dateString.split(', ').pop();
    const [hours, minutes, seconds] = timePart.split(':').map(Number);
    // Convert to 12-hour format
    const period = hours >= 12 ? 'PM' : 'AM';
    const twelveHour = hours % 12 || 12;
    const formattedTime = `${twelveHour}:${minutes.toString().padStart(2, '0')} ${period}`;
    return dateString.replace(timePart, formattedTime);
  }

  createMarkerData(log) {
    const region = log.region_fk || log.region;
    const isPOI = log.poi || (log.type && log.name);
    
    // Determine location string
    let location;
    if (isPOI) {
      location = log.poi ? `${log.poi.emoji}${log.poi.name}` : `${log.emoji}${log.name}`;
    } else {
      location = region && region.climate && log.location ? 
        `${region.emoji}${region.climate} ${log.location}` : log.location;
    }
  
    // Create base marker data
    const markerData = {};
    
    // Only add properties that exist in the source data
    if (location) markerData.location = location;
    
    // Add emoji and type only for POI markers
    if (isPOI) {
      if (log.poi && log.poi.emoji) {
        markerData.emoji = log.poi.emoji;
        // Add type if available
        if (log.poi.type) markerData.type = log.poi.type;
      } else if (log.emoji) {
        markerData.emoji = log.emoji;
        // Add type if available
        if (log.type) markerData.type = log.type;
      }
    }
    
    // Add other properties only if they exist
    if (log.date) markerData.date = this.convertElderScrollsTime(log.date);
    if (log.season) markerData.season = log.season;
    if (log.weather) markerData.weather = log.weather;
    if (log.current_song) markerData.currentSong = log.current_song;
    else if (log.currentSong) markerData.currentSong = log.currentSong;
    if (log.created_at) markerData.createdAt = this.convertToEST(log.created_at);
    
    return markerData;
  }

  async fetchRegionData(region) {
    try {
      const response = await fetch(`/daggerwalk/logs/?region=${encodeURIComponent(region)}`);
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      
      const data = await response.json();
      if (!data.logs || !data.logs.length) return;
  
      const regionData = this.state.regionMap[region];
      const mostRecentLog = data.logs[data.logs.length - 1];
      
      // Parse coordinates once
      const recentX = parseInt(mostRecentLog.map_pixel_x);
      const recentY = parseInt(mostRecentLog.map_pixel_y);
      
      // Get the selected part for the most recent log
      const selectedPart = this.getSelectedRegionPart(regionData, recentX, recentY);
  
      this.clearLogMarkers();
      
      // Show region map with most recent log position
      await this.showRegionMap(region, recentX, recentY);
  
      // Filter logs based on device type
      const mobileLogSamplingRate = 3;
      const logsToShow = this.isMobile() 
        ? data.logs.filter((_, index) => index % mobileLogSamplingRate === 0)
        : data.logs;
      
      // Track marker positions to avoid duplicates
      const markerPositions = new Set();
      
      logsToShow.forEach(log => {
        // Get region name safely
        const regionName = log.region_fk ? log.region_fk.name : 
                           (typeof log.region === 'object' ? log.region.name : log.region);
        
        // Get coordinates
        const x = parseInt(log.map_pixel_x);
        const y = parseInt(log.map_pixel_y);
        
        // Create a unique position key
        const positionKey = `${x},${y}`;
        
        // Only add marker if position hasn't been used yet
        if (!markerPositions.has(positionKey) && !isNaN(x) && !isNaN(y)) {
          markerPositions.add(positionKey);
          
          this.addLogMarker(
            regionName, 
            x, 
            y, 
            selectedPart,
            this.createMarkerData(log)
          );
        }
      });
  
      if (daggerwalk.latestLog && daggerwalk.latestLog.region === this.state.currentRegion) {
        this.scheduleNextLogFetch();
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
      this.scheduleNextLogFetch(10000);
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
            this.fetchRegionData(this.state.currentRegion);
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
    this.fetchRegionData(region);
  }

  stopLogPolling() {
    if (this.state.fetchTimer) {
        clearTimeout(this.state.fetchTimer);
        this.state.fetchTimer = null;
    }
  }

  showWorldMap() {
    // Cancel animation frame from previous state
    this.cancelProvinceShapesAnimation();
    
    // Stop any polling
    this.stopLogPolling();
    
    // Clear log markers (but don't clear world map markers yet)
    this.clearLogMarkers();
    
    // Update UI state
    this.elements.worldMapView.classList.remove('hidden');
    this.elements.regionMapView.classList.add('hidden');
    this.elements.regionName.textContent = 'The Iliac Bay';
    this.elements.provinceName.textContent = 'Tamriel';
    
    // Update URL
    history.pushState({}, '', `${window.location.pathname}?region=world`);
    
    // Reset state
    this.state.currentRegion = null;
    
    // Add world map markers (this inherently clears existing world markers)
    this.addAllWorldMapMarkers();
    
    // Start a new animation loop
    this.animationFrameId = requestAnimationFrame(() => this.drawProvinceShapes());
  }

  async showRegionMap(regionName, x, y) {
    if (!this.state.regionMap[regionName]) return;
  
    // Cancel world map animation
    this.cancelProvinceShapesAnimation();
    
    // Update UI state
    this.elements.worldMapView.classList.add('hidden');
    this.elements.regionMapView.classList.remove('hidden');
    this.state.currentRegion = regionName;
  
    const regionData = this.state.regionMap[regionName];
    const otherRegionData = this.state.regionData.filter(item => item.name === regionName);
    const selectedPart = this.getSelectedRegionPart(regionData, x, y);
  
    return new Promise((resolve) => {
      this.elements.regionMap.onload = () => {
        this.elements.regionName.textContent = regionName;
        this.elements.provinceName.textContent = otherRegionData[0]?.province || '';
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

  addCapitalMarker(regionCapitalData) {
    if (!regionCapitalData.mapPixelX || !regionCapitalData.mapPixelY) return;
    
    // Call addLogMarker with the capital data and the flag
    this.addLogMarker(
      this.state.currentRegion,
      regionCapitalData.mapPixelX,
      regionCapitalData.mapPixelY,
      null,
      {
        capitalCity: regionCapitalData.name,
        isCapitalMarker: true
      }
    );
  }
  
// Modified addLogMarker function to set a random emoji
addLogMarker(regionName, x, y, forcePart = null, markerData = {}) {
    if (!x || !y) return;
  
    requestAnimationFrame(() => {
      const regionData = this.state.regionMap[regionName];
      if (!regionData) return;
      
      const selectedPart = forcePart || this.getSelectedRegionPart(regionData, x, y);
      if (!selectedPart?.offset) return;

      const marker = this.createMarkerElement(x, y, regionName, selectedPart, markerData);
      const mapContainer = document.querySelector('#regionMapView .map-container');
      
      // Only remove 'recent' class from log markers if this is not for a capital
      if (!markerData.isCapitalMarker) {
        document.querySelectorAll('.log-marker').forEach(m => m.classList.remove('recent'));
      }

      // If this is a capital marker, change its class before appending
      if (markerData.isCapitalMarker) {
        marker.classList.remove('log-marker', 'recent');
        marker.classList.add('capital-marker');
        marker.setAttribute('title', `${markerData.capitalCity} - capital city of ${regionName}`);
        
        // For capital markers, only keep the capitalCity data attribute
        const capitalCity = marker.dataset.capitalCity;
        // Clear all data attributes
        Object.keys(marker.dataset).forEach(key => {
          delete marker.dataset[key];
        });
        // Set only the capitalCity attribute
        marker.dataset.capitalCity = capitalCity;
      } 
      else if (markerData.location && 
              !markerData.location.toLowerCase().includes("wilderness") && 
              !markerData.location.toLowerCase().includes("ocean")) {
        marker.classList.add('poi');
      }
      
      mapContainer.appendChild(marker);
  
      // Keep click handler for all marker types
      const currentTooltipMarker = { ref: null };
  
      marker.addEventListener('click', (e) => {
        e.preventDefault();  // Prevents default action
        e.stopPropagation(); // Stops event from bubbling up to parent elements 
        
        const tooltip = document.querySelector('.tooltip');
        
        // If tooltip is visible AND was triggered by this marker, hide it
        if (tooltip.classList.contains('visible') && currentTooltipMarker.ref === marker) {
          tooltip.classList.remove('visible');
          currentTooltipMarker.ref = null;
        } else {
          // Show tooltip and remember which marker triggered it
          marker.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
          currentTooltipMarker.ref = marker;
        }
      });
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
    document.querySelectorAll(`#${this.elements.regionMapView.id} .log-marker, #${this.elements.regionMapView.id} .capital-marker`).forEach(marker => marker.remove());
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

  cancelProvinceShapesAnimation() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  drawProvinceShapes() {
    // Cancel any existing animation frame first to prevent accumulation
    this.cancelProvinceShapesAnimation();
    
    this.setupCanvas();
    const scale = this.getMapScale();
    const markersArray = Array.from(this.state.worldMapMarkers.values());
    const lastMarker = markersArray[0];
  
    if (this.state.worldMapMarkers.size > 1) {
      this.drawConnectingLines(markersArray, scale);
    }
  
    this.drawWorldMapMarkers(markersArray, scale, lastMarker);
  
    if (this.state.hoveredProvince) {
      this.drawProvinceLabel();
    }
  
    // Only continue the animation loop if we're in the world map view
    if (!this.elements.worldMapView.classList.contains('hidden')) {
      this.animationFrameId = requestAnimationFrame(() => this.drawProvinceShapes());
    }
  }

  setupCanvas() {
    const container = document.querySelector('.map-container');
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = container.clientWidth;
    const displayHeight = container.clientHeight;
    
    this.elements.canvas.width = displayWidth * dpr;
    this.elements.canvas.height = displayHeight * dpr;
    
    this.elements.canvas.style.width = `${displayWidth}px`;
    this.elements.canvas.style.height = `${displayHeight}px`;
    
    this.ctx.scale(dpr, dpr);
    this.ctx.clearRect(0, 0, displayWidth, displayHeight);
    
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
    
    this.elements.worldMap.style.cursor = this.state.hoveredProvince ? 'pointer' : 'default';
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
  
  drawConnectingLines(markers, scale) {
    const sortedMarkers = this.getSortedMarkers(markers);
    const lineColor = this.getLineColor();
    
    this.ctx.strokeStyle = lineColor;
    this.ctx.fillStyle = lineColor;
    this.ctx.lineWidth = 2;
    
    for (let i = 0; i < sortedMarkers.length - 1; i++) {
      const current = sortedMarkers[i];
      const next = sortedMarkers[i + 1];
      this.drawDottedLine(current, next, scale);
    }
  }

  drawDottedLine(current, next, scale) {
    const startX = current.center.x * scale.scaleX + scale.offsetX;
    const startY = current.center.y * scale.scaleY + scale.offsetY;
    const endX = next.center.x * scale.scaleX + scale.offsetX;
    const endY = next.center.y * scale.scaleY + scale.offsetY;
    
    const distance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
    const dotSpacing = this.isMobile() ? 10 : 20;
    const numberOfDots = Math.floor(distance / dotSpacing);
    
    const dotSize = this.isMobile() ? 
      this.config.worldMapMarkerStyle.dotSize.mobile : 
      this.config.worldMapMarkerStyle.dotSize.desktop;

    this.ctx.fillStyle = '#F2E530'; // Set dot color
    
    for (let j = 0; j <= numberOfDots; j++) {
      const ratio = j / numberOfDots;
      const x = startX + (endX - startX) * ratio;
      const y = startY + (endY - startY) * ratio;
      
      this.ctx.beginPath();
      this.ctx.arc(x, y, dotSize, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  drawWorldMapMarkers(markers, scale, lastMarker) {
    markers.forEach(marker => {
      const center = this.state.regionCenters[marker.regionName];
      if (!center) return;

      const x = center.x * scale.scaleX + scale.offsetX;
      const y = center.y * scale.scaleY + scale.offsetY;

      this.drawWorldMapMarker(x, y, marker === lastMarker);
    });
  }

  drawWorldMapMarker(x, y, isLastMarker) {
    const { lineColor, lineOpacity } = this.config.worldMapMarkerStyle;
    this.ctx.save();
    
    let markerSize = this.isMobile() ? 
      this.config.worldMapMarkerStyle.size.mobile : 
      this.config.worldMapMarkerStyle.size.desktop;

    markerSize = isLastMarker ? markerSize : markerSize * 0.7;
    
    const borderThickness = this.isMobile() ? 1 : 2;

    if (isLastMarker) {
      const timestamp = performance.now();
      const progress = (timestamp % 1500) / 1500; // 1.5s duration
      const scale = 1 + (Math.sin(progress * Math.PI) * 0.3); // Scale between 1 and 1.3
      
      // Apply scale transform
      this.ctx.translate(x, y);
      this.ctx.scale(scale, scale);
      this.ctx.translate(-x, -y);
    }

    this.ctx.beginPath();
    this.ctx.arc(x, y, markerSize / 2 + borderThickness, 0, 2 * Math.PI);
    this.ctx.strokeStyle = isLastMarker ? 'rgba(242, 229, 48, 0.9)' : 'rgba(128, 128, 128, 0.6)';
    this.ctx.lineWidth = borderThickness;
    this.ctx.stroke();

    // Set up grayscale filter for inactive markers
    if (!isLastMarker) {
      this.ctx.filter = 'grayscale(100%)';
    }

    // Draw marker image
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
    
    // Create bound function references for later removal
    this.boundHandleMouseMove = this.handleMouseMove.bind(this);
    this.boundHandleMouseLeave = this.handleMouseLeave.bind(this);
    this.boundHandleMouseDown = () => this.drawProvinceShapes();
    this.boundHandleMouseUp = () => this.drawProvinceShapes();
    this.boundHandleWorldMapClick = this.handleWorldMapClick.bind(this);
    this.boundHandleRegionMapClick = () => this.showWorldMap();
    
    // Add event listeners using the bound functions
    worldMap.addEventListener('mousemove', this.boundHandleMouseMove);
    worldMap.addEventListener('mouseleave', this.boundHandleMouseLeave);
    worldMap.addEventListener('click', this.boundHandleWorldMapClick);
    regionMap.addEventListener('click', this.boundHandleRegionMapClick);
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
      }
    } else if (this.state.hoveredProvince) {
      this.state.hoveredProvince = null;
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
    this.fetchRegionData(this.state.hoveredProvince);
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

  destroy() {
    // Cancel animation frame
    this.cancelProvinceShapesAnimation();
    
    // Stop polling
    this.stopLogPolling();
    
    // Remove event listeners - use bound functions to properly remove them
    this.elements.worldMap.removeEventListener('mousemove', this.boundHandleMouseMove);
    this.elements.worldMap.removeEventListener('mouseleave', this.boundHandleMouseLeave);
    this.elements.worldMap.removeEventListener('click', this.boundHandleWorldMapClick);
    this.elements.regionMap.removeEventListener('click', this.boundHandleRegionMapClick);

    document.removeEventListener('mouseover', this.tooltipMouseOverHandler);
    document.removeEventListener('mouseout', this.tooltipMouseOutHandler);
    
    // Clear markers
    this.clearLogMarkers();
    this.clearWorldMapMarkers();
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

  // Check if the region parameter is a special world map value
  const worldMapValues = ["tamriel", "all", "world"];
  const isWorldMapRequest = region && worldMapValues.includes(region.toLowerCase());

  if (isWorldMapRequest) {
    // Show the world map view
    window.mapViewer.showWorldMap();
  } else if (region && region in window.mapViewer.state.regionMap) {
    if (!isNaN(x) && !isNaN(y)) {
      window.mapViewer.showRegionMap(region, x, y).then(() => 
        window.mapViewer.addLogMarker(region, x, y)
      );
    } else {
      window.mapViewer.fetchRegionData(region);
      window.mapViewer.showRegionMap(region);
    }
  } else if (daggerwalk.latestLog && daggerwalk.latestLog.region) {
    // Use the latest log's region if the URL parameter is invalid or missing
    window.mapViewer.fetchRegionData(daggerwalk.latestLog.region);
    window.mapViewer.showRegionMap(daggerwalk.latestLog.region, 
      parseInt(daggerwalk.latestLog.map_pixel_x), 
      parseInt(daggerwalk.latestLog.map_pixel_y));
  }
  
  // Add cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (window.mapViewer) {
      window.mapViewer.destroy();
    }
  });
};