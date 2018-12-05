var music = {
    songContainer   : 'amplitude-song-container',
    'oldVideoUrl'   : 'https://www.youtube.com/embed/w1t-Mevr9YM'
};

music.init = function() {
    Amplitude.init(amplitudeOptions);
    deferVideoLoad();


    // Onclick for song containers
    document.querySelectorAll('.' + music.songContainer).forEach(function(e) {
        e.addEventListener('click', function() {
            console.log('clicked!');
        });
    });

    function deferVideoLoad() {
        var oldVideoIfr = document.getElementById('old-music-video-ifr');
        setTimeout(function (){
            oldVideoIfr.src = music.oldVideoUrl
        }, 1500);
    }
};