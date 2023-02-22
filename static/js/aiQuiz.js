const aiQuiz = {
    'aiQuizViewerUrl': '',
    'colorTimer': undefined,
    'colorInterval': 15000
};

aiQuiz.init = function () {
    aiQuiz.populateUserAgent();
    aiQuiz.revealAnswerOnclick();
    aiQuiz.colorWaveInit();
    aiQuiz.quizControls();
};

aiQuiz.quizControls = function () {
    let quizControls = document.querySelector('.quiz-controls').querySelectorAll('button');
    quizControls.forEach(element => {
        element.addEventListener('click', event => {
            let buttonId = element.getAttribute('id');
            let quizControlDivs = document.querySelectorAll('.quiz-control-widget');
            let closeWidget = false;

            // If target is already active, close the widget
            if (hasClass(event.target, 'active')) {
                closeWidget = true;
            }

            quizControlDivs.forEach(element => {
                addClass(element, 'hidden');

                if (!closeWidget) {
                    if (hasClass(element, buttonId)) {
                        removeClass(element, 'hidden');
                    }
                }
            });

            quizControls.forEach(element => {
                removeClass(element, 'active');

                if (!closeWidget) {
                    if (event.target === element) {
                        addClass(element, 'active');
                    }
                }
            });
        });
    });
};

aiQuiz.colorWaveInit = function () {
    colorWave.selectors = ['.title'];
    colorWave.color = randomColor({luminosity: 'light'});
    colorWave.init();

    aiQuiz.colorTimer = setInterval(function () {
        colorWave.color = randomColor({luminosity: 'light'});
        colorWave.init();
    }, aiQuiz.colorInterval);
};

aiQuiz.populateUserAgent = function () {
    const userAgentInput = document.getElementById('id_user_agent');
    if (userAgentInput) {
        userAgentInput.value = window.navigator.userAgent;
    }
};

aiQuiz.checkQuizProcessed = function () {
    window.checQuizProcessedTimer = setInterval(function () {
        const headers = {
            'X-CSRFToken': getCookie('csrftoken')
        };
        fetchWrapper(aiQuiz.aiQuizViewerUrl, 'post', {}, headers, function (data) {
            if (data['processed'] || data['error']) {
                location.reload();
            }
        });
    }, 3000);
};

aiQuiz.revealAnswerOnclick = function () {
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
