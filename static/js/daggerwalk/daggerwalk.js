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

  siteMenu() {
    const toggle = document.querySelector('.menu-toggle');
    const menuContainer = document.querySelector('.menu-container');
    const siteControlsContainer = document.querySelector('.site-controls');
    const backgroundRadios = document.querySelectorAll('input[name="background"]');
    const accentColorInput = document.querySelector('input[name="accent-color"]');
    const resetButton = document.querySelector('.reset-default-button');
    const chatToggleBtn = document.getElementById('toggle-chat');
    const defaultBackground = 'dark';
    const defaultAccentColor = '#F2E530';

    let isPinned = false;

    const setOpen = (open) => {
      siteControlsContainer.classList.toggle('hidden', !open);
      menuContainer.classList.toggle('open', open);
      if (toggle) toggle.classList.toggle('open', open);
    };

    const savedBackground = localStorage.getItem('background') || defaultBackground;
    const savedAccent = localStorage.getItem('accentColor') || defaultAccentColor;

    const bgInput = document.querySelector(`input[name="background"][value="${savedBackground}"]`);
    if (bgInput) bgInput.checked = true;

    accentColorInput.value = savedAccent;
    document.documentElement.style.setProperty('--accent-color', savedAccent);
    document.body.classList.add(savedBackground);

    if (toggle) {
      // CLICK: pin/unpin
      toggle.addEventListener('click', (e) => {
        e.stopPropagation(); // prevent outside click handler from firing
        if (!isPinned) {
          isPinned = true;
          setOpen(true);
        } else {
          isPinned = false;
          setOpen(false);
        }
      });

      // HOVER for desktop only
      toggle.addEventListener('mouseenter', () => { if (!isPinned) setOpen(true); });
      toggle.addEventListener('mouseleave', () => { if (!isPinned && !menuContainer.matches(':hover')) setOpen(false); });
    }

    // HOVER for desktop
    menuContainer.addEventListener('mouseenter', () => { if (!isPinned) setOpen(true); });
    menuContainer.addEventListener('mouseleave', () => { if (!isPinned) setOpen(false); });

    // OUTSIDE CLICK/TAP (covers mobile)
    document.addEventListener('click', (e) => {
      const clickedInside = toggle.contains(e.target) || menuContainer.contains(e.target);
      if (!clickedInside) {
        isPinned = false;
        setOpen(false);
      }
    }, true);

    // Optional: ESC closes & unpins
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { isPinned = false; setOpen(false); }
    });

    backgroundRadios.forEach(radio => {
      radio.addEventListener('change', (event) => {
        if (event.target.checked) {
          document.body.classList.remove('light', 'dark');
          document.body.classList.add(event.target.value);
          localStorage.setItem('background', event.target.value);
        }
      });
    });

    accentColorInput.addEventListener('input', (event) => {
      document.documentElement.style.setProperty('--accent-color', event.target.value);
      localStorage.setItem('accentColor', event.target.value);
    });

    resetButton.addEventListener('click', () => {
      document.body.classList.remove('light', 'dark');
      document.body.classList.add(defaultBackground);
      const def = document.querySelector(`input[name="background"][value="${defaultBackground}"]`);
      if (def) def.checked = true;

      accentColorInput.value = defaultAccentColor;
      document.documentElement.style.setProperty('--accent-color', defaultAccentColor);

      localStorage.setItem('background', defaultBackground);
      localStorage.setItem('accentColor', defaultAccentColor);

      isPinned = false;
      setOpen(false);
    });

    if (chatToggleBtn) {
      chatToggleBtn.addEventListener('click', () => { isPinned = false; setOpen(false); });
    }
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

daggerwalk.enhanceTable = function(tableSelector, opts = {}) {
  const table = typeof tableSelector === 'string' ? document.querySelector(tableSelector) : tableSelector;
  if (!table) return;

  const tbody = table.tBodies[0];
  const headers = table.querySelectorAll('th');
  const numericCols = new Set(opts.numericCols || []);
  const enableFilter = opts.filter !== false; // defaults to true

  // Minimal sort function
  const sortTable = (colIdx, asc) => {
    headers.forEach((h, i) => {
      h.innerHTML = h.innerHTML.replace(/[↑↓]\s*$/, '');
      if (i === colIdx) h.innerHTML += asc ? ' ↑' : ' ↓';
    });

    const rows = Array.from(tbody.rows);
    const isNumeric = numericCols.has(colIdx) || rows.every(r => !isNaN(parseFloat(r.cells[colIdx].textContent)));

    rows.sort((a, b) => {
      let valA = a.cells[colIdx].textContent.trim();
      let valB = b.cells[colIdx].textContent.trim();

      if (isNumeric) {
        const numA = parseFloat(valA.replace(/[^\d.\-]/g, '')) || 0;
        const numB = parseFloat(valB.replace(/[^\d.\-]/g, '')) || 0;
        return asc ? numA - numB : numB - numA;
      } else {
        return asc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
    });

    rows.forEach(tr => tbody.appendChild(tr));
  };

  // Add click handlers
  headers.forEach((th, i) => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => sortTable(i, !th.innerHTML.includes('↑')));
  });

  // Create a plain filter input above the table
  if (enableFilter) {
    const filterInput = document.createElement('input');
    filterInput.type = 'search';
    filterInput.placeholder = 'Filter...';
    filterInput.name = 'table-filter';
    filterInput.classList.add('table-filter-input');
    table.parentNode.insertBefore(filterInput, table);

    filterInput.addEventListener('input', e => {
      const term = e.target.value.toLowerCase();
      [...tbody.rows].forEach(tr => {
        tr.style.display = [...tr.cells].some(td => td.textContent.toLowerCase().includes(term)) ? '' : 'none';
      });
    });
  }
  
  // Initial sort if provided
  if (opts.initialSort) {
    setTimeout(() => sortTable(opts.initialSort.index, opts.initialSort.asc), 0);
  }

  return { sort: sortTable };
};

