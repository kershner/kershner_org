let whoosh = {
    'whooshViewerUrl': ''
};

whoosh.populateUserAgent = function() {
    let userAgentInput = document.getElementById('id_user_agent');
    userAgentInput.value = window.navigator.userAgent;
};

whoosh.checkWhooshProcessed = function() {
    window.checkWhooshProcessedTimer = setInterval(function() {
        let headers = {
            'X-CSRFToken': getCookie('csrftoken')
        };
        fetchWrapper(whoosh.whooshViewerUrl, 'post', {}, headers, function(data) {
            if (data['processed']) {
                location.reload();
            }
        });
    }, 3000);
};

whoosh.uploadEditor = function() {
    let uploadForm = document.getElementsByTagName('form')[0];
    let uploadProgressDiv = document.getElementsByClassName('upload-in-progress')[0];
    let sourceVideoInput = document.getElementById('id_source_video');
    let uploadPreview = document.getElementById('upload-preview');
    let uploadPreviewWrapper = document.querySelector('.upload-preview');
    let startTimeInput = document.getElementById('id_start_time');

    uploadForm.addEventListener('submit', function(e) {
        removeClass(uploadProgressDiv, 'hidden');
    });

    sourceVideoInput.addEventListener('change', function(e) {
        uploadPreview.setAttribute('src', URL.createObjectURL(e.target.files[0]));
        removeClass(uploadPreviewWrapper, 'hidden');

        uploadPreview.addEventListener('timeupdate', function(e) {
            startTimeInput.value = new Date(Number(uploadPreview.currentTime * 1000)).toISOString().substring(11, 19);
        });
    });
};