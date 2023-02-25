const aiQuiz = {
    'aiQuizViewerUrl': '',
    'colorTimer': undefined,
    'colorInterval': 15000,
    'randomSuggestionInterval': 5000,
    'checkProcessedInterval': 4000,
    'subjectInput': document.querySelector('input[name="subject"]'),
    'form': false
};

aiQuiz.init = function () {
    aiQuiz.populateUserAgent();
    aiQuiz.revealAnswerOnclick();
    aiQuiz.colorWaveInit();
    aiQuiz.quizControls();
    aiQuiz.copyToClipboard();
    aiQuiz.hoverEffects();
    if (aiQuiz.form) {
        aiQuiz.randomSuggestions();
        aiQuiz.sizeSubjectInputToValue();
    }
};

aiQuiz.hoverEffects = function() {
    let hoverElements = document.querySelectorAll('.quiz, button, a');
    hoverElements.forEach(function(element) {
        element.addEventListener('mouseenter', function() {
            let color = randomColor({luminosity: 'light'});
            if (element.tagName === 'A') {
                element.style.color = color;
            } else {
                element.style.backgroundColor = color;
            }
        });
        element.addEventListener('mouseleave', function() {
            if (element.tagName === 'A') {
                element.style.color = '';
            } else {
                element.style.backgroundColor = '';
            }
        });
    });
};

aiQuiz.copyToClipboard = function() {
    let copyToClipboardBtn = document.querySelector('#copy-to-clipboard');
    if (!copyToClipboardBtn) {
        return;
    }
    let existingText = copyToClipboardBtn.innerHTML;
    copyToClipboardBtn.addEventListener('click', event => {
        navigator.clipboard.writeText(window.location.href);
        copyToClipboardBtn.innerHTML = 'Copied!';
        setTimeout(function() {
            copyToClipboardBtn.innerHTML = existingText;
        }, 5000);
    });
};

aiQuiz.sizeSubjectInputToValue = function() {
    setWidthToValue(aiQuiz.subjectInput);
    aiQuiz.subjectInput.addEventListener('input', event => {
        setWidthToValue(aiQuiz.subjectInput);
    });

    function setWidthToValue(element) {
        let newWidth = '17rem';
        if (element.value.length) {
            let newWidthValue = element.value.length - 3;
            if (newWidthValue >= 15) {
                newWidth = `${((element.value.length - 3))}ch`;
            }
        }
        element.style.width = newWidth;
    }
};

aiQuiz.randomSuggestions = function() {
    const quizSuggestions = [
        'Chewing gum', 'flags', 'keyboards', 'Famous bridges', 'Cloud types', 'Hip hop fashion',
        'Deadly diseases', 'dinosaurs', 'Whale traits', 'Famous mimes', 'Pasta types', 'Maritime disasters',
        'Martial arts history', 'cartoons', 'Sandwich history', 'Dangerous insects', 'Sharks', 'Trees', 'Horses',
        'Bicycle history', 'Fruits', 'Cheeses', 'Typewriters', 'Birds', 'Mushrooms', 'Gemstones', 'Unusual museums',
        'Venomous snakes', 'Hot air balloons'
    ];

    let quizSuggestionsCopy = shuffle(quizSuggestions.slice());

    function randomSuggestion() {
        let suggestion = quizSuggestionsCopy.pop();
        typeWriter(aiQuiz.subjectInput, suggestion);

        if (quizSuggestionsCopy.length === 0) {
            quizSuggestionsCopy = shuffle(quizSuggestions.slice());
        }
    }

    function typeWriter(input, text) {
        if (typeof(text) === 'undefined') {
            return
        }
        const textArray = text.split('');
        input.placeholder = '';
        textArray.forEach((letter, i) =>
            setTimeout(() => (input.placeholder += letter), 95 * i)
        );
        setInterval(() => typeWriter(input), 8000);
    }

    randomSuggestion();
    setInterval(function() {
        randomSuggestion();
    }, aiQuiz.randomSuggestionInterval);
};

aiQuiz.quizControls = function () {
    let quizControls = document.querySelector('.quiz-controls');
    if (!quizControls) {
        return false;
    }

    let buttons = quizControls.querySelectorAll('button');
    buttons.forEach(element => {
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

            buttons.forEach(element => {
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
    }, aiQuiz.checkProcessedInterval);
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
