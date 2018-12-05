var music = {
    songContainer : 'amplitude-song-container'
};

music.init = function() {
    console.log('music!');

    // Onclick for song containers
    document.querySelectorAll('.' + music.songContainer).forEach(function(e) {
        e.addEventListener('click', function() {
            console.log('clicked!');
        });
    });
};