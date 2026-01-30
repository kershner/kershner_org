import { DeviceManager } from './deviceManager.js';

const PiStuff = (() => {
  const POLL_INTERVAL_MS = 2500;
  const $ = s => document.querySelector(s);
  const $all = s => document.querySelectorAll(s);

  let player, deviceId, currentPlaylist, pendingPlaylistLoad, skipTimer, pollIntervalId;
  let consecutiveSkips = 0;
  let lastVideoId = null;
  let lastTsSeen = 0;
  let shuffleState = false;
  let playlists = {};
  let currentCategoryKey = null;
  let qrVisible = false;

  // Track progress + user-initiated advances (for shuffle-mode "random playlist on advance")
  let userInitiatedAdvance = false;
  let lastProgress = { t: 0, d: 0 };
  let progressTimer = null;

  // Prevent multiple random playlist loads during YouTube state churn
  let switchingPlaylist = false;

  const safe = (fn, fallback = null) => {
    try { return fn(); } catch (_) { return fallback; }
  };

  function applyQueryParams() {
    const p = new URLSearchParams(location.search);
    const video = p.get('video') || p.get('v');
    const playlist = p.get('playlist') || p.get('list');
    const category = p.get('category') || p.get('cat');

    if (p.get('shuffle') === 'true') shuffleState = true;

    if (category && playlists[category]) {
      currentCategoryKey = category;
      $(`[data-category="${category}"]`)?.classList.add('selected');
      renderPlaylistsForCategory(category);
    }

    if (playlist) {
      let name = 'playlist';
      for (const cat of Object.values(playlists)) {
        const pl = cat.find(x => x.id === playlist);
        if (pl) { name = pl.name; break; }
      }
      currentPlaylist = playlist;
      loadPlaylist(playlist, name);
    } else if (video) {
      setTimeout(() => playVideo(video), 500);
    }

    if (shuffleState) $('#menu [data-action="shuffle"]')?.classList.add('selected');
  }

  function startProgress() {
    if (progressTimer) return;
    progressTimer = setInterval(() => {
      if (!player) return;
      lastProgress.t = safe(() => player.getCurrentTime(), 0) || 0;
      lastProgress.d = safe(() => player.getDuration(), 0) || 0;
    }, 250);
  }

  function stopProgress() {
    clearInterval(progressTimer);
    progressTimer = null;
  }

  function showMessage(text, type = 'info', duration = 3000) {
    const msgEl = $('#display-message');
    if (!msgEl) return;
    msgEl.textContent = text;
    msgEl.className = 'display-message show ' + type;
    setTimeout(() => msgEl.classList.remove('show'), duration);
  }

  function toggleQr(show) {
    const container = $('#qr-container');
    const playlistsEl = $('#playlists');
    if (!container) return;

    playlistsEl.hidden = show;
    container.hidden = !show;
    qrVisible = show;
  }

  async function regenerateQrCode() {
    if (!deviceId) return showMessage('Device ID not found', 'error');

    const button = $('[data-action="regenerate-qr"]');
    const qrImg = button?.querySelector('img');
    if (button) button.disabled = true;

    try {
      const csrfToken = document.cookie.split('; ').find(row => row.startsWith('csrftoken='))?.split('=')[1];
      const formData = new URLSearchParams({ device_id: deviceId });

      const response = await fetch(window.REGENERATE_QR_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRFToken': csrfToken },
        body: formData
      });

      if (!response.ok) throw new Error('Failed to regenerate QR code');

      const data = await response.json();
      if (qrImg && data.qr_code_b64) {
        qrImg.src = `data:image/png;base64,${data.qr_code_b64}`;
        showMessage(data.regenerated ? '✓ QR code regenerated!' : '✓ QR code is still valid!', 'success');
      }
    } catch (error) {
      console.error('QR regeneration error:', error);
      showMessage('Failed to regenerate QR code', 'error');
    } finally {
      if (button) button.disabled = false;
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

    container.innerHTML = list.map(p =>
      `<button data-playlist="${p.id}" class="playlist-button${p.id === currentPlaylist ? ' selected' : ''}">${p.name}</button>`
    ).join('');
  }

  function setInitialActiveStates() {
    if (!currentCategoryKey || !currentPlaylist) return;

    $(`[data-category="${currentCategoryKey}"]`)?.classList.add('selected');
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

    if (!currentPlaylist) {
      const playlistName = playRandom();
      if (playlistName) setTimeout(() => showMessage(`Playing ${playlistName}`, 'info', 3000), 500);
    }
  }

  function loadPlaylist(playlistId, playlistName) {
    currentPlaylist = playlistId;
    pendingPlaylistLoad = playlistId;
    consecutiveSkips = 0;
    lastVideoId = null;
    clearTimeout(skipTimer);

    switchingPlaylist = true;
    userInitiatedAdvance = false;
    lastProgress = { t: 0, d: 0 };

    player?.stopVideo();
    player?.loadPlaylist({ listType: 'playlist', list: playlistId, index: 0 });
    return playlistName;
  }

  function playRandom() {
    const cats = Object.keys(playlists);
    if (!cats.length) return false;

    const catKey = cats[Math.floor(Math.random() * cats.length)];
    const list = playlists[catKey];
    if (!list?.length) return false;

    const randomPlaylist = list[Math.floor(Math.random() * list.length)];

    $all('[data-category]').forEach(b => b.classList.remove('selected'));
    $all('[data-playlist]').forEach(b => b.classList.remove('selected'));
    $(`[data-category="${catKey}"]`)?.classList.add('selected');

    currentCategoryKey = catKey;
    currentPlaylist = randomPlaylist.id;
    renderPlaylistsForCategory(catKey);
    
    setTimeout(() => {
      showMessage(`Playing ${randomPlaylist.name}...`, 'info', 2000);
    }, 100);
    return loadPlaylist(randomPlaylist.id, randomPlaylist.name);
  }

  function initMenu() {
    const menu = $('#menu');
    if (!menu) return;

    $('.menu-button')?.addEventListener('click', () => menu.hidden = false);

    menu.addEventListener('click', ev => {
      const t = ev.target;
      const { category, playlist, action } = t.dataset;
      const actualAction = action || t.closest('[data-action]')?.dataset.action;

      if (category && playlists[category]) {
        $all('[data-category]').forEach(b => b.classList.remove('selected'));
        t.classList.add('selected');
        currentCategoryKey = category;
        renderPlaylistsForCategory(category);
        toggleQr(false);
        return;
      }

      if (playlist) {
        $all('[data-playlist]').forEach(b => b.classList.remove('selected'));
        t.classList.add('selected');

        let playlistName = 'playlist';
        if (currentCategoryKey) {
          const playlistObj = playlists[currentCategoryKey]?.find(p => p.id === playlist);
          if (playlistObj) playlistName = playlistObj.name;
        }

        loadPlaylist(playlist, playlistName);
        menu.hidden = true;
        toggleQr(false);
        setTimeout(() => showMessage(`Playing ${playlistName}`, 'info', 2000), 100);
        return;
      }

      if (actualAction === 'qr') return toggleQr(true);
      if (actualAction === 'regenerate-qr') {
        ev.stopPropagation();
        return regenerateQrCode();
      }
      if (actualAction === 'reload') return location.reload();
      if (actualAction === 'random') {
        const playlistName = playRandom();
        if (!playlistName) return;
        menu.hidden = true;
        toggleQr(false);
        setTimeout(() => showMessage(`Playing ${playlistName}`, 'info', 2000), 100);
        return;
      }
      if (actualAction === 'shuffle') {
        shuffleState = !shuffleState;
        menu.querySelector('[data-action="shuffle"]').classList.toggle('selected');
        setTimeout(() => showMessage(`Shuffle ${shuffleState ? 'on' : 'off'}`, 'info', 2000), 100);
        return;
      }
      if (actualAction === 'screen') {
        ev.stopPropagation();
        document.body.className = 'screen-off';
        menu.hidden = true;
        return;
      }
      if (actualAction === 'close') menu.hidden = true;
    });

    document.body.addEventListener('click', e => {
      if (document.body.className === 'screen-off' && !e.target.closest('.menu-button')) {
        document.body.className = '';
      }
    });

    setInitialActiveStates();
  }

  function loadYouTubeApi() {
    if ($('script[src*="youtube.com/iframe_api"]')) return;
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
        iv_load_policy: 3,
        cc_load_policy: 1,
      },
      events: {
        onReady(e) {
          e.target.mute();
          const overlays = ['#player-overlay-left', '#player-overlay-right', '.menu-button'];
          document.querySelectorAll(overlays.join(',')).forEach(el => el.classList.add('overlay-highlight'));
        },
        onError: skipUnplayable,
        onStateChange(e) {
          const state = e.data;

          // Debug YouTube player state
          // const stateName = Object.keys(YT.PlayerState).find(k => YT.PlayerState[k] === state);
          // if (stateName) console.log('State:', stateName);

          // Track progress only while playing
          state === YT.PlayerState.PLAYING ? startProgress() : stopProgress();

          const vid = safe(() => player.getVideoData().video_id);

          // End of playlist: always random
          if (state === YT.PlayerState.ENDED) return playRandom();

          // Detect unplayable videos
          if (state === YT.PlayerState.UNSTARTED) {
            clearTimeout(skipTimer);
            const startVid = vid;

            skipTimer = setTimeout(() => {
              const nowState = safe(() => player.getPlayerState());
              const nowVid = safe(() => player.getVideoData().video_id);
              if (nowState !== YT.PlayerState.PLAYING && nowVid === startVid) skipUnplayable();
            }, 4000);

            return;
          }

          // Ignore non-playing states beyond this point
          if (state !== YT.PlayerState.PLAYING) return;

          // First video after loading a playlist: shuffle + start at index 0
          if (pendingPlaylistLoad) {
            const loaded = safe(() => player.getPlaylistId());
            if (loaded === pendingPlaylistLoad) {
              pendingPlaylistLoad = null;
              switchingPlaylist = false;
              setTimeout(() => { player.setShuffle(true); player.playVideoAt(0); }, 0);
            }
            return;
          }

          // Detect real advances only (ignore internal state churn)
          if (switchingPlaylist || !vid || vid === lastVideoId) return;

          const { t, d } = lastProgress;
          const isAdvance = userInitiatedAdvance || (d > 0 && (d - t) < 1.5);
          userInitiatedAdvance = false;

          // Shuffle ON: any advance loads a random playlist
          if (shuffleState && lastVideoId !== null && isAdvance) return playRandom();

          lastVideoId = vid;
          consecutiveSkips = 0;
        }
      }
    });
  }

  async function fetchLatest() {
    if (!deviceId) return null;
    const r = await fetch(`${window.LATEST_URL || 'latest/'}?device=${encodeURIComponent(deviceId)}`);
    return r.status === 204 ? null : await r.json();
  }

  async function startLatestPoller() {
    if (pollIntervalId) return;

    try {
      const j = await fetchLatest();
      if (j?.ts) lastTsSeen = j.ts;
    } catch (_) { }

    pollIntervalId = setInterval(async () => {
      try {
        const j = await fetchLatest();
        if (!j?.ts || j.ts === lastTsSeen) return;

        lastTsSeen = j.ts;

        if (j.type === 'playlist') {
          loadPlaylist(j.youtube_id, 'Submitted playlist', false);
          showMessage('✓ Playlist playing!', 'success');
        } else {
          playVideo(j.youtube_id);
          showMessage('✓ Video playing!', 'success');
        }

        if (qrVisible) toggleQr(false);
        $('#menu').hidden = true;
      } catch (_) { }
    }, POLL_INTERVAL_MS);
  }

  function customVideoControls() {
    const playerContainer = $('#player-container');
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
            // Triple click: previous/next video
            if (side === 'left') {
              player.previousVideo(); // Always go to previous in current playlist
            } else {
              if (shuffleState) {
                userInitiatedAdvance = false;
                playRandom();
              } else {
                userInitiatedAdvance = true;
                player.nextVideo();
              }
            }
            showMessage(side === 'left' ? 'Previous video' : 'Next video', 'info', 1000);
            isDouble = false;
            lastClickTime = 0;
          } else {
            // Double click: skip forward/back 20 seconds
            const currentTime = player.getCurrentTime();
            if (side === 'left') {
              player.seekTo(Math.max(0, currentTime - secondsToSkip), true);
              showMessage(`-${secondsToSkip}s`, 'info', 1000);
            } else {
              player.seekTo(Math.min(player.getDuration(), currentTime + secondsToSkip), true);
              showMessage(`+${secondsToSkip}s`, 'info', 1000);
            }
            isDouble = true;
            lastClickTime = now;
          }
        } else {
          // First click: start timer for play/pause
          isDouble = false;
          lastClickTime = now;

          setTimeout(() => {
            if (lastClickTime === now && !isDouble) {
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

  function init() {
    deviceId = DeviceManager.ensureDeviceIdInUrl();
    if (!deviceId) return;

    loadPlaylistsData();
    applyQueryParams();
    initMenu();
    customVideoControls();
    loadYouTubeApi();
    startLatestPoller();
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => PiStuff.init());

export default PiStuff;