var music = {
    songContainer   : 'amplitude-song-container',
    oldVideoUrl     : 'https://www.youtube.com/embed/w1t-Mevr9YM'
};

music.init = function() {
    Amplitude.init(amplitudeOptions);
    playlistSelect();
    deferVideoLoad();

    // Onclick for song containers
    document.querySelectorAll('.' + music.songContainer).forEach(function(e) {
        e.addEventListener('click', function() {
            console.log('clicked on a song!');
        });
    });

    function playlistSelect() {
        // Onclick for playlist options
        document.querySelectorAll('.playlist-option').forEach(function(e) {
            e.addEventListener('click', function(e) {
                togglePlaylist(e.target);
            });
        });
    }

    function togglePlaylist(element) {
        var type = element.getAttribute('data-type'),
            songsContainer = document.getElementById('songs'),
            loopsContainer = document.getElementById('loops');

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
    }

    function deferVideoLoad() {
        var oldVideoIfr = document.getElementById('old-music-video-ifr');
        setTimeout(function (){
            oldVideoIfr.src = music.oldVideoUrl
        }, 1500);
    }
};