daggerwalk.addPagination = function(tableSelector, perPage = 20) {
  const table = typeof tableSelector === 'string'
    ? document.querySelector(tableSelector)
    : tableSelector;
  if (!table) return;

  const rows = Array.from(table.querySelectorAll('tbody tr'));
  if (!rows.length) return;

  // Create or reuse a pager just after the table
  let pager = table.nextElementSibling;
  if (!pager || !pager.classList.contains('pager')) {
    pager = document.createElement('div');
    pager.className = 'pager';
    table.insertAdjacentElement('afterend', pager);
  }

  let page = 1;
  const total = Math.ceil(rows.length / perPage);

  function render() {
    rows.forEach((r, i) => {
      r.style.display = (i >= (page - 1) * perPage && i < page * perPage) ? '' : 'none';
    });

    pager.innerHTML = '';
    if (total <= 1) return;

    if (page > 1) {
      const prev = document.createElement('button');
      prev.textContent = 'Prev';
      prev.onclick = () => { page--; render(); };
      pager.appendChild(prev);
    }

    const info = document.createElement('span');
    info.textContent = ` Page ${page} / ${total} `;
    pager.appendChild(info);

    if (page < total) {
      const next = document.createElement('button');
      next.textContent = 'Next';
      next.onclick = () => { page++; render(); };
      pager.appendChild(next);
    }
  }

  render();
  return { goto(p) { page = Math.min(Math.max(1, p), total); render(); } };
}

daggerwalk.initTables = function() {
  // Commands table
  daggerwalk.enhanceTable('.commands-table');
  daggerwalk.enhanceTable('.songs-table');
  daggerwalk.enhanceTable('#leaderboard');
  daggerwalk.addPagination('#leaderboard');
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

      document.querySelectorAll('.stats-data-wrapper table').forEach(table => {
        if (table.classList.contains('twitch-cmds-table')) {
          daggerwalk.enhanceTable(table, {'filter': true});
        } else {
          daggerwalk.enhanceTable(table, {'filter': false});
        }
      });

      daggerwalk.addPagination('.twitch-cmds-table');

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
    const label = e.target.closest('.about-tabs label[for]');
    if (!label) return;
    e.preventDefault();       // stop Space from scrolling
    label.click();            // fires the associated radio's native click
  });
}

daggerwalk.initTwitch = function () {
  if (this._twitchReady) return
  this._twitchReady = true

  const CHANNEL = "daggerwalk"
  const PARENT  = window.location.hostname
  const theme   = (localStorage.getItem("background") === "light") ? "light" : "dark"

  // Player
  new Twitch.Embed("twitch-embed", {
    channel: CHANNEL,
    parent: [PARENT],
    width: "100%",
    height: "100%",
    layout: "video",
    theme
  })

  // Chat
  const chatBase = `https://www.twitch.tv/embed/${CHANNEL}/chat?parent=${encodeURIComponent(PARENT)}`
  const chatUrl  = theme === "dark" ? `${chatBase}&darkpopout` : chatBase
  document.getElementById("twitch-chat").src = chatUrl

  // Toggle chat
  const panel = document.getElementById("chat-panel")
  const btn   = document.getElementById("toggle-chat")

  const savedHidden = localStorage.getItem("chatHidden") === "true"
  setChatHidden(savedHidden)

  btn.addEventListener("click", () => {
    setChatHidden(panel.getAttribute("aria-hidden") !== "true")
  })

  function setChatHidden(hidden) {
    panel.setAttribute("aria-hidden", hidden ? "true" : "false")
    btn.setAttribute("aria-pressed", hidden ? "true" : "false")
    btn.textContent = hidden ? "Show Chat" : "Hide Chat"
    localStorage.setItem("chatHidden", String(hidden))
    document.getElementById("player-and-chat")
      .classList.toggle("chat-hidden", hidden)
  }
}
  
daggerwalk.init = () => {
  const urlParams = new URLSearchParams(window.location.search);
  let regionParam = urlParams.get('region');
  const mapTab = document.querySelector('#map-tab-btn');
  if (mapTab) {
    mapTab.addEventListener('change', (e) => {
      if (e.target.checked && window.daggerwalkMap) {
        const map = window.daggerwalkMap;
        setTimeout(() => {
          // Fix Leaflet map misalignment when returning to the Map tab
          map.invalidateSize();
          map.setView(map.getCenter(), map.getZoom(), { animate: false });
        }, 150);
      }
    });
  }

  if (regionParam && mapTab) {
    mapTab.checked = true;
    mapTab.dispatchEvent(new Event("change", { bubbles: true }));
  }

  const twitchTab = document.querySelector('#twitch-tab-btn')
  if (twitchTab) {
    if (twitchTab.checked) daggerwalk.initTwitch()

    twitchTab.addEventListener('change', (e) => {
      if (e.target.checked) {
        daggerwalk.initTwitch();
        history.pushState({}, '', window.location.pathname)
      }
    })
  }
  
  daggerwalk.labelSelectActivation();
  daggerwalk.handleAboutTabParameter();
  daggerwalk.initAboutTabs();
  daggerwalk.updateStatus();
  daggerwalk.startPolling();
  daggerwalk.siteMenu();
  daggerwalk.initTables();
  daggerwalk.initDaggerwalkStats();
}