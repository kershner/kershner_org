var music = {
    songs           : {},
    songContainer   : 'amplitude-song-container',
    oldVideoUrl     : 'https://www.youtube.com/embed/w1t-Mevr9YM'
};

music.init = function() {
    amplitudeInit();
    playlistSelect();
    songSelect();
    deferVideoLoad();

    function amplitudeInit() {
        var amplitudeSongs = [],
            loopsPlaylist = [],
            songsPlaylist = [];

        for (var i=0; i<music.songs.length; i++) {
            var containerDiv = document.createElement('div'),
                playlistContainer = document.getElementById('songs'),
                song = music.songs[i],
                classNames = 'amplitude-song-container amplitude-play-pause',
                playlist = songsPlaylist;

            containerDiv.setAttribute('amplitude-playlist', 'songs');
            containerDiv.setAttribute('amplitude-song-index', i.toString());
            containerDiv.className = classNames;
            containerDiv.innerHTML =    '<div class="song-info"><div class="song-title">'+song.name+'</div></div>' +
                                        '<div class="duration">' + song.duration + '</div>';

            // Loop specific stuff
            if (song.type === 'LO') {
                playlistContainer = document.getElementById('loops');
                playlist = loopsPlaylist;
                containerDiv.setAttribute('amplitude-playlist', 'loops');
            }

            playlist.push(i);
            playlistContainer.appendChild(containerDiv);
            amplitudeSongs.push(music.songs[i]);
        }

        var amplitudeOptions = {
            'songs' : amplitudeSongs,
            'playlists' : {
                'loops' : loopsPlaylist,
                'songs' : songsPlaylist
            },
            'starting_playlist' : 'loops'
        };
        Amplitude.init(amplitudeOptions);
    }

    function playlistSelect() {
        // Onclick for playlist options
        document.querySelectorAll('.playlist-option').forEach(function(e) {
            e.addEventListener('click', function(e) {
                togglePlaylist(e.target);
            });
        });
    }

    function songSelect() {
        // Onclick for song containers
        document.querySelectorAll('.' + music.songContainer).forEach(function(e) {
            e.addEventListener('click', function() {
                console.log('clicked on a song!');
            });
        });
    }

    function togglePlaylist(element) {
        var type = element.getAttribute('data-type'),
            songsContainer = document.getElementById('songs'),
            loopsContainer = document.getElementById('loops'),
            shuffleBtn = document.getElementsByClassName('amplitude-shuffle')[0];

        // Remove/add active class
        document.querySelectorAll('.playlist-option').forEach(function(e) {
            removeClass(e, 'active');
        });
        addClass(element, 'active');

        if (type === 'loops') {
            // Show loops, hide songs
            removeClass(loopsContainer, 'hidden');
            addClass(songsContainer, 'hidden');
        } else {
            // Show songs, hide loops
            removeClass(songsContainer, 'hidden');
            addClass(loopsContainer, 'hidden');
        }

        shuffleBtn.setAttribute('amplitude-playlist', type);
    }

    function deferVideoLoad() {
        var oldVideoIfr = document.getElementById('old-music-video-ifr'),
            oldVideoToggle = document.getElementById('old-video-toggle'),
            videoWrapper = document.getElementsByClassName('outer-music-video-wrapper')[0];

        oldVideoToggle.onclick = function() {
            addClass(this, 'hidden');
            removeClass(videoWrapper, 'hidden');
            oldVideoIfr.src = music.oldVideoUrl
        };
    }
};