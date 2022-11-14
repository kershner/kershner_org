const whoosh = {
    'whooshViewerUrl': '',
    'uploadFileSizeLimit': '',
    'colorTimer': undefined,
    'colorInterval': 15000
};

whoosh.init = function() {
    whoosh.colorInit();
};

whoosh.colorInit = function() {
    const header = document.querySelector('.header a');
    let headerText = header.innerHTML.trim().split('');
    let html = '';
    for (let i=0; i<headerText.length; i++) {
        html += `<span class="wave">${headerText[i]}</span>`;
    }
    header.innerHTML = html;

    let colorElements = document.querySelectorAll('.wave');
    whoosh.colorElements(colorElements);
    whoosh.colorTimer = setInterval(function() {
        whoosh.colorElements(colorElements);
    }, whoosh.colorInterval);
};

whoosh.colorElements = function(elements) {
    let timerPointer = 0.0;
    let increment = 100;
    for (let i=0; i<elements.length; i++) {
        let colorElement = elements[i];
        colorElement.addEventListener('transitionend', () => {
            removeClass(colorElement, 'red');
        });

        removeClass(colorElement, 'red');
        setTimeout(function() {
            addClass(colorElement, 'red');
        }, timerPointer);
        timerPointer += increment;
    }
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
    const submitWrapper = document.querySelector('.submit-wrapper');

    uploadForm.addEventListener('submit', function(e) {
        removeClass(uploadProgressDiv, 'hidden');
        document.body.style.overflow = 'hidden';
    });

    sourceVideoInput.addEventListener('change', function(e) {
        const fileSize = e.target.files[0].size;
        const fileSizeLimit = whoosh.uploadFileSizeLimit * 1024 * 1024;
        if (fileSize > fileSizeLimit) {
            alert(`File too large! ${whoosh.uploadFileSizeLimit} Mb limit.`);
            location.reload();
        }

        const videoSrc = `${URL.createObjectURL(e.target.files[0])}`;
        uploadPreview.setAttribute('src', videoSrc);
        
        removeClass(uploadPreviewWrapper, 'hidden');
        removeClass(extraOptions, 'disabled');
        removeClass(submitWrapper, 'hidden');

        uploadPreview.addEventListener('timeupdate', function(e) {
            startTimeInput.value = new Date(Number(uploadPreview.currentTime * 1000)).toISOString().substring(11, 19);
        });
    });
};

whoosh.toggleDoppelgangerForm = function() {
    const doppelgangerBtn = document.getElementById('doppelganger-btn');
    const doppelgangerForm = document.getElementById('doppelganger-form');
        if (doppelgangerBtn) {
            doppelgangerBtn.addEventListener('click', function() {
            if (hasClass(doppelgangerForm, 'hidden')) {
                addClass(doppelgangerBtn, 'active');
                removeClass(doppelgangerForm, 'hidden');
            } else {
                removeClass(doppelgangerBtn, 'active');
                addClass(doppelgangerForm, 'hidden');
            }
        });
    }
};
