// Initialize empty objects for the data
let provinceShapes = {};
let regionMap = {};

let mapWidth, mapHeight;
let worldMapView = document.getElementById('worldMapView');
let regionMapView = document.getElementById('regionMapView');
let worldMap = document.getElementById('worldMap');
let canvas = document.getElementById('overlay');
let ctx = canvas.getContext('2d');
let loadingElement = document.getElementById('loading');

// Add variables to track mouse position
let mouseX = 0;
let mouseY = 0;
let hoveredProvince = null;

// Function to load JSON data
async function loadMapData() {
    try {
        const [shapesResponse, regionsResponse] = await Promise.all([
            fetch('https://kershnerportfolio.s3.us-east-2.amazonaws.com/static/daggerwalk/data/province_shapes.json'),
            fetch('https://kershnerportfolio.s3.us-east-2.amazonaws.com/static/daggerwalk/data/region_fmap_mapping.json')
        ]);

        if (!shapesResponse.ok || !regionsResponse.ok) {
            throw new Error('Failed to fetch map data');
        }

        provinceShapes = await shapesResponse.json();
        regionMap = await regionsResponse.json();

        // Hide loading message and show world map
        loadingElement.classList.add('hidden');
        worldMapView.classList.remove('hidden');

        // Initialize the map after data is loaded
        initializeMap();
    } catch (error) {
        console.error('Error loading map data:', error);
        loadingElement.textContent = 'Error loading map data. Please refresh the page.';
        loadingElement.classList.add('error');
    }
}

function initializeMap() {
    handleUrlParams();
    
    // Set up world map sizing
    worldMap.onload = function() {
        mapWidth = worldMap.naturalWidth;
        mapHeight = worldMap.naturalHeight;
        canvas.width = worldMap.width;
        canvas.height = worldMap.height;
        drawProvinceShapes();
    };

    // Trigger onload if image is already loaded
    if (worldMap.complete) {
        worldMap.onload();
    }
}

function calculateRegionMapScale(img) {
    const originalWidth = img.naturalWidth;
    const currentWidth = img.clientWidth;
    return currentWidth / originalWidth;
}

// Handle URL parameters on load
function handleUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const region = urlParams.get('region');
    const x = urlParams.get('x');
    const y = urlParams.get('y');

    if (region && regionMap[region]) {
        showRegionMap(region, x, y);
    }
}

// View switching functions
function showWorldMap() {
    worldMapView.classList.remove('hidden');
    regionMapView.classList.add('hidden');
    history.pushState({}, '', window.location.pathname);
}

function showRegionMap(regionName, x, y) {
    if (!regionMap[regionName]) return;

    worldMapView.classList.add('hidden');
    regionMapView.classList.remove('hidden');
    
    const regionData = regionMap[regionName];
    let selectedPart;

    if (regionData.multi_part) {
        if (x && y) {
            selectedPart = regionData.parts.find(part => 
                x >= part.offset.x && y >= part.offset.y
            ) || regionData.parts[0];
        } else {
            selectedPart = regionData.parts[0];
        }
        document.getElementById('regionMap').src = `${window.BASE_S3_URL}/img/daggerwalk/maps/${selectedPart.fmap_image}`;
    } else {
        selectedPart = regionData;
        document.getElementById('regionMap').src = `${window.BASE_S3_URL}/img/daggerwalk/maps/${regionData.fmap_image}`;
    }

    if (x && y) {
        const regionImg = document.getElementById('regionMap');
        
        regionImg.onload = () => {
            const scaleFactor = calculateRegionMapScale(regionImg);
            const scale = (selectedPart.fmap_image === 'FMAP0I19.PNG') ? 4 : 1;
            
            const screenX = (x - selectedPart.offset.x) * scale * scaleFactor;
            const screenY = (y - selectedPart.offset.y) * scale * scaleFactor;
            
            const marker = document.getElementById('marker');
            marker.style.left = `${screenX}px`;
            marker.style.top = `${screenY}px`;
            marker.classList.remove('hidden');
        };
    } else {
        document.getElementById('marker').classList.add('hidden');
    }

    const params = new URLSearchParams();
    params.set('region', regionName);
    if (x) params.set('x', x);
    if (y) params.set('y', y);
    history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);
}

// Handle back/forward browser navigation
window.onpopstate = handleUrlParams;

