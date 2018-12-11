var portfolio = {
    'projectsPerPage'       : 0,
    'currentProjectIndex'   : 0,
    'colors'                : [
        ['purple', '#8c53c6'],
        ['pink', '#F2006D'],
        ['orange', '#FF724F'],
        //['green', '#8CFF8C'],
        ['blue', '#0079F2']
    ],
    'colorIndex'            : 0,
    'colorChangeInterval'  : 10000  // 10 seconds
};

portfolio.init = function() {
    portfolio.deferImages();
    portfolio.rotateColors();
};

portfolio.deferImages = function() {
    var imgDefer = document.getElementsByTagName('img');
    for (var i=0; i<imgDefer.length; i++) {
    if (imgDefer[i].getAttribute('data-src')) {
        imgDefer[i].setAttribute('src', imgDefer[i].getAttribute('data-src'));
        }
    }
};

portfolio.rotateColors = function() {
    var particlesCanvas = 'particles-js-canvas-el';

    shuffle(portfolio.colors);
    portfolio.changeColors();
    setInterval(function() {
        var particlesWrapper = document.getElementsByClassName(particlesCanvas)[0];
        particlesWrapper.addEventListener('animationend', fadeoutCallback);
        addClass(particlesWrapper, 'fade-out');
    }, portfolio.colorChangeInterval);

    function fadeoutCallback() {
        particlesTeardown();
        portfolio.changeColors();

        var particlesWrapper = document.getElementsByClassName(particlesCanvas)[0];
        particlesWrapper.removeEventListener('animationend', self);
        particlesWrapper.addEventListener('animationend', fadeinCallback);
        addClass(particlesWrapper, 'fade-in');
    }

    function fadeinCallback() {
        var particlesWrapper = document.getElementsByClassName(particlesCanvas)[0];
        particlesWrapper.removeEventListener('animationend', self);
        removeClass(particlesWrapper, 'fade-out');
        removeClass(particlesWrapper, 'fade-in');
    }

    function particlesTeardown() {
        window.pJSDom[0].pJS.fn.vendors.destroypJS();
        window["pJSDom"] = [];
    }
};

portfolio.chevronClick = function() {
    var bigChevron = document.getElementsByClassName('chevron-down')[0];
    bigChevron.onclick = function() {
        document.getElementById('first-project').scrollIntoView();
    }
};

portfolio.moreProjectsBtn = function() {
    var moreProjectsBtn = document.getElementById('more-projects-btn'),
        projectWrappers = document.getElementsByClassName('project-wrapper');

    moreProjectsBtn.addEventListener('click', function() {
        portfolio.currentProjectIndex += portfolio.projectsPerPage;
        for (var i=0; i<projectWrappers.length; i++) {
            var projectWrapper = projectWrappers[i],
                index = projectWrapper.getAttribute('data-index');

            if (index <= portfolio.currentProjectIndex && hasClass(projectWrapper, 'hidden')) {
                removeClass(projectWrapper, 'hidden');
            }
        }
    });
};

portfolio.changeColors = function() {
    var dynamicElements = document.getElementsByClassName('dynamic-color'),
        currentColor = portfolio.colors[portfolio.colorIndex];

    portfolio.colorIndex += 1;
    if (portfolio.colorIndex === portfolio.colors.length) {
        portfolio.colorIndex = 0;
    }

    for (var i=0; i<dynamicElements.length; i++) {
        var dynamicElement = dynamicElements[i];
        addNewColorClass(dynamicElement);
    }

    function addNewColorClass(el) {
        removeClass(el, currentColor[0]);
        addClass(el, portfolio.colors[portfolio.colorIndex][0]);
    }

    particlesInit(portfolio.colors[portfolio.colorIndex][1]);
};