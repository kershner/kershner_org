const music = {
    oldVideoToggle      : document.getElementById('old-video-toggle'),
    youTubePlaylistUrl  : 'https://www.youtube.com/embed/videoseries?list=PLAtCvsbFyJ9bQAqn6DUD8pmGR0FPWKRtJ',
    songArtPoller       : undefined,
};

music.init = function() {
    deferVideoLoad();

    function deferVideoLoad() {
        let videoWrapper = document.getElementsByClassName('outer-music-video-wrapper')[0];
        let innerWrapper = document.getElementsByClassName('music-video-wrapper')[0];

        music.oldVideoToggle.onclick = function() {
            let newIframe = document.createElement('iframe');
            newIframe.setAttribute('src', music.youTubePlaylistUrl);
            newIframe.setAttribute('allowfullscreen', '');
            newIframe.setAttribute('frameborder', '0');

            innerWrapper.appendChild(newIframe);
            addClass(this, 'hidden');
            removeClass(videoWrapper, 'hidden');
        };
    }
};