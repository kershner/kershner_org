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
    'currentColor'          : ''
};

portfolio.init = function() {
    portfolio.currentColor = randomColor({luminosity: 'light'});

    portfolio.rotateColors();
    portfolio.scrollEvents();
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
    portfolio.changeColors();
    window.rotateColorsInterval = setInterval(() => {
        portfolio.changeColors();
    }, portfolio.colorChangeInterval);
};

portfolio.changeColors = function() {
    document.documentElement.style.setProperty('--dynamic-color', portfolio.currentColor);

    colorWave.color = portfolio.currentColor;
    colorWave.init();

    portfolio.currentColor = randomColor({luminosity: 'bright'});
};
