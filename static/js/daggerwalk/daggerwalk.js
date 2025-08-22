const daggerwalk = {
  latestLog: {},
  inOcean: false,
  pollInterval: null,
  twitchPlayer: null,

  formatTime(dateStr) {
    // Extract just the time portion and wrap in span
    return dateStr.replace(/^(.+), (\d{1,2}:\d{2}:\d{2})$/, (_, datePart, timePart) => {
        const formattedTime = timePart.replace(/(\d{1,2}):(\d{2}):\d{2}/, (_, h, m) => {
            const hour = h % 12 || 12;
            const period = h >= 12 ? 'pm' : 'am';
            return `${hour}:${m} ${period}`;
        });
        return `<span class="time-string">⌚${formattedTime}</span>📅 ${datePart}`;
    });
  },

  updateStatus() {
    const status = document.querySelector('.current-status');
    if (!status || !this.latestLog) return;

    const log = this.latestLog;

    // Define emoji mappings
    const weatherEmoji = {
        "Sunny": "☀️", "Clear": "🌙", "Cloudy": "☁️", "Foggy": "🌫️",
        "Rainy": "🌧️", "Snowy": "🌨️", "Thunderstorm": "⛈️", "Blizzard": "❄️"
    };

    const seasonEmoji = {
        "Winter": "☃️", "Spring": "🌸", "Summer": "🌻", "Autumn": "🍂"
    };

    // Get corresponding emojis
    const weatherIcon = weatherEmoji[log.weather] || "🌈";
    const seasonIcon = seasonEmoji[log.season] || "❓";
    const climateLocationStr = `${log.region_fk.emoji}${log.region_fk.climate.replace(/s$/, '')} ${log.location.toLowerCase()}`;
    const location = log.poi ? `${log.poi.emoji}${log.poi.name}` : climateLocationStr;
    let locationDisplay = `<h2><span>🌍${log.region}</span><span>${location}</span></h2>`;
    if (this.inOcean) {
      locationDisplay = `<h2><span>🌊Ocean near ${log.last_known_region}</span></h2>`;
    }

    status.innerHTML = `
      ${locationDisplay}
      ${this.formatTime(log.date)}
      <p>${seasonIcon} ${log.season}  ${weatherIcon} ${log.weather}
      ${log.current_song ? `  🎵 ${log.current_song}` : ''}</p>
    `;
  },

  async fetchLatest() {
    const fiveMinutesAndBuffer = (5 * 60 * 1000) + 10000; // 5 min + 10 sec buffer

    if (this.latestLog && this.latestLog.created_at) {
        const lastLogTime = new Date(this.latestLog.created_at).getTime();
        const nextFetchTime = lastLogTime + fiveMinutesAndBuffer;
        const currentTime = Date.now();

        if (currentTime < nextFetchTime) {
            // console.log(`Skipping fetch: next fetch scheduled in ${(nextFetchTime - currentTime) / 1000} seconds`);
            this.scheduleNextFetch(nextFetchTime - currentTime);
            return;
        }
    }

    try {
        const buffer = 10000;  // 10s  
        const response = await fetch('/daggerwalk/logs/latest/');
        const responseJson = await response.json();
        const newLog = JSON.parse(responseJson.log);
        const inOcean = responseJson.in_ocean === 'true';

        // Ensure created_at exists and is valid before scheduling the next fetch
        if (!newLog.created_at) {
            this.scheduleNextFetch(buffer);
            return;
        }

        this.latestLog = newLog;
        this.inOcean = inOcean;
        this.updateStatus();

        // Calculate the next fetch time based on the new log's created_at
        const newLogTime = new Date(newLog.created_at).getTime();
        const nextFetchTime = newLogTime + fiveMinutesAndBuffer;
        const delay = Math.max(nextFetchTime - Date.now(), buffer); // Ensure a minimum delay of 10 sec
        
        this.scheduleNextFetch(delay);
    } catch (err) {
        this.scheduleNextFetch(buffer); // Retry in 10 seconds on failure
    }
  },

  scheduleNextFetch(delay) {
      if (this.pollInterval) {
          clearTimeout(this.pollInterval);
      }
      this.pollInterval = setTimeout(() => this.fetchLatest(), delay);
  },

  startPolling() {
      this.fetchLatest(); // Initial fetch, scheduling handled within fetchLatest
  },

  stopPolling() {
      if (this.pollInterval) {
          clearTimeout(this.pollInterval);
          this.pollInterval = null;
      }
  },

  initTwitchPlayer() {
    if (this.twitchPlayer) {
      return; // Player already initialized
    }
    
    this.twitchPlayer = new Twitch.Embed("twitch-embed", {
      width: "100%",
      height: "100%",
      channel: "daggerwalk",
      layout: window.innerWidth > 768 ? "video-with-chat" : "video"
    });
  },

  siteMenu() {
    const menuIcon = document.querySelector('.menu-icon');
    const siteControlsContainer = document.querySelector('.site-controls');
    const backgroundRadios = document.querySelectorAll('input[name="background"]');
    const accentColorInput = document.querySelector('input[name="accent-color"]');
    const resetButton = document.querySelector('.reset-default-button');
    const defaultBackground = 'dark';
    const defaultAccentColor = '#F2E530';
    
    // Set initial values from localStorage
    const savedBackground = localStorage.getItem('background') || defaultBackground;
    document.querySelector(`input[name="background"][value="${savedBackground}"]`).checked = true;
    accentColorInput.value = localStorage.getItem('accentColor') || defaultAccentColor;
    document.documentElement.style.setProperty('--accent-color', accentColorInput.value);
    document.body.classList.add(savedBackground);
    
    // Toggle menu
    menuIcon.addEventListener('click', () => {
      siteControlsContainer.classList.toggle('hidden');
    });
    
    // Background selection - now using radio buttons
    backgroundRadios.forEach(radio => {
      radio.addEventListener('change', (event) => {
        if (event.target.checked) {
          document.body.classList.remove('light', 'dark');
          document.body.classList.add(event.target.value);
          localStorage.setItem('background', event.target.value);
        }
      });
    });
    
    // Accent color
    accentColorInput.addEventListener('input', (event) => {
      document.documentElement.style.setProperty('--accent-color', event.target.value);
      localStorage.setItem('accentColor', event.target.value);
    });
    
    // Reset button
    resetButton.addEventListener('click', () => {
      document.body.classList.remove('light', 'dark');
      document.body.classList.add(defaultBackground);
      document.querySelector(`input[name="background"][value="${defaultBackground}"]`).checked = true;
      
      accentColorInput.value = defaultAccentColor;
      document.documentElement.style.setProperty('--accent-color', defaultAccentColor);
      
      localStorage.setItem('background', defaultBackground);
      localStorage.setItem('accentColor', defaultAccentColor);
    });
  },

  // New function to handle the "tab" parameter for about-tabs group
  handleAboutTabParameter() {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    
    if (!tabParam) return false;
    
    // Map tab parameter to tab button ID for the second tab group
    const validTabs = {
      'commands': 'commands-tab-btn',
      'songs': 'songs-tab-btn',
      'schedule': 'schedule-tab-btn',
      'about': 'about-tab-btn'
    };
    
    const tabId = validTabs[tabParam.toLowerCase()];
    if (!tabId) return false;
    
    const tabElement = document.querySelector(`#${tabId}`);
    if (tabElement) {
      // Select the tab and trigger its change event
      tabElement.checked = true;
      tabElement.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    
    return false;
  },

  // Function to initialize about-tabs event listeners
  initAboutTabs() {
    const tabButtons = document.querySelectorAll('.about-tabs input[type="radio"]');
    
    tabButtons.forEach(button => {
      button.addEventListener('change', (event) => {
        if (event.target.checked) {
          const tabName = event.target.id.replace('-tab-btn', '');
          
          // Update URL without affecting other parameters
          const urlParams = new URLSearchParams(window.location.search);
          urlParams.set('tab', tabName);
          history.pushState({}, '', `${window.location.pathname}?${urlParams.toString()}`);
        }
      });
    });
  }
}

daggerwalk.initSongTable = function() {
  // Minimal sort function
  const sortTable = (colIdx, asc) => {
    // Update headers
    document.querySelectorAll('#songTable th').forEach((h, i) => {
      h.innerHTML = h.innerHTML.replace(/[↑↓]\s*$/, '');
      if (i === colIdx) h.innerHTML += asc ? ' ↑' : ' ↓';
    });
    
    // Sort rows
    [...document.querySelectorAll('#songTable tbody tr')]
      .sort((a, b) => {
        const valA = a.cells[colIdx].textContent.trim();
        const valB = b.cells[colIdx].textContent.trim();
        return colIdx === 0 
          ? (asc ? +valA - +valB : +valB - +valA) 
          : (asc ? valA.localeCompare(valB) : valB.localeCompare(valA));
      })
      .forEach(tr => document.querySelector('#songTable tbody').appendChild(tr));
  };

  // Add click handlers
  document.querySelectorAll('#songTable th').forEach((th, i) => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => sortTable(i, !th.innerHTML.includes('↑')));
  });
  
  // Search filter
  document.getElementById('songSearchInput')?.addEventListener('input', e => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('#songTable tbody tr').forEach(tr => {
      tr.style.display = [...tr.cells].some(td => td.textContent.toLowerCase().includes(term)) ? '' : 'none';
    });
  });
  
  // Initial sort by Category (column 2) DESC
  setTimeout(() => sortTable(2, false), 0);
}

