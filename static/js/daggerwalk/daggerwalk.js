const daggerwalk = {
  latestLog: {},
  pollInterval: null,

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
      <h2>${log.location} - ${log.region}</h2>
      ${this.formatTime(log.date)}
      <p>${seasonIcon} ${log.season}  ${weatherIcon} ${log.weather}
      ${log.current_song ? `  🎵 ${log.current_song}` : ''}</p>
    `;
  },

  async fetchLatest() {
    try {
      const response = await fetch('/daggerwalk/logs/latest/')
      this.latestLog = await response.json()
      this.updateStatus()
    } catch (err) {
      console.error('Failed to fetch latest log:', err)
    }
  },

  startPolling() {
    this.fetchLatest()
    this.pollInterval = setInterval(() => this.fetchLatest(), 20000)
  },

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }
  }
}

daggerwalk.init = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const regionParam = urlParams.get('region');

  const mapTab = document.querySelector('#map-tab-btn')
  const twitchTab = document.querySelector('#twitch-tab-btn')

  if (regionParam && mapTab) {
    mapTab.checked = true;
    mapTab.dispatchEvent(new Event("change", { bubbles: true }));
  }

  twitchTab.addEventListener('change', () => {
    window.mapViewer.clearLogMarkers()
    window.mapViewer.stopLogPolling()
  })
  
  mapTab.addEventListener('change', () => {
    window.mapViewer.fetchDaggerwalkLogs(daggerwalk.latestLog.region)
  })

  daggerwalk.updateStatus()
  daggerwalk.startPolling()
}
