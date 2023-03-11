var portfolio = {
    'initialLoad'           : true,
    'baseS3Url'             : '',
    'projectsPerPage'       : 0,
    'projectsHtml'          : [],
    'colorChangeInterval'   : 10000,  // 10 seconds,
    'projectsWrapper'       : document.getElementsByClassName('projects-wrapper')[0],
    'projectWrappers'       : document.getElementsByClassName('project-wrapper'),
    'bigName'               : document.getElementsByClassName('big-name')[0],
    'bigCallToAction'       : document.getElementsByClassName('big-call-to-action')[0],
    'cubeGrid'              : document.getElementsByClassName('cube-grid')[0],
    'moreProjectsBtn'       : document.getElementById('more-projects-btn'),
    'darkModeClass'         : 'dark-mode',
    'currentColor'          : ''
};

portfolio.init = function() {
    portfolio.currentColor = randomColor({luminosity: 'light'});

    portfolio.rotateColors();
    portfolio.scrollEvents();
    portfolio.themeToggle();
};

portfolio.scrollEvents = function() {
    window.addEventListener('scroll', function(e) {
        addClass(portfolio.cubeGrid, 'hidden');
        if (!window.scrollY > (portfolio.cubeGrid.offsetTop + portfolio.cubeGrid.offsetHeight)) {
            removeClass(portfolio.cubeGrid, 'hidden');
        }

        if (portfolio.initialLoad) {
            portfolio.addProjects(0);
            portfolio.initialLoad = false;
        }
    });
};

portfolio.cubeClick = function() {
    portfolio.cubeGrid.onclick = function() {
        portfolio.projectsWrapper.scrollIntoView();
    }
};

portfolio.moreProjectsClickEvent = function() {
    portfolio.projectWrappers = document.getElementsByClassName('project-wrapper');
    portfolio.addProjects(portfolio.projectWrappers.length);
};

portfolio.addProjects = function(startingIndex) {
    let indexToAdd = startingIndex;

    for (let i=0; i<portfolio.projectsPerPage; i++) {
        portfolio.addProject(indexToAdd);
        indexToAdd += 1;
    }

    // hit em with the colorwave on the first page
    if (indexToAdd === portfolio.projectsPerPage) {
        colorWave.init();
    }
};

portfolio.addProject = function(projectIndex) {
    var totalProjects = portfolio.projectsHtml.length,
        numProjectWrappers = portfolio.projectWrappers.length;

    removeClass(portfolio.moreProjectsBtn, 'hidden');

    if (numProjectWrappers < totalProjects) {
        let tempDiv = document.createElement('div');
        tempDiv.innerHTML = portfolio.projectsHtml[projectIndex];
        portfolio.projectsWrapper.insertAdjacentHTML('beforeend', tempDiv.innerHTML);
    }

    if (numProjectWrappers === totalProjects - 1) {
        portfolio.moreProjectsBtn.style.display = 'none';
    }
};

portfolio.rotateColors = function() {
    let particlesCanvas = 'particles-js-canvas-el';

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
        window['pJSDom'] = [];
    }
};

portfolio.changeColors = function() {
    document.documentElement.style.setProperty('--dynamic-color', portfolio.currentColor);

    particlesInit(portfolio.currentColor);

    colorWave.color = portfolio.currentColor;
    colorWave.init();

    portfolio.currentColor = randomColor({luminosity: 'bright'});
};

portfolio.themeToggle = function() {
    let toggle = document.getElementsByClassName('theme-switch')[0];
    toggle.addEventListener('click', function() {
        let currentTheme = '';
        if (hasClass(toggle, 'active')) {
            removeClass(toggle, 'active');
            removeClass(document.body, portfolio.darkModeClass);
        } else {
            addClass(toggle, 'active');
            addClass(document.body, portfolio.darkModeClass);
            currentTheme = 'dark-mode'
        }

        const headers = {
            'X-CSRFToken': getCookie('csrftoken')
        };
        fetchWrapper(portfolio.updateThemeUrl, 'post', {'theme': currentTheme}, headers, function(data) {
            if (data['processed'] || data['error']) {
                location.reload();
            }
        });
    });
};
