const daggerwalkMapFilters = {
  elements: {},
  state: {
    dateFrom: null,
    dateTo: null,
    poiToggle: true,
    poiSearch: ''
  },
  
  init() {
    console.log('daggerwalkMapFilters.init()');
    this.cacheElements();
    this.bindEvents();
    this.updateGlobalState();
  },
  
  cacheElements() {
    this.elements = {
      container: document.querySelector('.map-filters'),
      toggleButton: document.querySelector('.map-filters-toggle-btn'),
      dateFrom: document.querySelector('#date-from'),
      dateTo: document.querySelector('#date-to'),
      poiToggle: document.querySelector('#poi-toggle'),
      poiSearch: document.querySelector('#poi-search'),
      resetButton: document.querySelector('#reset-map-filters')
    };
  },
  
  bindEvents() {
    // Bind all event listeners with optional chaining for safety
    this.elements.toggleButton?.addEventListener('click', () => 
      this.elements.container.classList.toggle('hidden'));
      
    this.elements.dateFrom?.addEventListener('input', this.handleDateChange.bind(this));
    this.elements.dateTo?.addEventListener('input', this.handleDateChange.bind(this));
    this.elements.poiToggle?.addEventListener('change', this.handlePoiToggle.bind(this));
    this.elements.poiSearch?.addEventListener('input', this.handlePoiSearch.bind(this));
    this.elements.resetButton?.addEventListener('click', this.handleReset.bind(this));
  },
  
  handleDateChange() {
    const dateFrom = new Date(this.elements.dateFrom.value);
    const dateTo = new Date(this.elements.dateTo.value);
    
    // Return early if invalid date range
    if (!dateFrom || !dateTo || dateFrom > dateTo) return false;
    
    // Update state
    this.state.dateFrom = dateFrom;
    this.state.dateTo = dateTo;
    this.updateGlobalState();
    
    // Create an end date that includes the full day
    const adjustedDateTo = new Date(dateTo);
    adjustedDateTo.setDate(adjustedDateTo.getDate() + 1);
    
    // Filter log markers by date range
    document.querySelectorAll('.log-marker').forEach(marker => {
      const markerDate = new Date(marker.getAttribute('data-created-at'));
      marker.classList.toggle('hidden', !(markerDate >= dateFrom && markerDate < adjustedDateTo));
    });
    
    return true;
  },
  
  handlePoiToggle(e) {
    // Toggle visibility of POI elements based on checkbox state
    const showPoi = e.target.checked;
    this.state.poiToggle = showPoi;
    this.updateGlobalState();
    
    document.querySelectorAll('.log-marker.poi').forEach(marker => 
      marker.classList.toggle('hidden', !showPoi));
  },
  
  handlePoiSearch() {
    const search = this.elements.poiSearch.value.toLowerCase();
    this.state.poiSearch = search;
    this.updateGlobalState();
    
    // Process all markers in a single loop
    document.querySelectorAll('.log-marker').forEach(marker => {
      const isPoi = marker.classList.contains('poi');
      
      // Handle non-POI markers
      if (!isPoi) {
        marker.classList.toggle('hidden', !!search);
        return;
      }
      
      // Handle POI markers
      const location = (marker.getAttribute('data-location') || '').toLowerCase();
      const type = (marker.getAttribute('data-type') || '').toLowerCase();
      marker.classList.toggle('hidden', search && !location.includes(search) && !type.includes(search));
    });
  },
  
  handleReset() {
    // Reset all input fields
    ['dateFrom', 'dateTo', 'poiSearch'].forEach(field => {
      if (this.elements[field]) this.elements[field].value = '';
    });
    
    // Reset toggle
    if (this.elements.poiToggle) this.elements.poiToggle.checked = true;
    
    // Reset state
    this.state.dateFrom = null;
    this.state.dateTo = null;
    this.state.poiSearch = '';
    this.state.poiToggle = true;
    this.updateGlobalState();
    
    // Show all markers
    document.querySelectorAll('.log-marker').forEach(marker => 
      marker.classList.remove('hidden'));
    
    console.log('Map filters reset');
  },
  
  updateGlobalState() {
    // Update global state for access by other scripts
    window.mapFilterValues = { ...this.state };
  }
};

// Initialize the module on the window
window.daggerwalkMapFilters = daggerwalkMapFilters;
// Initialize the filter values global object
window.mapFilterValues = { ...daggerwalkMapFilters.state };