const music = {
  oldVideoToggle: document.getElementById('old-video-toggle'),
  youTubePlaylistUrl: 'https://www.youtube.com/embed/videoseries?si=lnVlop3yU3cmYaNk&list=PLAtCvsbFyJ9bQAqn6DUD8pmGR0FPWKRtJ',
};

music.init = function() {
  const videoWrapper = document.querySelector('.outer-music-video-wrapper');
  const innerWrapper = document.querySelector('.music-video-wrapper');
  if (!music.oldVideoToggle || !videoWrapper || !innerWrapper) return;

  music.oldVideoToggle.addEventListener('click', function() {
    if (innerWrapper.querySelector('iframe')) return;

    const iframe = document.createElement('iframe');
    iframe.width = '560';
    iframe.height = '315';
    iframe.src = music.youTubePlaylistUrl;
    iframe.title = 'YouTube video player';
    iframe.frameBorder = '0';
    iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
    iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    iframe.allowFullscreen = true;

    innerWrapper.appendChild(iframe);
    addClass(this, 'hidden');
    removeClass(videoWrapper, 'hidden');
  });
};
