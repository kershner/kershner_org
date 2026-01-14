const PiStuff = {
  player: null,
  playerReady: false,
  currentPlaylist: null,
  playlists: {},
  pendingPlaylistLoad: null,

  init(playlistId) {
    if (playlistId) {
      this.currentPlaylist = playlistId;
    }

    if (!this.player) {
      this.loadPlaylistsData();
      this.initMenu();
      this.initScreenToggle();
      this.loadYouTube();
    } else {
      this.player.loadPlaylist({ listType: 'playlist', list: this.currentPlaylist });
    }
  },

  loadPlaylistsData() {
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

    // Auto-show first category's playlists based on first button in DOM
    const firstCategoryBtn = document.querySelector('[data-category]');
    if (firstCategoryBtn) {
      const firstCategory = firstCategoryBtn.dataset.category;
      if (this.playlists[firstCategory]) {
        firstCategoryBtn.classList.add('selected');
        playlists.innerHTML = this.playlists[firstCategory]
          .map(p => `<button data-playlist="${p.id}">${p.name}</button>`)
          .join('');
        playlists.hidden = false;
        
        // Auto-select first playlist
        const firstPlaylistBtn = playlists.querySelector('[data-playlist]');
        if (firstPlaylistBtn) {
          firstPlaylistBtn.classList.add('selected');
        }
      }
    }

    document.querySelector('.menu-button').addEventListener('click', () => {
      menu.hidden = false;
    });

    menu.addEventListener('click', (e) => {
      const category = e.target.dataset.category;
      const playlist = e.target.dataset.playlist;
      const action = e.target.dataset.action;

      if (category && this.playlists[category]) {
        // Remove selected from all category buttons
        document.querySelectorAll('[data-category]').forEach(btn => {
          btn.classList.remove('selected');
        });
        // Add selected to clicked category button
        e.target.classList.add('selected');
        
        playlists.innerHTML = this.playlists[category]
          .map(p => `<button data-playlist="${p.id}">${p.name}</button>`)
          .join('');
        playlists.hidden = false;
        
        // Restore selection if current playlist is in this category
        if (this.currentPlaylist) {
          const currentBtn = playlists.querySelector(`[data-playlist="${this.currentPlaylist}"]`);
          if (currentBtn) {
            currentBtn.classList.add('selected');
          }
        }
        return;
      }

      if (playlist) {
        // Remove selected from all playlist buttons
        document.querySelectorAll('[data-playlist]').forEach(btn => {
          btn.classList.remove('selected');
        });
        // Add selected to clicked playlist button
        e.target.classList.add('selected');
        
        this.currentPlaylist = playlist;
        this.pendingPlaylistLoad = playlist;
        
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
    document.addEventListener('click', (e) => {
      if (document.body.classList.contains('screen-off') && 
          !e.target.closest('.menu-button, .menu')) {
        document.body.classList.remove('screen-off');
      }
    }, true);
  },

  loadYouTube() {
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
  },

  createPlayer() {
    if (!this.currentPlaylist) {
      const firstCategory = Object.keys(this.playlists)[0];
      if (firstCategory && this.playlists[firstCategory][0]) {
        this.currentPlaylist = this.playlists[firstCategory][0].id;
      }
    }

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
        cc_load_policy: 0,     // captions off

        // Strong hint to start low-res (biases H.264 likelihood)
        vq: 'small',
      },

      events: {
        onReady: (e) => {
          // Required for reliable autoplay
          e.target.mute();

          // Force lowest practical quality immediately
          e.target.setPlaybackQuality('small');

          if (!this.playerReady) {
            this.playerReady = true;
            e.target.setShuffle(true);
            e.target.nextVideo();
          }
        },

        onStateChange: (e) => {
          if (e.data === YT.PlayerState.PLAYING) {
            // Re-assert low quality (YouTube likes to bump it)
            this.player.setPlaybackQuality('small');
          }

          if (e.data === YT.PlayerState.PLAYING && this.pendingPlaylistLoad) {
            const loadedPlaylist = this.player.getPlaylistId?.();
            if (loadedPlaylist === this.pendingPlaylistLoad) {
              this.player.setShuffle(true);
              this.player.nextVideo();
              this.pendingPlaylistLoad = null;
            }
          }
        }
      }
    });
  }
};

window.onYouTubeIframeAPIReady = () => PiStuff.createPlayer();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => PiStuff.init());
} else {
  PiStuff.init();
}