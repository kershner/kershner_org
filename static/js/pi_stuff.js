const PiStuff = {
  player: null,
  playerReady: false,
  currentPlaylist: null,
  playlists: {},
  pendingPlaylistLoad: null,

  _skipTimer: null,
  _consecutiveSkips: 0,
  _lastVideoId: null,

  _skipUnplayable() {
    this._consecutiveSkips++;
    if (this._consecutiveSkips >= 12) {
      this.player?.stopVideo();
      return;
    }
    clearTimeout(this._skipTimer);
    this._skipTimer = setTimeout(() => {
      try { this.player.nextVideo(); } catch (_) {}
    }, 250);
  },

  init(playlistId) {
    // If a playlist is explicitly requested, honor it.
    if (playlistId) {
      this.currentPlaylist = playlistId;
    }

    if (!this.player) {
      this.loadPlaylistsData();

      // Pick a random category + playlist on first load (only if nothing was specified).
      if (!this.currentPlaylist) {
        const categories = Object.keys(this.playlists);
        if (categories.length) {
          const cat = categories[Math.floor(Math.random() * categories.length)];
          const list = this.playlists[cat];
          if (list && list.length) {
            this.currentPlaylist = list[Math.floor(Math.random() * list.length)].id;
          }
        }
      }

      this.initMenu();
      this.initScreenToggle();
      this.loadYouTube();
    } else {
      // When already initialized, just switch playlists.
      this.player.loadPlaylist({ listType: 'playlist', list: this.currentPlaylist });
    }
  },

  loadPlaylistsData() {
    // Build in-memory category -> playlist list from server-provided data.
    const categories = window.CATEGORIES_DATA || [];
    categories.forEach(category => {
      this.playlists[`cat-${category.id}`] = category.playlists.map(p => ({
        id: p.youtube_playlist_id,
        name: p.name
      }));
    });
  },

  initMenu() {
    const menu = document.getElementById('menu');
    const playlists = document.getElementById('playlists');

    // Render the category that contains currentPlaylist (fallback: first category button in DOM).
    const categoryEntries = Object.entries(this.playlists);
    let matchedCategory = null;

    for (const [cat, lists] of categoryEntries) {
      if (lists.some(p => p.id === this.currentPlaylist)) {
        matchedCategory = cat;
        break;
      }
    }

    const categoryBtn = document.querySelector(
      matchedCategory ? `[data-category="${matchedCategory}"]` : '[data-category]'
    );

    if (categoryBtn) {
      const category = categoryBtn.dataset.category;

      // Highlight selected category.
      document.querySelectorAll('[data-category]').forEach(btn => btn.classList.remove('selected'));
      categoryBtn.classList.add('selected');

      // Populate playlists for that category.
      if (this.playlists[category]) {
        playlists.innerHTML = this.playlists[category]
          .map(p => `<button data-playlist="${p.id}">${p.name}</button>`)
          .join('');
        playlists.hidden = false;

        // Highlight selected playlist if present.
        if (this.currentPlaylist) {
          const btn = playlists.querySelector(`[data-playlist="${this.currentPlaylist}"]`);
          if (btn) btn.classList.add('selected');
        }
      }
    }

    // Open menu overlay.
    document.querySelector('.menu-button').addEventListener('click', () => {
      menu.hidden = false;
    });

    // Single delegated click handler for category/playlist/actions.
    menu.addEventListener('click', (e) => {
      const category = e.target.dataset.category;
      const playlist = e.target.dataset.playlist;
      const action = e.target.dataset.action;

      if (category && this.playlists[category]) {
        // Select category and render its playlists.
        document.querySelectorAll('[data-category]').forEach(btn => {
          btn.classList.remove('selected');
        });
        e.target.classList.add('selected');

        playlists.innerHTML = this.playlists[category]
          .map(p => `<button data-playlist="${p.id}">${p.name}</button>`)
          .join('');
        playlists.hidden = false;

        // If current playlist exists in this category, keep it highlighted.
        if (this.currentPlaylist) {
          const currentBtn = playlists.querySelector(`[data-playlist="${this.currentPlaylist}"]`);
          if (currentBtn) {
            currentBtn.classList.add('selected');
          }
        }
        return;
      }

      if (playlist) {
        // Select playlist and load it into the player.
        document.querySelectorAll('[data-playlist]').forEach(btn => {
          btn.classList.remove('selected');
        });
        e.target.classList.add('selected');

        this.currentPlaylist = playlist;
        this.pendingPlaylistLoad = playlist;

        this._consecutiveSkips = 0;
        this._lastVideoId = null;
        clearTimeout(this._skipTimer);

        if (this.player) {
          this.player.stopVideo();
          this.player.loadPlaylist({
            listType: 'playlist',
            list: playlist,
            index: 0,
            startSeconds: 0
          });
        }

        menu.hidden = true;
        return;
      }

      // Simple menu actions.
      if (action === 'reload') {
        location.reload();
        return;
      }

      if (action === 'screen') {
        document.body.classList.toggle('screen-off');
        menu.hidden = true;
        return;
      }

      if (action === 'close') {
        menu.hidden = true;
      }
    });
  },

  initScreenToggle() {
    // Clicking anywhere exits "screen off" mode, except inside the menu UI.
    document.addEventListener('click', (e) => {
      if (document.body.classList.contains('screen-off') &&
          !e.target.closest('.menu-button, .menu')) {
        document.body.classList.remove('screen-off');
      }
    }, true);
  },

  loadYouTube() {
    // Load the YouTube IFrame API, which calls onYouTubeIframeAPIReady().
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
  },

  createPlayer() {
    this.player = new YT.Player('player', {
      // Slightly reduces tracking + sometimes behaves better on kiosks
      host: 'https://www.youtube-nocookie.com',

      playerVars: {
        listType: 'playlist',
        list: this.currentPlaylist,

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
        onReady: (e) => {
          // Required for reliable autoplay
          e.target.mute();

          // Force lowest practical quality immediately
          e.target.setPlaybackQuality('small');

          // One-time setup: shuffle + advance once to start playback cleanly.
          if (!this.playerReady) {
            this.playerReady = true;
            e.target.setShuffle(true);
            e.target.nextVideo();
          }
        },

        onError: () => {
          // Age restricted / embed blocked / removed / unplayable: just skip.
          this._skipUnplayable();
        },

        onStateChange: (e) => {
          if (e.data === YT.PlayerState.PLAYING) {
            // Re-assert low quality (YouTube likes to bump it)
            this.player.setPlaybackQuality('small');

            // Reset skip counter when a new video successfully plays.
            const vid = this.player.getVideoData?.().video_id || null;
            if (vid && vid !== this._lastVideoId) {
              this._lastVideoId = vid;
              this._consecutiveSkips = 0;
            }
          }

          // After a user-initiated playlist change, re-enable shuffle and advance.
          if (e.data === YT.PlayerState.PLAYING && this.pendingPlaylistLoad) {
            const loadedPlaylist = this.player.getPlaylistId?.();
            if (loadedPlaylist === this.pendingPlaylistLoad) {
              this.player.setShuffle(true);
              this.player.nextVideo();
              this.pendingPlaylistLoad = null;
            }
          }

          // Some “blocked” cases never fire onError; if stuck UNSTARTED, skip after a delay.
          if (e.data === YT.PlayerState.UNSTARTED) {
            clearTimeout(this._skipTimer);

            const startVid = this.player.getVideoData?.().video_id || null;
            this._skipTimer = setTimeout(() => {
              const state = this.player.getPlayerState?.();
              const nowVid = this.player.getVideoData?.().video_id || null;

              if (state !== YT.PlayerState.PLAYING && nowVid && nowVid === startVid) {
                this._skipUnplayable();
              }
            }, 4000);
          }
        }
      }
    });
  }
};

window.onYouTubeIframeAPIReady = () => PiStuff.createPlayer();

// Initialize once DOM is ready (for menu elements), then load YouTube API.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => PiStuff.init());
} else {
  PiStuff.init();
}
