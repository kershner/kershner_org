var music = {
    'metaDataContainer' : document.getElementsByClassName('player-meta-container')[0],
    'soundWave'         : document.getElementsByClassName('sound-wave')[0],
    'playButton'        : document.getElementsByClassName('amplitude-play-pause')[0],
    'oldVideoToggle'    : document.getElementById('old-video-toggle'),
    songs               : {},
    songContainer       : 'amplitude-song-container',
    oldVideoUrl         : 'https://www.youtube.com/embed/videoseries?list=PLAtCvsbFyJ9bQAqn6DUD8pmGR0FPWKRtJ',
    songArtPoller       : undefined,
    noSleep             : new NoSleep()
};

music.init = function() {
    amplitudeInit();
    playlistSelect();
    songSelect();
    playButtonListener();
    deferVideoLoad();
    pollForSongArtChanges();

    document.addEventListener('touchstart', function(e) {
        enableNoSleep();
    });

    function amplitudeInit() {
        var amplitudeSongs = [],
            loopsPlaylist = [],
            songsPlaylist = [],
            oldSongsPlaylist = [];

        for (var i=0; i<music.songs.length; i++) {
            var containerDiv = document.createElement('div'),
                playlistContainer = document.getElementById('songs'),
                song = music.songs[i],
                classNames = 'amplitude-song-container',
                playlist = songsPlaylist,
                playlistString = 'songs',
                youtubeLinkHtml = '';

            switch (song.type) {
                // Loops
                case 'LO':
                    playlistContainer = document.getElementById('loops');
                    playlistString = 'loops';
                    playlist = loopsPlaylist;
                    containerDiv.setAttribute('amplitude-playlist', 'loops');
                    break;
                // Old songs
                case 'OL':
                    playlistContainer = document.getElementById('old-songs');
                    playlistString = 'old-songs';
                    playlist = oldSongsPlaylist;
                    containerDiv.setAttribute('amplitude-playlist', 'old-songs');
                    break;
            }

            if (song.youtube_url) {
                youtubeLinkHtml = `<a href="${song.youtube_url}" target="_blank" title="View on YouTube"><div class="song-youtube-link dynamic-color amplitude-pause"></div></a>`;
            }

            containerDiv.setAttribute('amplitude-playlist', playlistString);
            containerDiv.setAttribute('amplitude-song-index', i.toString());
            containerDiv.className = classNames;
            containerDiv.innerHTML = `
                <div amplitude-playlist=${playlistString} amplitude-song-index=${i} class="song-info amplitude-play-pause">
                    <div class="song-thumbnail">
                        <img src="${song.cover_art_url}">
                        <div class="activity dynamic-color">
                        </div>
                    </div>

                    <div class="song-title">${song.name}</div>
                </div>

                <div amplitude-playlist=${playlistString} amplitude-song-index=${i} class="song-spacer amplitude-play-pause"></div>

                <div class="song-extras">
                    ${youtubeLinkHtml}
                    <a href="${song.url}" target="_blank" title="Download"><div class="song-download-link dynamic-color amplitude-pause"></div></a>
                </div>

                <div class="duration">${song.duration}</div>
            `;

            playlist.push(i);
            playlistContainer.appendChild(containerDiv);
            amplitudeSongs.push(music.songs[i]);
        }

        var amplitudeOptions = {
            'songs' : amplitudeSongs,
            'playlists' : {
                'loops'     : loopsPlaylist,
                'songs'     : songsPlaylist,
                'oldSongs'  : oldSongsPlaylist
            },
            'starting_playlist' : 'songs',
            'volume' : 100
        };
        Amplitude.init(amplitudeOptions);
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
            oldSongsContainer = document.getElementById('old-songs');

        // Remove/add active class
        document.querySelectorAll('.playlist-option').forEach(function(e) {
            removeClass(e, 'active');
            removeClass(e, 'dynamic-color');
        });
        addClass(element, 'dynamic-color');
        addClass(element, 'active');

        addClass(songsContainer, 'hidden');
        addClass(loopsContainer, 'hidden');
        addClass(oldSongsContainer, 'hidden');
        switch (type) {
            case 'loops':
                removeClass(loopsContainer, 'hidden');
                break;
            case 'old-songs':
                removeClass(oldSongsContainer, 'hidden');
                break;
            case 'songs':
                removeClass(songsContainer, 'hidden');
                break;
        }
    }

    function deferVideoLoad() {
        let videoWrapper = document.getElementsByClassName('outer-music-video-wrapper')[0];
        let innerWrapper = document.getElementsByClassName('music-video-wrapper')[0];

        music.oldVideoToggle.onclick = function() {
            let newIframe = document.createElement('iframe');
            newIframe.setAttribute('src', music.oldVideoUrl);
            newIframe.setAttribute('allowfullscreen', '');
            newIframe.setAttribute('frameborder', '0');


            innerWrapper.appendChild(newIframe);
            addClass(this, 'hidden');
            removeClass(videoWrapper, 'hidden');
        };
    }

    // Band aid for keeping cover art updated until I migrate to new version of Amplitude
    function pollForSongArtChanges() {
        var metadataDiv = document.getElementsByClassName('player-meta-container')[0];
        music.songArtPoller = setInterval(function() {
            var metadata = Amplitude.getActiveSongMetadata();
            metadataDiv.style.backgroundImage = 'url('+metadata.cover_art_url+')';
        }, 1000);
    }

    function enableNoSleep() {
        console.log('Wake Lock Enabled');
        if (music.noSleep) {
            music.noSleep.disable();
        }
        music.noSleep = new NoSleep();
        music.noSleep.enable();
    }
};