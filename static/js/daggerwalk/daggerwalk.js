const daggerwalk = {
  latestLog: {},
  pollInterval: null,

  formatTime(dateStr) {
    // Converts "HH:MM:SS" to "H:MM(AM|PM)" at end of string
    return dateStr.replace(/(\d{1,2}):(\d{2}):\d{2}$/, (_, h, m) => 
        `${h % 12 || 12}:${m}${h >= 12 ? 'PM' : 'AM'}`
    );
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
      <p>${this.formatTime(log.date)}</p>
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
  const mapTab = document.querySelector('#map-tab-btn')
  const twitchTab = document.querySelector('#twitch-tab-btn')

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