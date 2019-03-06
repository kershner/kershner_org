var music = {
    'metaDataContainer' : document.getElementsByClassName('player-meta-container')[0],
    'soundWave'         : document.getElementsByClassName('sound-wave')[0],
    'playButton'        : document.getElementsByClassName('amplitude-play-pause')[0],
    songs               : {},
    songContainer       : 'amplitude-song-container',
    oldVideoUrl         : 'https://www.youtube.com/embed/videoseries?list=PLAtCvsbFyJ9bQAqn6DUD8pmGR0FPWKRtJ'
};

music.init = function() {
    amplitudeInit();
    playlistSelect();
    songSelect();
    playButtonListener();
    deferVideoLoad();

    function amplitudeInit() {
        var amplitudeSongs = [],
            loopsPlaylist = [],
            songsPlaylist = [];

        for (var i=0; i<music.songs.length; i++) {
            var containerDiv = document.createElement('div'),
                playlistContainer = document.getElementById('songs'),
                song = music.songs[i],
                currentColor = portfolio.colors[portfolio.colorIndex][0],
                classNames = 'amplitude-song-container amplitude-play-pause dynamic-color ' + currentColor,
                playlist = songsPlaylist;

            containerDiv.setAttribute('amplitude-playlist', 'songs');
            containerDiv.setAttribute('amplitude-song-index', i.toString());
            containerDiv.className = classNames;
            containerDiv.innerHTML =    '<div class="song-info"><div class="song-thumbnail">' +
                                        '<img data-src="' + song.cover_art_url+ '">' +
                                        '<div class="activity dynamic-color ' + currentColor + '"></div>' +
                                        '</div><div class="song-title">'+song.name+'</div></div>' +
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
            'starting_playlist' : 'songs'
        };
        Amplitude.init(amplitudeOptions);
        portfolio.deferImages();
        music.metaDataContainer.style.backgroundImage = 'url('+ Amplitude.getActiveSongMetadata().cover_art_url +')';
    }

    function showHideVisualizer() {
        var playing = hasClass(music.playButton, 'amplitude-playing');

        addClass(music.soundWave, 'hidden');
        if (playing) {
            removeClass(music.soundWave, 'hidden');
        }
    }

    function playlistSelect() {
        // Onclick for playlist options
        document.querySelectorAll('.playlist-option').forEach(function(e) {
            e.addEventListener('click', function(e) {
                togglePlaylist(e.target);
            });
        });
    }

    function playButtonListener() {
        music.playButton.addEventListener('click', function() {
            showHideVisualizer();
        });
    }

    function songSelect() {
        setTimeout(function() {
            removeClass(music.metaDataContainer, 'pop-up');
        }, 700);

        // Onclick for song containers
        document.querySelectorAll('.' + music.songContainer).forEach(function(e) {
            e.addEventListener('click', function() {
                showHideVisualizer();
                music.metaDataContainer.style.backgroundImage = 'url('+ Amplitude.getActiveSongMetadata().cover_art_url +')';
                addClass(music.metaDataContainer, 'pop-up');
                setTimeout(function() {
                    removeClass(music.metaDataContainer, 'pop-up');
                }, 700);
            });
        });
    }

    function togglePlaylist(element) {
        var type = element.getAttribute('data-type'),
            songsContainer = document.getElementById('songs'),
            loopsContainer = document.getElementById('loops'),
            currentColor = portfolio.colors[portfolio.colorIndex][0];

        // Remove/add active class
        document.querySelectorAll('.playlist-option').forEach(function(e) {
            removeClass(e, 'active');
            removeClass(e, 'dynamic-color');
            for (var i=0; i<portfolio.colors.length; i++) {
                if (hasClass(e, portfolio.colors[i][0])) {
                    removeClass(e,  portfolio.colors[i][0]);
                    break;
                }
            }
        });
        addClass(element, 'dynamic-color');
        addClass(element, 'active');
        addClass(element, currentColor);

        if (type === 'loops') {
            // Show loops, hide songs
            removeClass(loopsContainer, 'hidden');
            addClass(songsContainer, 'hidden');
        } else {
            // Show songs, hide loops
            removeClass(songsContainer, 'hidden');
            addClass(loopsContainer, 'hidden');
        }
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