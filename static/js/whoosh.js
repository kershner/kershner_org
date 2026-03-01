const whoosh = {
    'whooshViewerUrl'       : '',
    'uploadFileSizeLimit'   : '',
    'colorTimer'            : undefined,
    'colorInterval'         : 15000
};

whoosh.init = function() {
    colorWave.selectors = ['.subtitle', '.header a'];
    colorWave.color = 'red';

    colorWave.init();

    whoosh.colorTimer = setInterval(function() {
        colorWave.init();
    }, whoosh.colorInterval);
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

    let originalFile = null;

    uploadForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        removeClass(uploadProgressDiv, 'hidden');
        document.body.style.overflow = 'hidden';

        try {
            const { url, key } = await fetch('/whoosh/upload-url/').then(r => r.json());

            const s3Response = await fetch(url, {
                method: 'PUT',
                body: originalFile,
            });

            if (!s3Response.ok) {
                const errorText = await s3Response.text();
                console.error('S3 error body:', errorText);
                throw new Error('S3 upload failed: ' + s3Response.status);
            }

            const keyInput = document.createElement('input');
            keyInput.type = 'hidden';
            keyInput.name = 's3_key';
            keyInput.value = key;
            uploadForm.appendChild(keyInput);
            
            sourceVideoInput.value = '';  // clear the file so it doesn't get posted
            uploadForm.submit();
        } catch (err) {
            console.error('Upload error:', err);
            addClass(uploadProgressDiv, 'hidden');
            document.body.style.overflow = '';
            alert('Upload failed: ' + err.message);
        }
    });

    sourceVideoInput.addEventListener('change', function(e) {
        originalFile = e.target.files[0];

        const fileSize = originalFile.size;
        const fileSizeLimit = whoosh.uploadFileSizeLimit * 1024 * 1024;
        if (fileSize > fileSizeLimit) {
            alert(`File too large! ${whoosh.uploadFileSizeLimit} Mb limit.`);
            location.reload();
        }

        const videoSrc = `${URL.createObjectURL(originalFile)}`;
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