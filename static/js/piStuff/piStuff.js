import { DeviceManager } from './deviceManager.js';

const PiStuff = (() => {
  const POLL_INTERVAL_MS = 2500;
  const $ = s => document.querySelector(s);
  const $all = s => document.querySelectorAll(s);

  let player;
  let deviceId;
  let playerReady = false;
  let currentPlaylist = null;
  let pendingPlaylistLoad = null;
  let consecutiveSkips = 0;
  let lastVideoId = null;
  let skipTimer = null;
  let pollIntervalId = null;
  let lastTsSeen = 0;
  let shuffleState = false;

  let playlists = {};
  let currentCategoryKey = null;
  let qrVisible = false;

  const safe = (fn, fallback = null) => {
    try { return fn(); } catch (_) { return fallback; }
  };

  function showMessage(text, type = 'info', duration = 3000) {
    const msgEl = $('#display-message');
    if (!msgEl) return;
    msgEl.textContent = text;
    msgEl.className = 'display-message show ' + type;
    setTimeout(() => msgEl.classList.remove('show'), duration);
  }

  function getMenu() {
    return $('#menu');
  }

  function showQr() {
    const container = $('#qr-container');
    const playlists = $('#playlists');
    
    if (!container) return;
    
    playlists.hidden = true;
    container.hidden = false;
    qrVisible = true;
  }

  function hideQr() {
    const container = $('#qr-container');
    const playlists = $('#playlists');
    
    if (!container) return;
    
    container.hidden = true;
    playlists.hidden = false;
    qrVisible = false;
  }

  async function regenerateQrCode() {
    if (!deviceId) {
      showMessage('Device ID not found', 'error');
      return;
    }

    const button = document.querySelector('[data-action="regenerate-qr"]');
    const qrImg = button?.querySelector('img');
    
    if (button) {
      button.disabled = true;
    }

    try {
      const url = window.REGENERATE_QR_URL;
      
      // Get CSRF token from cookie
      const csrfToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrftoken='))
        ?.split('=')[1];
      
      const formData = new URLSearchParams();
      formData.append('device_id', deviceId);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-CSRFToken': csrfToken
        },
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Failed to regenerate QR code');
      }

      const data = await response.json();
      
      if (qrImg && data.qr_code_b64) {
        qrImg.src = `data:image/png;base64,${data.qr_code_b64}`;
        
        // Show different message based on whether it was regenerated or cached
        const message = data.regenerated 
          ? '✓ QR code regenerated!' 
          : '✓ QR code is still valid!';
        showMessage(message, 'success');
      }
    } catch (error) {
      console.error('QR regeneration error:', error);
      showMessage('Failed to regenerate QR code', 'error');
    } finally {
      if (button) {
        button.disabled = false;
      }
    }
  }

  function playVideo(videoId) {
    if (!player) return;
    player.loadVideoById(videoId);
    player.playVideo();
  }

  function skipUnplayable() {
    consecutiveSkips++;
    if (consecutiveSkips > 8) {
      showMessage('Too many unplayable videos. Check playlist.', 'error', 5000);
      playRandom();
      return;
    }
    player?.nextVideo();
  }

  function renderPlaylistsForCategory(categoryKey) {
    const container = $('#playlists');
    if (!container) return;

    const list = playlists[categoryKey] || [];
    if (!list.length) {
      container.innerHTML = '<p class="no-playlists">No playlists in this category</p>';
      return;
    }

    const html = list.map(p => {
      const selected = p.id === currentPlaylist ? ' selected' : '';
      return `<button data-playlist="${p.id}" class="playlist-button${selected}">${p.name}</button>`;
    }).join('');

    container.innerHTML = html;
  }

  function setInitialActiveStates() {
    if (!currentCategoryKey || !currentPlaylist) return;

    // Highlight the category button
    const catBtn = document.querySelector(`[data-category="${currentCategoryKey}"]`);
    if (catBtn) {
      catBtn.classList.add('selected');
    }

    // Render and highlight the playlist
    renderPlaylistsForCategory(currentCategoryKey);
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

    // Select random playlist on first load
    if (!currentPlaylist) {
      const playlistName = playRandom();
      if (playlistName) {
        // Show message after a brief delay to ensure UI is ready
        setTimeout(() => showMessage(`Playing ${playlistName}`, 'info', 3000), 500);
      }
    }
  }

  function loadPlaylist(playlistId, playlistName, shuffle = true, skipInitialNext = false) {
    currentPlaylist = playlistId;
    pendingPlaylistLoad = playlistId;
    consecutiveSkips = 0;
    lastVideoId = null;
    clearTimeout(skipTimer);

    player?.stopVideo();
    player?.loadPlaylist({ listType: 'playlist', list: playlistId, index: 0 });
    
    // Store whether to shuffle for when playlist loads
    window.pendingShuffleState = shuffle;
    window.skipInitialNext = skipInitialNext;
    
    return playlistName;
  }

  function playRandom() {
    const cats = Object.keys(playlists);
    if (cats.length === 0) return false;
    
    const catKey = cats[Math.floor(Math.random() * cats.length)];
    const list = playlists[catKey];
    if (!list?.length) return false;
    
    const randomPlaylist = list[Math.floor(Math.random() * list.length)];
    
    $all('[data-category]').forEach(b => b.classList.remove('selected'));
    $all('[data-playlist]').forEach(b => b.classList.remove('selected'));
    
    const categoryBtn = document.querySelector(`[data-category="${catKey}"]`);
    if (categoryBtn) categoryBtn.classList.add('selected');
    
    currentCategoryKey = catKey;
    currentPlaylist = randomPlaylist.id;
    
    renderPlaylistsForCategory(catKey);
    
    return loadPlaylist(randomPlaylist.id, randomPlaylist.name, true, true);
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
      const action = t.dataset.action || t.closest('[data-action]')?.dataset.action;

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

        // Find the playlist name for the message
        let playlistName = 'playlist';
        if (currentCategoryKey && playlists[currentCategoryKey]) {
          const playlistObj = playlists[currentCategoryKey].find(p => p.id === playlist);
          if (playlistObj) {
            playlistName = playlistObj.name;
          }
        }

        loadPlaylist(playlist, playlistName);
        menu.hidden = true;
        hideQr();
        setTimeout(() => showMessage(`Playing ${playlistName}`, 'info', 2000), 100);
        return;
      }

      if (action === 'qr') return showQr();
      if (action === 'regenerate-qr') {
        ev.stopPropagation();
        return regenerateQrCode();
      }
      if (action === 'reload') return location.reload();
      if (action === 'random') {
        const playlistName = playRandom();
        if (!playlistName) return;
        
        menu.hidden = true;
        hideQr();
        setTimeout(() => showMessage(`Playing ${playlistName}`, 'info', 2000), 100);
        return;
      }
      if (action === 'shuffle') {
        shuffleState = !shuffleState;
        const shuffleBtn = menu.querySelector('[data-action="shuffle"]');
        shuffleBtn.classList.toggle('selected');
        setTimeout(() => showMessage(`Shuffle ${shuffleState ? 'on' : 'off'}`, 'info', 2000), 100);
        return;
      }
      if (action === 'screen') {
        ev.stopPropagation();  // Prevent event from bubbling to body
        document.body.className = 'screen-off';
        menu.hidden = true;
        return;
      }
      if (action === 'close') menu.hidden = true;
    });

    // Click anywhere when screen is off to turn it back on
    screenToggle();

    // Set the initial active states after menu is initialized
    setInitialActiveStates();
  }

  function loadYouTubeApi() {
    if (document.querySelector('script[src*="youtube.com/iframe_api"]')) return;
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
    window.onYouTubeIframeAPIReady = createPlayer;
  }

  function createPlayer() {
    player = new YT.Player('player', {
      playerVars: {
        listType: 'playlist',
        list: currentPlaylist,
        autoplay: 1,
        playsinline: 1,
        controls: 1,
        fs: 0,
        disablekb: 1,
        iv_load_policy: 3,     // annotations off
        cc_load_policy: 1,     // captions on
      },
      events: {
        onReady(e) {
          e.target.mute();
          e.target.setShuffle(true);
          e.target.nextVideo();
        },
        onError: skipUnplayable,
        onStateChange(e) {
          if (e.data === YT.PlayerState.PLAYING) {
            const vid = safe(() => player.getVideoData().video_id);
            
            // Handle pending playlist load FIRST (before anything else)
            if (pendingPlaylistLoad) {
              const loaded = safe(() => player.getPlaylistId());
              if (loaded === pendingPlaylistLoad) {
                const shouldShuffle = window.pendingShuffleState !== false;
                const skipNext = window.skipInitialNext || false;
                
                player.setShuffle(shouldShuffle);
                
                if (shouldShuffle && !skipNext) {
                  player.nextVideo();
                } else if (!shouldShuffle) {
                  player.playVideoAt(0);
                }
                // If skipNext is true and shouldShuffle is true, just let it play the current video
                
                pendingPlaylistLoad = null;
                window.pendingShuffleState = undefined;
                window.skipInitialNext = undefined;
              }
              
              // Update lastVideoId but don't trigger shuffle logic
              if (vid && vid !== lastVideoId) {
                lastVideoId = vid;
                consecutiveSkips = 0;
                
                if (!playerReady) {
                  playerReady = true;
                }
              }
              return; // Exit early
            }
            
            // Now check for video changes (when NOT loading a new playlist)
            if (vid && vid !== lastVideoId) {
              const wasFirstVideo = lastVideoId === null;
              lastVideoId = vid;
              consecutiveSkips = 0;
              
              // Mark player as ready after first video starts (post-shuffle)
              if (!playerReady) {
                playerReady = true;
              }
              
              // If shuffle is enabled and player is ready (past initialization)
              if (shuffleState && playerReady && !wasFirstVideo) {
                playRandom();
                return;
              }
            }
          }
          
          // Handle end of playlist (when there's no next video)
          if (e.data === YT.PlayerState.ENDED) {
            if (shuffleState) {
              playRandom();
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
        
        // Handle both videos and playlists
        if (j.type === 'playlist') {
          loadPlaylist(j.youtube_id, 'Submitted playlist', false);  // Don't shuffle submitted playlists
          showMessage('✓ Playlist playing!', 'success');
        } else {
          playVideo(j.youtube_id);
          showMessage('✓ Video playing!', 'success');
        }
        
        if (qrVisible) hideQr();
        const menu = getMenu();
        menu.hidden = true
      } catch (_) {}
    }, POLL_INTERVAL_MS);
  }

  function customVideoControls() {
    const playerContainer = document.getElementById('player-container');
    if (!playerContainer) return;

    const doubleClickDelay = 300;
    const secondsToSkip = 20;

    function createOverlay(side) {
      const overlay = document.createElement('div');
      overlay.id = `player-overlay-${side}`;
      playerContainer.appendChild(overlay);

      let lastClickTime = 0;
      let isDouble = false;

      overlay.addEventListener('click', () => {
        if (document.body.className === 'screen-off' || !player) return;

        const now = Date.now();
        const timeSinceLastClick = now - lastClickTime;

        if (timeSinceLastClick < doubleClickDelay) {
          if (isDouble) {
            // Triple-click - previous/next video
            side === 'left' ? player.previousVideo() : player.nextVideo();
            showMessage(side === 'left' ? 'Previous video' : 'Next video', 'info', 1000);
            isDouble = false;
            lastClickTime = 0;
          } else {
            // Double-click - skip backward/forward
            const currentTime = player.getCurrentTime();
            if (side === 'left') {
              player.seekTo(Math.max(0, currentTime - secondsToSkip), true);
              showMessage(`-${secondsToSkip}s`, 'info', 1000);
            } else {
              const duration = player.getDuration();
              player.seekTo(Math.min(duration, currentTime + secondsToSkip), true);
              showMessage(`+${secondsToSkip}s`, 'info', 1000);
            }
            isDouble = true;
            lastClickTime = now;
          }
        } else {
          // First click - wait to see if double-click
          isDouble = false;
          lastClickTime = now;

          setTimeout(() => {
            if (lastClickTime === now && !isDouble) {
              // Single click - pause/play
              const state = player.getPlayerState();
              state === YT.PlayerState.PLAYING ? player.pauseVideo() : player.playVideo();
            }
          }, doubleClickDelay);
        }
      });
    }

    createOverlay('left');
    createOverlay('right');
  }

  function screenToggle() {
    document.body.addEventListener('click', (e) => {
      if (document.body.className === 'screen-off') {
        // Don't interfere with menu button
        if (!e.target.closest('.menu-button')) {
          document.body.className = '';
        }
      }
    });
  }

  function init() {
    // Get device ID from DeviceManager
    deviceId = DeviceManager.ensureDeviceIdInUrl();
    if (!deviceId) return; // We're reloading with device_id
    
    loadPlaylistsData();
    initMenu();
    customVideoControls();
    loadYouTubeApi();
    primeLatestTs().finally(startLatestPoller);    
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => {
  PiStuff.init();
});

export default PiStuff;