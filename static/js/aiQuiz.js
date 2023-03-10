const aiQuiz = {
    'aiQuizViewerUrl': '',
    'aiQuizListUrl': '',
    'randomSubjectsUrl': '',
    'colorTimer': undefined,
    'colorInterval': 15000,
    'randomSuggestionInterval': 5000,
    'checkProcessedInterval': 4000,
    'randomSubjectsInterval': 10000,
    'subjectInput': document.querySelector('input[name="subject"]'),
    'form': false,
    'uniqueSubjects': [],
    'showModal': false,
    'maxRandomSubjects': 10,
    'randomQuizTimer': undefined
};

aiQuiz.init = function () {
    aiQuiz.populateUserAgent();
    aiQuiz.revealAnswerOnclick();
    aiQuiz.colorWaveInit();
    aiQuiz.copyToClipboard();
    aiQuiz.colorEffects();
    aiQuiz.hoverEffects();
    aiQuiz.randomSubjects();
    aiQuiz.openSubmitModal();
    if (aiQuiz.form) {
        aiQuiz.randomSuggestions();
        aiQuiz.sizeSubjectInputToValue();
    }
};

aiQuiz.openSubmitModal = function () {
    let form = document.querySelector('#quiz-form');
    let quizModal = document.querySelector('.quiz-modal');
    let closeBtn = document.querySelector('#close-modal');

    form.addEventListener('submit', (e) => {
        if (aiQuiz.showModal) {
            e.preventDefault();
            removeClass(quizModal, 'hidden');
            aiQuiz.colorWaveInit();
        }
    });

    closeBtn.addEventListener('click', e => {
        e.preventDefault();
        addClass(quizModal, 'hidden');
    });
};

aiQuiz.colorRandomQuiz = function() {
    let quizElements = document.querySelectorAll('.quiz');
    const randomIndex = Math.floor(Math.random() * quizElements.length);
    const randomElement = quizElements[randomIndex];
    const intervalTimer = 600;
    const fadeTimer = 1000;

    if (!randomElement) {
        return;
    }

    randomElement.style.backgroundColor = randomColor({luminosity: 'light'});
    addClass(randomElement, 'active');

    setTimeout(function () {
        removeClass(randomElement, 'active');
        randomElement.style.backgroundColor = '';
    }, fadeTimer);

    aiQuiz.randomQuizTimer = setTimeout(() => {
        aiQuiz.colorRandomQuiz();
    }, intervalTimer);
};

aiQuiz.colorEffects = function () {
    // Add transition in JS so there isn't an animation when first loading the page (looks weird)
    const style = document.createElement('style');
    style.innerHTML = 'a {transition: color 0.3s ease-in-out}';
    style.innerHTML += '.quiz {transition: background-color 0.3s ease-in-out}';
    document.head.appendChild(style);

    function colorQuizLinks() {
        let quizLinks = document.querySelectorAll('.quiz-link');
        if (!quizLinks.length || quizLinks.length < 6) {
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
    aiQuiz.colorRandomQuiz();
};

aiQuiz.randomSubjects = function () {
    let randomSubjectsDiv = document.querySelector('.random-subjects');
    if (!randomSubjectsDiv) {
        return;
    }

    let quizWrappers = randomSubjectsDiv.querySelector('.quiz-widget-wrapper-inner');

    function populateRandomSubjects() {
        shuffle(aiQuiz.uniqueSubjects);
        let subjects = aiQuiz.uniqueSubjects.slice(0, aiQuiz.maxRandomSubjects);
        quizWrappers.innerHTML = '';
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

            quizWrappers.appendChild(anchorElement);
            setTimeout(() => {
                anchorElement.style.opacity = 1;
            }, index * 100);
        });

        aiQuiz.hoverEffects();
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
            copyToClipboardBtn.classList.remove('active');
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

aiQuiz.colorWaveInit = function () {
    colorWave.selectors = ['.title'];
    colorWave.color = randomColor({luminosity: 'light'});
    colorWave.init();

    clearInterval(aiQuiz.colorTimer);
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
