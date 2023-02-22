const aiQuiz = {
    'aiQuizViewerUrl'   : '',
    'colorTimer'        : undefined,
    'colorInterval'     : 15000
};

aiQuiz.init = function() {
    aiQuiz.populateUserAgent();
    aiQuiz.revealAnswerOnclick();

    colorWave.selectors = ['.title'];
    colorWave.color = randomColor({luminosity: 'light'});
    colorWave.init();

    aiQuiz.colorTimer = setInterval(function() {
        colorWave.color = randomColor({luminosity: 'light'});
        colorWave.init();
    }, aiQuiz.colorInterval);
};

aiQuiz.populateUserAgent = function() {
    const userAgentInput = document.getElementById('id_user_agent');
    if (userAgentInput) {
        userAgentInput.value = window.navigator.userAgent;
    }
};

aiQuiz.checkQuizProcessed = function() {
    window.checQuizProcessedTimer = setInterval(function() {
        const headers = {
            'X-CSRFToken': getCookie('csrftoken')
        };
        fetchWrapper(aiQuiz.aiQuizViewerUrl, 'post', {}, headers, function(data) {
            if (data['processed'] || data['error']) {
                location.reload();
            }
        });
    }, 3000);
};

aiQuiz.revealAnswerOnclick = function() {
    let obscuredClass = 'obscured';
    let answers = document.querySelectorAll(`.${obscuredClass}`);
    answers.forEach(element => {
      element.addEventListener('click', event => {
        const parentElement = event.target.closest(`.${obscuredClass}`);
        parentElement.removeAttribute('title');
        removeClass(parentElement, obscuredClass)
      });
    });
};
