const DeviceManager = (() => {
  function getOrCreateDeviceId() {
    let deviceId = localStorage.getItem('pi_device_id');
    if (!deviceId) {
      // Generate a random device ID (using crypto for better randomness)
      const array = new Uint8Array(16);
      crypto.getRandomValues(array);
      deviceId = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
      localStorage.setItem('pi_device_id', deviceId);
    }
    return deviceId;
  }

  function ensureDeviceIdInUrl() {
    const deviceId = getOrCreateDeviceId();
    const urlParams = new URLSearchParams(window.location.search);
    
    if (!urlParams.has('device_id')) {
      // Reload with device_id to get proper QR code
      urlParams.set('device_id', deviceId);
      window.location.search = urlParams.toString();
      return false; // Signal that we're reloading
    }
    
    return deviceId;
  }

  return { getOrCreateDeviceId, ensureDeviceIdInUrl };
})();

const YouTubeSearch = (() => {
  let cache = new Map();
  let selectedIndex = -1;
  let results = [];

  // Server-side search endpoint - pulled from Django
  const SEARCH_ENDPOINT = window.YOUTUBE_SEARCH_URL;
  
  function isYouTubeUrl(str) {
    return /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)/.test(str);
  }

  async function searchVideos(query) {
    if (cache.has(query)) {
      return cache.get(query);
    }

    try {
      const response = await fetch(`${SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}`);
      
      if (!response.ok) {
        console.error('Search failed:', response.status);
        return '<div class="search-error">Search failed. Please try again.</div>';
      }
      
      const html = await response.text();
      cache.set(query, html);
      return html;
      
    } catch (error) {
      console.error('Search failed:', error);
      return '<div class="search-error">Network error. Please try again.</div>';
    }
  }

  function renderResults(html, container, input) {
    selectedIndex = -1;

    // Wrap results in a styled container with title
    const hasResults = !html.includes('search-error') && !html.includes('search-no-results');
    const wrappedHtml = hasResults 
      ? `<div class="search-results-title">Search Results</div><div class="search-results">${html}</div>`
      : `<div class="search-results">${html}</div>`;
    
    container.innerHTML = wrappedHtml;
    container.classList.remove('hidden');

    // Get all result items from the rendered HTML
    const items = container.querySelectorAll('.search-result-item');
    results = Array.from(items);

    if (items.length === 0) {
      return;
    }

    // Add click handlers and index for keyboard navigation
    items.forEach((item, index) => {
      item.dataset.index = index;
      
      item.addEventListener('click', () => {
        const videoId = item.dataset.videoId;
        input.value = `https://www.youtube.com/watch?v=${videoId}`;
        
        // Trigger change event so form knows the value updated
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
  }

  function handleKeyNavigation(e, dropdown, input) {
    const items = dropdown.querySelectorAll('.search-result-item');
    
    if (items.length === 0) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
      updateSelection(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, -1);
      updateSelection(items);
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      const videoId = items[selectedIndex].dataset.videoId;
      input.value = `https://www.youtube.com/watch?v=${videoId}`;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (e.key === 'Escape') {
      dropdown.classList.add('hidden');
      selectedIndex = -1;
    }
  }

  function updateSelection(items) {
    items.forEach((item, index) => {
      if (index === selectedIndex) {
        item.classList.add('selected');
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        item.classList.remove('selected');
      }
    });
  }

  async function performSearch(inputElement, containerElement) {
    const query = inputElement.value.trim();
    
    // If it's a URL, don't search
    if (isYouTubeUrl(query)) {
      return;
    }

    // Require at least 3 characters
    if (query.length < 3) {
      return;
    }

    containerElement.innerHTML = '<div class="search-results"><div class="search-loading">Searching YouTube...</div></div>';
    containerElement.classList.remove('hidden');
    
    const html = await searchVideos(query);
    renderResults(html, containerElement, inputElement);
  }

  function init(inputElement, resultsContainer, searchButton) {
    // Search button click handler
    searchButton.addEventListener('click', () => {
      performSearch(inputElement, resultsContainer);
    });

    // Enter key in input field triggers search
    inputElement.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !resultsContainer.classList.contains('hidden')) {
        // If results are open, handle navigation
        handleKeyNavigation(e, resultsContainer, inputElement);
      } else if (e.key === 'Enter') {
        // If results are closed, perform search
        e.preventDefault();
        performSearch(inputElement, resultsContainer);
      } else if (!resultsContainer.classList.contains('hidden')) {
        // Handle other navigation keys when results are open
        handleKeyNavigation(e, resultsContainer, inputElement);
      }
    });
  }

  return { init };
})();

