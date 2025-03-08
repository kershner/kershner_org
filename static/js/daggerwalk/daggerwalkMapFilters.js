const daggerwalkMapFilters = {
  elements: {},
  state: {
    dateFrom: null,
    dateTo: null,
    poiToggle: true,
    poiSearch: ''
  },
  
  init() {
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
      resetButton: document.querySelector('#reset-map-filters'),
      dateFilterShortcuts: document.querySelector('.date-filter-shortcuts')
    };
  },
  
  bindEvents() {
    // Bind all event listeners with optional chaining for safety
    this.elements.toggleButton?.addEventListener('click', () => {
      this.elements.toggleButton.classList.toggle('active')  ;
      this.elements.container.classList.toggle('hidden')
      }
    );
    
    // Set up date filter shortcuts
    this.setupDateFilterShortcutHandlers();
      
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
    
    // Also filter world-map-markers by date range using the latest-date attribute
    document.querySelectorAll('.world-map-marker').forEach(marker => {
      const latestDateStr = marker.getAttribute('data-latest-date');
      if (latestDateStr) {
        const markerDate = new Date(latestDateStr);
        marker.classList.toggle('hidden', !(markerDate >= dateFrom && markerDate < adjustedDateTo));
      }
    });
    
    // Redraw the connecting lines after filtering the markers
    if (window.mapViewer) {
      window.mapViewer.drawConnectingLines();
    }
    
    return true;
  },

  setupDateFilterShortcutHandlers() {
    const spans = document.querySelectorAll('.date-filter-shortcuts span');
    
    spans.forEach(span => {
      span.addEventListener('click', (e) => {
        const filterText = e.target.textContent.trim();
        
        // Set date range based on the selected shortcut
        const today = new Date();
        let dateFrom = new Date();
        let dateTo = new Date();
        
        switch(filterText) {
          case 'Today':
            // Just use today for both
            break;
          case 'Yesterday':
            dateFrom.setDate(today.getDate() - 1);
            dateTo.setDate(today.getDate() - 1);
            break;
          case 'This week':
            // Go to beginning of current week (Monday)
            const dayOfWeek = today.getDay() || 7; // Convert Sunday (0) to 7
            dateFrom.setDate(today.getDate() - dayOfWeek + 1); // Monday
            break;
          case 'Last week':
            // Last week Monday to Sunday
            const lastWeekDay = today.getDay() || 7;
            dateFrom.setDate(today.getDate() - lastWeekDay - 6); // Last Monday
            dateTo.setDate(today.getDate() - lastWeekDay); // Last Sunday
            break;
          default:
            return;
        }
        
        // Format dates for input fields (YYYY-MM-DD)
        const formatDate = (date) => {
          return date.toISOString().split('T')[0];
        };
        
        // Update input fields
        if (this.elements.dateFrom) {
          this.elements.dateFrom.value = formatDate(dateFrom);
        }
        if (this.elements.dateTo) {
          this.elements.dateTo.value = formatDate(dateTo);
        }
        
        // Trigger the date filter
        this.handleDateChange();
      });
    });
  },
  
  handlePoiToggle(e) {
    // Toggle visibility of POI elements based on checkbox state
    const showPoi = e.target.checked;
    this.state.poiToggle = showPoi;
    this.updateGlobalState();
    
    document.querySelectorAll('.log-marker.poi').forEach(marker => 
      marker.classList.toggle('poi-filter-on', !showPoi));
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
    document.querySelectorAll('.log-marker').forEach(marker => {
      marker.classList.remove('hidden');
      marker.classList.remove('poi-filter-on');
    });
    document.querySelectorAll('.world-map-marker').forEach(marker => marker.classList.remove('hidden'));
    
    // Redraw the connecting lines after resetting all markers to visible
    if (window.mapViewer) {
      window.mapViewer.drawConnectingLines();
    }
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