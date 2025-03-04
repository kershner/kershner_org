const daggerwalk = {
  latestLog: {},
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

    status.innerHTML = `
      <h2><span>🌍${log.region}</span><span>${log.location}</span></h2>
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
        const response = await fetch('/daggerwalk/logs/latest/');
        const newLog = await response.json();
        const buffer = 10000;  // 10s

        // Ensure created_at exists and is valid before scheduling the next fetch
        if (!newLog.created_at) {
            this.scheduleNextFetch(buffer);
            return;
        }

        this.latestLog = newLog;
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
    const backgroundColorInput = document.querySelector('input[name="background-color"]');
    const accentColorInput = document.querySelector('input[name="accent-color"]');
    const textColorSelect = document.querySelector('select[name="text-color"]');
    const resetButton = document.querySelector('.reset-default-button');
    
    // Get colors from localStorage or use defaults if not available
    const savedBackgroundColor = localStorage.getItem('backgroundColor') || '#000000';
    const savedAccentColor = localStorage.getItem('accentColor') || '#F2E530';
    const savedTextColor = localStorage.getItem('textColor') || '#FFF';
    
    // Set initial CSS variables based on localStorage values
    document.documentElement.style.setProperty('--background-color', savedBackgroundColor);
    document.documentElement.style.setProperty('--accent-color', savedAccentColor);
    document.documentElement.style.setProperty('--text-color', savedTextColor);
    
    // Calculate and set alternate dark color
    const alternateDark = lightenColor(savedBackgroundColor, 10);
    document.documentElement.style.setProperty('--alternate-dark', alternateDark);
    
    // Set initial input values based on localStorage
    backgroundColorInput.value = savedBackgroundColor;
    accentColorInput.value = savedAccentColor;
    textColorSelect.value = savedTextColor === '#FFF' ? 'light' : 'dark';
    
    // Define default colors
    const defaultBackgroundColor = '#000';
    const defaultAccentColor = '#F2E530';
    const defaultTextColor = '#FFF';
    
    // Toggle the "hidden" class for siteControlsContainer when menu icon is clicked
    menuIcon.addEventListener('click', () => {
        siteControlsContainer.classList.toggle('hidden');
    });
    
    // Update CSS variables when color inputs change
    backgroundColorInput.addEventListener('input', (event) => {
        const backgroundColor = event.target.value;
        const alternateDark = lightenColor(backgroundColor, 10);
        
        // Update both CSS variables
        document.documentElement.style.setProperty('--background-color', backgroundColor);
        document.documentElement.style.setProperty('--alternate-dark', alternateDark);
        
        // Save to localStorage
        localStorage.setItem('backgroundColor', backgroundColor);
    });
    
    accentColorInput.addEventListener('input', (event) => {
        const accentColor = event.target.value;
        document.documentElement.style.setProperty('--accent-color', accentColor);
        
        // Save to localStorage
        localStorage.setItem('accentColor', accentColor);
    });
    
    textColorSelect.addEventListener('change', (event) => {
        const textColor = event.target.value === 'light' ? '#FFF' : '#333';
        document.documentElement.style.setProperty('--text-color', textColor);
        
        // Save to localStorage
        localStorage.setItem('textColor', textColor);
    });
    
    // Reset to default colors when reset button is clicked
    resetButton.addEventListener('click', () => {
        // Set CSS variables to defaults
        document.documentElement.style.setProperty('--background-color', defaultBackgroundColor);
        document.documentElement.style.setProperty('--accent-color', defaultAccentColor);
        document.documentElement.style.setProperty('--text-color', defaultTextColor);
        document.documentElement.style.setProperty('--alternate-dark', lightenColor(defaultBackgroundColor, 10));
        
        // Update input elements to match defaults
        backgroundColorInput.value = defaultBackgroundColor;
        accentColorInput.value = defaultAccentColor;
        textColorSelect.value = 'light';
        
        // Save defaults to localStorage
        localStorage.setItem('backgroundColor', defaultBackgroundColor);
        localStorage.setItem('accentColor', defaultAccentColor);
        localStorage.setItem('textColor', defaultTextColor);
    });
  }
}
  
daggerwalk.init = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const regionParam = urlParams.get('region');

  const mapTab = document.querySelector('#map-tab-btn');
  const twitchTab = document.querySelector('#twitch-tab-btn');

  // Initialize Twitch player immediately if no region parameter
  if (!regionParam) {
    daggerwalk.initTwitchPlayer();
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
    const region = daggerwalk.latestLog?.region;
    if (!region) {
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set('region', region);
    history.pushState({}, '', `${window.location.pathname}?${urlParams.toString()}`);

    window.mapViewer.fetchDaggerwalkLogs(region);
  });

  daggerwalk.updateStatus();
  daggerwalk.startPolling();
  daggerwalk.siteMenu();
}
