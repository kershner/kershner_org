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
    
    // Set default to "This week" on page load
    if (this.elements.dateFilterShortcuts) {
      const thisWeekShortcut = this.elements.dateFilterShortcuts.querySelector('span:nth-child(3)');
      if (thisWeekShortcut) {
        // Add active class
        thisWeekShortcut.classList.add('active');
        thisWeekShortcut.click();
      }
    }
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
    
    // Filter non-POI markers by date range
    document.querySelectorAll('.log-marker:not(.poi)').forEach(marker => {
      const markerDate = new Date(marker.getAttribute('data-created-at'));
      marker.classList.toggle('hidden', !(markerDate >= dateFrom && markerDate < adjustedDateTo));
    });
    
    // Only filter POI markers if the POI toggle is on
    if (!this.state.poiToggle) {
      document.querySelectorAll('.log-marker.poi').forEach(marker => {
        const markerDate = new Date(marker.getAttribute('data-created-at'));
        marker.classList.toggle('hidden', !(markerDate >= dateFrom && markerDate < adjustedDateTo));
      });
    }
    
    // Filter world-map-markers by date range
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
        // Remove active class from all shortcuts
        spans.forEach(s => s.classList.remove('active'));
        
        // Add active class to clicked shortcut
        e.target.classList.add('active');
        
        const filterText = e.target.textContent.trim();
        
        // Set date range based on the selected shortcut
        const today = new Date();
        let dateFrom = new Date();
        let dateTo = new Date();
        
        switch(filterText) {
          case 'Today':
            // Last 24 hours: from 24 hours ago until now
            dateFrom = new Date(today.getTime() - 24 * 60 * 60 * 1000);
            dateTo = today; // Current time today
            break;
          case 'Yesterday':
            // From 48 hours ago until 24 hours ago
            dateFrom = new Date(today.getTime() - 48 * 60 * 60 * 1000);
            dateTo = new Date(today.getTime() - 24 * 60 * 60 * 1000);
            break;
          case 'This week':
            // Last 7 days (including today)
            dateFrom.setDate(today.getDate() - 6);
            // dateTo is already today
            break;
          case 'Last week':
            // 14 days ago to 7 days ago
            dateFrom.setDate(today.getDate() - 13);
            dateTo.setDate(today.getDate() - 7);
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
    
    // Remove active class from all date filter shortcuts
    if (this.elements.dateFilterShortcuts) {
      this.elements.dateFilterShortcuts.querySelectorAll('span').forEach(span => {
        span.classList.remove('active');
      });
    }
    
    // Show all markers
    document.querySelectorAll('.log-marker').forEach(marker => {
      marker.classList.remove('hidden');
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