daggerwalk.initDaggerwalkStats = function() {
  const statsContainer = document.querySelector('#stats-content');
  const statsApiUrl = '/api/daggerwalk/stats/';

  async function fetchStats(range) {
    
    try {
      statsContainer.innerHTML = '<p class="secondary-font">Loading stats...</p>';
      const response = await fetch(`${statsApiUrl}?range=${range}`);
      const data = await response.json();
      if (!response.ok || !data.html) throw new Error('Failed to fetch stats');

      statsContainer.innerHTML = data.html;
      attachEvents();

      const select = document.getElementById('rangeSelect');
      if (select) select.value = range;
    } catch (error) {
      statsContainer.innerHTML = '<p class="secondary-font">Error loading stats.</p>';
      console.error(error);
    }
  }

  function attachEvents() {
    const select = document.getElementById('rangeSelect');
    if (select) {
      select.addEventListener('change', () => fetchStats(select.value));
    }
  
    const reloadBtn = document.getElementById('reload-stats-btn');
    if (reloadBtn) {
      reloadBtn.addEventListener('click', () => {
        if (select) {
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    }
  }

  attachEvents();
  fetchStats("today");
}

daggerwalk.labelSelectActivation = function() {
  // Allows the label+inputs to be activated with keyboard
  document.addEventListener('keydown', (e) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    console.log('hello!');
    const label = e.target.closest('.about-tabs label[for]');
    if (!label) return;
    e.preventDefault();       // stop Space from scrolling
    label.click();            // fires the associated radio's native click
  });
}
  
daggerwalk.init = () => {
  const urlParams = new URLSearchParams(window.location.search);
  let regionParam = urlParams.get('region');

  const mapTab = document.querySelector('#map-tab-btn');
  const twitchTab = document.querySelector('#twitch-tab-btn');

  // Initialize Twitch player immediately if no region parameter
  if (!regionParam) {
    regionParam = 'current';
  }

  if (regionParam && mapTab) {
    mapTab.checked = true;
    mapTab.dispatchEvent(new Event("change", { bubbles: true }));
  }

  twitchTab.addEventListener('change', () => {
    window.mapViewer.clearLogMarkers();
    window.mapViewer.stopLogPolling();
    history.pushState({}, '', window.location.pathname);

    // Init Twitch player when tab is selected
    daggerwalk.initTwitchPlayer();
  });
  
  mapTab.addEventListener('change', () => {
    let region = daggerwalk.latestLog?.region;
    if (!region) {
      return;
    }

    if (region === 'Ocean') {
      region = 'world';
    }

    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set('region', region);
    history.pushState({}, '', `${window.location.pathname}?${urlParams.toString()}`);

    window.mapViewer.fetchRegionData(region);
  });

  daggerwalk.labelSelectActivation();
  daggerwalk.handleAboutTabParameter();
  daggerwalk.initAboutTabs();
  daggerwalk.updateStatus();
  daggerwalk.startPolling();
  daggerwalk.siteMenu();
  daggerwalk.initSongTable();
  daggerwalk.initDaggerwalkStats();
}