const SubmitForm = (() => {
  function init() {
    const form = document.getElementById('f');
    if (!form) {
      console.error('Submit form not found');
      return;
    }
    
    const submitBtn = form.querySelector('.submit-button');
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-button');
    const resultsContainer = document.getElementById('search-results-container');

    // Initialize YouTube search
    if (searchInput && resultsContainer && searchBtn) {
      YouTubeSearch.init(searchInput, resultsContainer, searchBtn);
    }

    function showMessage(text, type = 'success', duration = 3000) {
      const messageEl = document.getElementById('display-message');
      if (!messageEl) return;

      // Set message content and type
      messageEl.textContent = text;
      messageEl.className = 'display-message'; // Reset classes
      messageEl.classList.add('show', type);

      // Hide message after duration
      setTimeout(() => {
        messageEl.classList.remove('show');
      }, duration);
    }

    form.addEventListener('submit', async e => {
      e.preventDefault();
      
      submitBtn.disabled = true;
      
      try {
        const data = new URLSearchParams(new FormData(e.target));
        const r = await fetch(window.API_PLAY_URL, { method: 'POST', body: data });
        const json = await r.json();
        
        if (r.ok) {
          showMessage('✓ Video sent successfully!', 'success');
          form.reset();
          // Restore hidden fields after reset
          form.querySelector('[name="token"]').value = window.SUBMIT_TOKEN || '';
          form.querySelector('[name="device_id"]').value = window.SUBMIT_DEVICE_ID || '';
        } else {
          // Handle specific error types
          const errorMessages = {
            'invalid_or_expired': 'This QR code is invalid or expired. Please scan a new one.',
            'not_youtube': 'Please provide a valid YouTube URL.',
            'missing_token': 'Invalid request. Please scan the QR code again.',
            'missing_device': 'Invalid request. Please scan the QR code again.'
          };
          
          const message = errorMessages[json.error] || json.message || 'An error occurred. Please try again.';
          showMessage(message, 'error');
        }
      } catch (err) {
        showMessage('Network error. Please check your connection and try again.', 'error');
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  return { init };
})();

const PiStuff = (() => {
  // Config
  const POLL_INTERVAL_MS = 5000;
  const QR_TTL_MS = 120000;

  // State
  let player = null;
  let playerReady = false;
  let playlists = {};
  let currentPlaylist = null;
  let currentCategoryKey = null;
  let pendingPlaylistLoad = null;

  let skipTimer = null;
  let consecutiveSkips = 0;
  let lastVideoId = null;

  let pollIntervalId = null;
  let lastTsSeen = 0;
  let qrHideTimer = null;
  let qrVisible = false;
  let successMessageTimer = null;

  let deviceId = null;

  // DOM cache
  const $ = sel => document.querySelector(sel);
  const $all = sel => Array.from(document.querySelectorAll(sel));
  const getMenu = () => $('#menu');
  const getPlaylistsContainer = () => $('#playlists');
  const getQrContainer = () => $('#qr-container');
  const getPlayerIframe = () => document.getElementById('player');
  const getDisplayMessage = () => $('#display-message');

  const safe = fn => { try { return fn(); } catch (_) { return null; } };

  function showMessage(message, type = 'success', duration = 3000) {
    const messageEl = getDisplayMessage();
    if (!messageEl) return;

    // Clear any existing timer
    clearTimeout(successMessageTimer);

    // Hide UI elements and show message
    const playlistsContainer = getPlaylistsContainer();
    const qrContainer = getQrContainer();
    const menu = getMenu();
    
    if (playlistsContainer) playlistsContainer.hidden = true;
    if (qrContainer) qrContainer.hidden = true;
    if (menu) menu.hidden = true;
    
    // Set message content and type
    messageEl.textContent = message;
    messageEl.className = 'display-message'; // Reset classes
    messageEl.classList.add('show', type);

    // Hide message after duration and restore UI
    successMessageTimer = setTimeout(() => {
      messageEl.classList.remove('show');
      
      // Restore playlists view (unless QR was showing)
      setTimeout(() => {
        if (!qrVisible && playlistsContainer) {
          playlistsContainer.hidden = false;
        }
      }, 300); // Wait for fade out animation
    }, duration);
  }

  function playVideo(videoId) {
    if (!videoId) return;
    if (player && typeof player.loadVideoById === 'function') {
      try {
        player.loadVideoById({ videoId, startSeconds: 0 });
        return;
      } catch (_) {}
    }
    const iframe = getPlayerIframe();
    if (iframe) iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
  }

  function skipUnplayable() {
    consecutiveSkips++;
    if (consecutiveSkips >= 12) {
      player?.stopVideo();
      return;
    }
    clearTimeout(skipTimer);
    skipTimer = setTimeout(() => safe(() => player.nextVideo()), 250);
  }

  function renderPlaylistsForCategory(categoryKey) {
    const container = getPlaylistsContainer();
    if (!container) return;
    const list = playlists[categoryKey] || [];
    container.innerHTML = list
      .map(p => `<button data-playlist="${p.id}">${escapeHtml(p.name)}</button>`)
      .join('');
    
    // Re-apply selected state to the playlist button if it exists
    if (currentPlaylist) {
      const playlistBtn = document.querySelector(`[data-playlist="${currentPlaylist}"]`);
      if (playlistBtn) {
        playlistBtn.classList.add('selected');
      }
    }
  }

  function setInitialActiveStates() {
    // Mark the category button as selected
    if (currentCategoryKey) {
      const categoryBtn = document.querySelector(`[data-category="${currentCategoryKey}"]`);
      if (categoryBtn) {
        categoryBtn.classList.add('selected');
      }
    }

    // Render playlists for the selected category
    if (currentCategoryKey) {
      renderPlaylistsForCategory(currentCategoryKey);
    }
  }

  function showQr() {
    const playlistsContainer = getPlaylistsContainer();
    const qrContainer = getQrContainer();
    
    if (playlistsContainer) playlistsContainer.hidden = true;
    if (qrContainer) qrContainer.hidden = false;
    
    qrVisible = true;
    
    clearTimeout(qrHideTimer);
    qrHideTimer = setTimeout(() => {
      hideQr();
    }, QR_TTL_MS);
  }

  function hideQr() {
    const playlistsContainer = getPlaylistsContainer();
    const qrContainer = getQrContainer();
    
    if (playlistsContainer) playlistsContainer.hidden = false;
    if (qrContainer) qrContainer.hidden = true;
    
    qrVisible = false;
    clearTimeout(qrHideTimer);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;'
    }[c]));
  }

  function loadPlaylistsData() {
    const cats = window.CATEGORIES_DATA || [];
    playlists = {};
    cats.forEach(cat => {
      playlists[`cat-${cat.id}`] = (cat.playlists || []).map(p => ({
        id: p.youtube_playlist_id,
        name: p.name
      }));
    });
  }

  function initMenu() {
    const menu = getMenu();
    if (!menu) return;

    document.querySelector('.menu-button')?.addEventListener('click', () => {
      menu.hidden = false;
    });

    menu.addEventListener('click', ev => {
      const t = ev.target;
      const category = t.dataset.category;
      const playlist = t.dataset.playlist;
      const action = t.dataset.action;

      if (category && playlists[category]) {
        $all('[data-category]').forEach(b => b.classList.remove('selected'));
        t.classList.add('selected');
        currentCategoryKey = category;
        renderPlaylistsForCategory(category);
        hideQr(); // Hide QR if showing
        return;
      }

      if (playlist) {
        $all('[data-playlist]').forEach(b => b.classList.remove('selected'));
        t.classList.add('selected');

        currentPlaylist = playlist;
        pendingPlaylistLoad = playlist;
        consecutiveSkips = 0;
        lastVideoId = null;
        clearTimeout(skipTimer);

        player?.stopVideo();
        player?.loadPlaylist({ listType: 'playlist', list: playlist, index: 0 });
        menu.hidden = true;
        hideQr();
        return;
      }

      if (action === 'qr') return showQr();
      if (action === 'reload') return location.reload();
      if (action === 'screen') {
        ev.stopPropagation();  // Prevent event from bubbling to body
        document.body.className = 'screen-off';
        menu.hidden = true;
        return;
      }
      if (action === 'close') menu.hidden = true;
    });
  }

  function loadYouTubeApi() {
    if (document.querySelector('script[src*="youtube.com/iframe_api"]')) return;
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  }

  function createPlayer() {
    player = new YT.Player('player', {
      // Slightly reduces tracking + sometimes behaves better on kiosks
      host: 'https://www.youtube-nocookie.com',
      playerVars: {
        listType: 'playlist',
        list: currentPlaylist,
        autoplay: 1,
        playsinline: 1,
        
        // Performance / UI reductions
        controls: 1,
        fs: 0,
        disablekb: 1,
        modestbranding: 1,
        rel: 0,
        iv_load_policy: 3,     // annotations off
        cc_load_policy: 1,     // captions on
        
        // Strong hint to start low-res (biases H.264 likelihood)
        vq: 'small',
      },
      events: {
        onReady(e) {
          // Required for reliable autoplay
          e.target.mute();
          
          // Force lowest practical quality immediately
          e.target.setPlaybackQuality('small');
          
          if (!playerReady) {
            playerReady = true;
            e.target.setShuffle(true);
            e.target.nextVideo();
          }
        },
        onError: skipUnplayable,
        onStateChange(e) {
          if (e.data === YT.PlayerState.PLAYING) {
            // Re-assert low quality (YouTube likes to bump it)
            player.setPlaybackQuality('small');
            
            const vid = safe(() => player.getVideoData().video_id);
            if (vid && vid !== lastVideoId) {
              lastVideoId = vid;
              consecutiveSkips = 0;
            }
            if (pendingPlaylistLoad) {
              const loaded = safe(() => player.getPlaylistId());
              if (loaded === pendingPlaylistLoad) {
                player.setShuffle(true);
                player.nextVideo();
                pendingPlaylistLoad = null;
              }
            }
          }
          
          // Some "blocked" cases never fire onError; if stuck UNSTARTED, skip after a delay
          if (e.data === YT.PlayerState.UNSTARTED) {
            clearTimeout(skipTimer);
            
            const startVid = safe(() => player.getVideoData().video_id);
            skipTimer = setTimeout(() => {
              const state = safe(() => player.getPlayerState());
              const nowVid = safe(() => player.getVideoData().video_id);
              
              if (state !== YT.PlayerState.PLAYING && nowVid && nowVid === startVid) {
                skipUnplayable();
              }
            }, 4000);
          }
        }
      }
    });
  }

  async function primeLatestTs() {
    try {
      if (!deviceId) return;
      
      const url = window.LATEST_URL || 'latest/';
      const fullUrl = `${url}?device=${encodeURIComponent(deviceId)}`;
      const r = await fetch(fullUrl);
      if (r.status === 204) return;
      const j = await r.json();
      if (j?.ts) lastTsSeen = j.ts;
    } catch (_) {}
  }

  function startLatestPoller() {
    if (pollIntervalId) return;
    pollIntervalId = setInterval(async () => {
      try {
        if (!deviceId) return;
        
        const url = window.LATEST_URL || 'latest/';
        const fullUrl = `${url}?device=${encodeURIComponent(deviceId)}`;
        const r = await fetch(fullUrl);
        if (r.status === 204) return;
        const j = await r.json();
        if (!j?.ts || j.ts === lastTsSeen) return;
        lastTsSeen = j.ts;
        playVideo(j.youtube_id);
        showMessage('✓ Video playing!', 'success');
        if (qrVisible) hideQr();
      } catch (_) {}
    }, POLL_INTERVAL_MS);
  }

  function init() {
    // Get device ID from DeviceManager
    deviceId = DeviceManager.ensureDeviceIdInUrl();
    if (!deviceId) return; // We're reloading with device_id
    
    loadPlaylistsData();

    // Select random playlist on first load
    if (!currentPlaylist) {
      const cats = Object.keys(playlists);
      if (cats.length) {
        const catKey = cats[Math.floor(Math.random() * cats.length)];
        const list = playlists[catKey];
        if (list?.length) {
          currentCategoryKey = catKey;
          currentPlaylist = list[Math.floor(Math.random() * list.length)].id;
          pendingPlaylistLoad = currentPlaylist;
        }
      }
    }

    initMenu();
    
    // Set the initial active states after menu is initialized
    setInitialActiveStates();
    
    // Click anywhere when screen is off to turn it back on
    document.body.addEventListener('click', (e) => {
      if (document.body.className === 'screen-off') {
        // Don't interfere with menu button
        if (!e.target.closest('.menu-button')) {
          document.body.className = '';
        }
      }
    });
    
    loadYouTubeApi();

    primeLatestTs().finally(startLatestPoller);

    window.onYouTubeIframeAPIReady = createPlayer;
    if (window.YT?.Player) createPlayer();
  }

  return { init };
})();