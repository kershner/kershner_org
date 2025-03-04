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
    const backgroundSelect = document.querySelector('select[name="background"]');
    const accentColorInput = document.querySelector('input[name="accent-color"]');
    const resetButton = document.querySelector('.reset-default-button');
    const defaultBackground = 'dark';
    const defaultAccentColor = '#F2E530';
    
    // Set initial values from localStorage
    backgroundSelect.value = localStorage.getItem('background') || defaultBackground;
    accentColorInput.value = localStorage.getItem('accentColor') || defaultAccentColor;
    document.documentElement.style.setProperty('--accent-color', accentColorInput.value);
    document.body.classList.add(backgroundSelect.value);
    
    // Toggle menu
    menuIcon.addEventListener('click', () => {
      siteControlsContainer.classList.toggle('hidden');
    });
    
    // Background selection
    backgroundSelect.addEventListener('change', (event) => {
      document.body.classList.remove('light', 'dark');
      document.body.classList.add(event.target.value);
      localStorage.setItem('background', event.target.value);
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
      backgroundSelect.value = defaultBackground;
      
      accentColorInput.value = defaultAccentColor;
      document.documentElement.style.setProperty('--accent-color', defaultAccentColor);
      
      localStorage.setItem('background', defaultBackground);
      localStorage.setItem('accentColor', defaultAccentColor);
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
