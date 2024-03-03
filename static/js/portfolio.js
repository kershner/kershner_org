var portfolio = {
    'initialLoad'           : true,
    'baseS3Url'             : '',
    'projectsPerPage'       : 0,
    'projectsHtml'          : [],
    'colorChangeInterval'   : 10000,  // 10 seconds,
    'projectsWrapper'       : document.getElementsByClassName('projects-wrapper')[0],
    'projectWrappers'       : document.getElementsByClassName('project-wrapper'),
    'moreProjectsBtn'       : document.getElementById('more-projects-btn'),
    'footer'                : document.querySelector('.footer'),
    'projectsLink'          : document.querySelector('a[title="Projects"]'),
    'currentColor'          : ''
};

portfolio.init = function() {
    portfolio.currentColor = randomColor({luminosity: 'light'});
    portfolio.rotateColors();
    portfolio.scrollEvents();
    addClass(portfolio.footer, 'fixed');
};

const projectsClickHandler = (e) => {
    e.preventDefault();
    window.scrollBy(0, 1);
    setTimeout(_ => {
        portfolio.projectsWrapper.scrollIntoView({block: 'start'});
    }, 20);
}

const updateFooterOnScroll = () => {
    const isAtTop = window.scrollY === 0;
    portfolio.footer.classList.toggle('fixed', isAtTop);
    
    portfolio.projectsLink.removeEventListener('click', projectsClickHandler);
    if (isAtTop) {
        portfolio.projectsLink.addEventListener('click', projectsClickHandler);
    }
}

portfolio.scrollEvents = function() {
    updateFooterOnScroll();

    window.addEventListener('scroll', function(e) {
        updateFooterOnScroll();
        
        if (portfolio.initialLoad) {
            portfolio.addProjects(0);
            portfolio.initialLoad = false;
        }
    });
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
