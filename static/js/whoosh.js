const whoosh = {
    'whooshViewerUrl': ''
};

whoosh.populateUserAgent = function() {
    const userAgentInput = document.getElementById('id_user_agent');
    userAgentInput.value = window.navigator.userAgent;
};

whoosh.checkWhooshProcessed = function() {
    window.checkWhooshProcessedTimer = setInterval(function() {
        const headers = {
            'X-CSRFToken': getCookie('csrftoken')
        };
        fetchWrapper(whoosh.whooshViewerUrl, 'post', {}, headers, function(data) {
            if (data['processed'] || data['error']) {
                location.reload();
            }
        });
    }, 3000);
};

whoosh.uploadEditor = function() {
    const uploadForm = document.getElementsByTagName('form')[0];
    const uploadProgressDiv = document.getElementsByClassName('upload-in-progress')[0];
    const sourceVideoInput = document.getElementById('id_source_video');
    const uploadPreview = document.getElementById('upload-preview');
    const uploadPreviewWrapper = document.querySelector('.upload-preview');
    const startTimeInput = document.getElementById('id_start_time');
    const extraOptions = document.querySelector('.extra-options');
    const submitBtn = document.querySelector('input[value="Submit"]');

    uploadForm.addEventListener('submit', function(e) {
        removeClass(uploadProgressDiv, 'hidden');
    });

    sourceVideoInput.addEventListener('change', function(e) {
        const videoSrc = `${URL.createObjectURL(e.target.files[0])}`;

        uploadPreview.setAttribute('src', videoSrc);
        
        removeClass(uploadPreviewWrapper, 'hidden');
        removeClass(extraOptions, 'disabled');
        removeClass(submitBtn, 'hidden');

        uploadPreview.addEventListener('timeupdate', function(e) {
            startTimeInput.value = new Date(Number(uploadPreview.currentTime * 1000)).toISOString().substring(11, 19);
        });
    });
};


whoosh.toggleDoppelgangerForm = function() {
    const doppelgangerBtn = document.getElementById('doppelganger-btn');
    const doppelgangerForm = document.getElementById('doppelganger-form');
    doppelgangerBtn.addEventListener('click', function() {
        if (hasClass(doppelgangerForm, 'hidden')) {
            addClass(doppelgangerBtn, 'active');
            removeClass(doppelgangerForm, 'hidden');
        } else {
            removeClass(doppelgangerBtn, 'active');
            addClass(doppelgangerForm, 'hidden');
        }
    });
};