// Ray casting algorithm for point-in-polygon detection
function isPointInPolygon(x, y, polygon, tolerance = 5) {
    for (let dx = -tolerance; dx <= tolerance; dx++) {
        for (let dy = -tolerance; dy <= tolerance; dy++) {
            if (isPointInPolygonCore(x + dx, y + dy, polygon)) {
                return true;
            }
        }
    }
    return false;
}

function isPointInPolygonCore(x, y, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][0], yi = polygon[i][1];
        const xj = polygon[j][0], yj = polygon[j][1];
        
        const intersect = ((yi > y) !== (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function getMapScale() {
    const img = document.getElementById('worldMap');
    const containerWidth = img.clientWidth;
    const containerHeight = img.clientHeight;
    
    let renderedWidth, renderedHeight;
    const imageAspectRatio = mapWidth / mapHeight;
    const containerAspectRatio = containerWidth / containerHeight;

    if (containerAspectRatio > imageAspectRatio) {
        renderedHeight = containerHeight;
        renderedWidth = containerHeight * imageAspectRatio;
    } else {
        renderedWidth = containerWidth;
        renderedHeight = containerWidth / imageAspectRatio;
    }

    const xOffset = (containerWidth - renderedWidth) / 2;
    const yOffset = (containerHeight - renderedHeight) / 2;

    return {
        scaleX: renderedWidth / mapWidth,
        scaleY: renderedHeight / mapHeight,
        offsetX: xOffset,
        offsetY: yOffset
    };
}

function drawProvinceShapes() {
    const container = document.querySelector('.map-container');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const scale = getMapScale();

    worldMap.style.cursor = hoveredProvince ? 'pointer' : 'default';

    Object.entries(provinceShapes).forEach(([province, points]) => {
        if (province === hoveredProvince) {
            ctx.fillStyle = 'white';
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 3;
            ctx.font = 'bold 16px Arial';
            
            const textMetrics = ctx.measureText(province);
            const textWidth = textMetrics.width;
            const textHeight = 16;
            const padding = 10;
            
            let textX = mouseX + padding;
            let textY = mouseY + padding;
            
            const rightEdge = canvas.width - textWidth - padding;
            const bottomEdge = canvas.height - textHeight - padding;
            
            if (textX > rightEdge) {
                textX = mouseX - 5;
                ctx.textAlign = 'right';
            } else {
                ctx.textAlign = 'left';
            }
            
            if (textY > bottomEdge) {
                textY = mouseY - textHeight - padding;
                ctx.textBaseline = 'bottom';
            } else {
                ctx.textBaseline = 'top';
            }
            
            ctx.strokeText(province, textX, textY);
            ctx.fillText(province, textX, textY);
        }
    });
}

// Event Listeners
worldMap.addEventListener('mousemove', function(event) {
    const rect = event.target.getBoundingClientRect();
    const scale = getMapScale();
    
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    
    const x = (mouseX - scale.offsetX) / scale.scaleX;
    const y = (mouseY - scale.offsetY) / scale.scaleY;
    
    let found = null;
    for (const [province, points] of Object.entries(provinceShapes)) {
        if (isPointInPolygon(x, y, points, 5)) {
            found = province;
            break;
        }
    }

    if (found !== hoveredProvince) {
        hoveredProvince = found;
        drawProvinceShapes();
    } else if (hoveredProvince) {
        drawProvinceShapes();
    }
});

worldMap.addEventListener('mouseleave', function() {
    hoveredProvince = null;
    drawProvinceShapes();
});

worldMap.addEventListener('mousedown', function(event) {
    if (hoveredProvince) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        drawProvinceShapes();
    }
});

worldMap.addEventListener('mouseup', function(event) {
    if (hoveredProvince) {
        drawProvinceShapes();
    }
});

worldMap.addEventListener('click', function(event) {
    const rect = event.target.getBoundingClientRect();
    const scale = getMapScale();
    
    const x = Math.round((event.clientX - rect.left - scale.offsetX) / scale.scaleX);
    const y = Math.round((event.clientY - rect.top - scale.offsetY) / scale.scaleY);
    
    if (hoveredProvince && regionMap[hoveredProvince]) {
        showRegionMap(hoveredProvince, x, y);
    }
});

document.getElementById('regionMap').addEventListener('click', showWorldMap);

window.addEventListener('resize', () => {
    drawProvinceShapes();
    
    const urlParams = new URLSearchParams(window.location.search);
    const region = urlParams.get('region');
    const x = urlParams.get('x');
    const y = urlParams.get('y');
    
    if (region && x && y) {
        showRegionMap(region, x, y);
    }
});

// Start loading data when the page loads
window.onload = loadMapData;