const daggerwalk = {
  latestLog: {},
  pollInterval: null,

  formatTime(dateStr) {
    const time = dateStr.match(/(\d{1,2}):(\d{2})/)?.[0]
    if (!time) return dateStr
    
    const [h, m] = time.split(':')
    return `${h % 12 || 12}:${m}${h >= 12 ? 'PM' : 'AM'}`
  },

  updateStatus() {
    const status = document.querySelector('.current-status')
    if (!status || !this.latestLog) return
    
    console.log(this.latestLog);
    
    const { location, region, weather, date, current_song } = this.latestLog
    
    status.innerHTML = `
      <h2>${location} - ${region}</h2>
      <p>${weather} | ${this.formatTime(date)}</p>
      ${current_song ? `<p>♪ ${current_song}</p>` : ''}
    `
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