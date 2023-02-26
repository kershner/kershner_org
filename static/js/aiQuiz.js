const aiQuiz = {
    'aiQuizViewerUrl': '',
    'aiQuizListUrl': '',
    'randomSubjectsUrl': '',
    'colorTimer': undefined,
    'colorInterval': 15000,
    'randomSuggestionInterval': 5000,
    'checkProcessedInterval': 4000,
    'randomSubjectsInterval': 7000,
    'subjectInput': document.querySelector('input[name="subject"]'),
    'form': false
};

aiQuiz.init = function () {
    aiQuiz.populateUserAgent();
    aiQuiz.revealAnswerOnclick();
    aiQuiz.colorWaveInit();
    aiQuiz.quizControls();
    aiQuiz.copyToClipboard();
    aiQuiz.colorEffects();
    aiQuiz.hoverEffects();
    aiQuiz.randomSubjects();
    if (aiQuiz.form) {
        aiQuiz.randomSuggestions();
        aiQuiz.sizeSubjectInputToValue();
    }
};

aiQuiz.colorEffects = function () {
    let quizElements = document.querySelectorAll('.quiz');

    function colorRandomQuiz() {
        const randomIndex = Math.floor(Math.random() * quizElements.length);
        const randomElement = quizElements[randomIndex];
        const intervalTimer = 400;
        const fadeTimer = 1000;

        randomElement.style.backgroundColor = randomColor({luminosity: 'light'});
        addClass(randomElement, 'active');

        setTimeout(function () {
            removeClass(randomElement, 'active');
            randomElement.style.backgroundColor = '';
        }, fadeTimer);

        setTimeout(() => {
            colorRandomQuiz();
        }, intervalTimer);
    }

    // Add transition in JS so there isn't an animation when first loading the page (looks weird)
    const style = document.createElement('style');
    style.innerHTML = 'a {transition: color 0.3s ease-in-out}';
    style.innerHTML += '.quiz {transition: background-color 0.3s ease-in-out}';
    document.head.appendChild(style);

    function colorQuizLinks() {
        let quizLinks = document.querySelectorAll('.quiz-link');
        if (!quizLinks.length) {
            return;
        }

        let i = 0;
        let l = 0;
        let waveIntervalSeconds = 100;
        let loopInterval = 8000;

        const colorLinks = setInterval(() => {
            quizLinks[i].style.color = randomColor({luminosity: 'light'});
            i++;
            if (i >= quizLinks.length) {
                clearInterval(colorLinks);

                const revertLinks = setInterval(() => {
                quizLinks[l].style.color = '';
                l++;
                if (l >= quizLinks.length) {
                    clearInterval(revertLinks);

                    setTimeout(() => {
                        colorQuizLinks();
                    }, loopInterval);
                }
            }, waveIntervalSeconds);
        }
    }, waveIntervalSeconds);
    }

    colorQuizLinks();
    colorRandomQuiz();
};

aiQuiz.randomSubjects = function () {
    let randomSubjectsDiv = document.querySelector('.random-subjects').querySelector('.quiz-widget-wrapper-inner');

    function populateRandomSubjects() {
        fetchWrapper(aiQuiz.randomSubjectsUrl, 'get', {}, {}, function (data) {
            let subjects = data['subjects'];
            randomSubjectsDiv.innerHTML = '';

            subjects.forEach((subject, index) => {
                const anchorElement = document.createElement('a');
                anchorElement.classList.add('quiz-wrapper');
                anchorElement.title = `View quizzes about ${subject}`;
                anchorElement.setAttribute('href', `${aiQuiz.aiQuizListUrl}?subject_query=${subject}`);
                anchorElement.style.opacity = 0;
                anchorElement.innerHTML = `
                <div class="quiz">
                    <div class="quiz-subject">${subject}</div>
                </div>`;

                randomSubjectsDiv.appendChild(anchorElement);
                setTimeout(() => {
                    anchorElement.style.opacity = 1;
                }, index * 100);
            });

            aiQuiz.hoverEffects();
        });
    }

    populateRandomSubjects();
    setInterval(() => {
        populateRandomSubjects();
    }, aiQuiz.randomSubjectsInterval);
};

aiQuiz.hoverEffects = function () {
    let hoverElements = document.querySelectorAll('.quiz, button, a');
    hoverElements.forEach(function (element) {
        element.addEventListener('mouseenter', function () {
            let color = randomColor({luminosity: 'light'});
            if (element.tagName === 'A') {
                element.style.color = color;
            } else {
                element.style.backgroundColor = color;
            }
        });
        element.addEventListener('mouseleave', function () {
            if (element.tagName === 'A') {
                element.style.color = '';
            } else {
                element.style.backgroundColor = '';
            }
        });
    });
};

aiQuiz.copyToClipboard = function () {
    let copyToClipboardBtn = document.querySelector('#copy-to-clipboard');
    if (!copyToClipboardBtn) {
        return;
    }
    let existingText = copyToClipboardBtn.innerHTML;
    copyToClipboardBtn.addEventListener('click', event => {
        navigator.clipboard.writeText(window.location.href);
        copyToClipboardBtn.innerHTML = 'Copied!';
        setTimeout(function () {
            copyToClipboardBtn.innerHTML = existingText;
        }, 5000);
    });
};

aiQuiz.sizeSubjectInputToValue = function () {
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

aiQuiz.randomSuggestions = function () {
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
    setInterval(function () {
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
