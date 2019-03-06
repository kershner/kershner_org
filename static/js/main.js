var portfolio = {
    'initialLoad'           : true,
    'baseS3Url'             : '',
    'getProjectsURL'        : '',
    'projectsPerPage'       : 0,
    'projects'              : [],
    'colorIndex'            : 0,
    'colorChangeInterval'   : 10000,  // 10 seconds,
    'projectsWrapper'       : document.getElementsByClassName('projects-wrapper')[0],
    'projectWrappers'       : document.getElementsByClassName('project-wrapper'),
    'cubeGrid'              : document.getElementsByClassName('cube-grid')[0],
    'moreProjectsBtn'       : document.getElementById('more-projects-btn'),
    'imgAnimationClass'     : 'pop-up',
    'oldProjectsUrl'        : 'http://old.kershner.org/projects',
    'colors'                : [
        ['purple', '#8c53c6'],
        ['pink', '#F2006D'],
        ['orange', '#FF613A'],
        ['green', '#04E762'],
        ['blue', '#0079F2'],
        ['black', '#202020']
    ]
};

portfolio.init = function() {
    portfolio.deferImages();
    portfolio.rotateColors();
};

portfolio.loadProjectsOnScroll = function() {
    window.addEventListener('scroll', function(e) {
        if (portfolio.initialLoad) {
            portfolio.getProjectsFromServer();
        }

        if (!portfolio.initialLoad) {
            addClass(portfolio.cubeGrid, 'hidden');
        }
        if (!window.scrollY > (portfolio.cubeGrid.offsetTop + portfolio.cubeGrid.offsetHeight)) {
            removeClass(portfolio.cubeGrid, 'hidden');
        }
    });
};

portfolio.deferImages = function() {
    var images = document.getElementsByTagName('img');
    for (var i=0; i<images.length; i++) {
        if (images[i].getAttribute('data-src')) {
            images[i].setAttribute('src', images[i].getAttribute('data-src'));
        }
    }
    portfolio.removeImgAnimationClass();
};

portfolio.removeImgAnimationClass = function() {
    setTimeout(function() {
        var images = document.getElementsByTagName('img');
        for (var i=0; i<images.length; i++) {
            removeClass(images[i], portfolio.imgAnimationClass);
        }
    }, 1000);
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

portfolio.cubeClick = function() {
    portfolio.cubeGrid.onclick = function() {
        portfolio.projectsWrapper.scrollIntoView();
    }
};

portfolio.moreProjectsClickEvent = function() {
    portfolio.projectWrappers = document.getElementsByClassName('project-wrapper');
    portfolio.addProject(portfolio.projectWrappers.length);
};

portfolio.getProjectsFromServer = function() {
    fetch(portfolio.getProjectsURL, {
          method : 'get',
          credentials : 'same-origin'
    }).then(response => {
        return response.json();
    }).then(function(data) {
        portfolio.projects = data;
        portfolio.addProject(0);
        portfolio.initialLoad = false;
        addClass(portfolio.cubeGrid, 'hidden');
    });
};

portfolio.addProject = function(projectIndex) {
    var totalProjects = portfolio.projects.length,
        numProjectWrappers = portfolio.projectWrappers.length,
        project = portfolio.projects[projectIndex];

    removeClass(portfolio.moreProjectsBtn, 'hidden');

    if (numProjectWrappers < totalProjects) {
        portfolio.projectsWrapper.innerHTML += portfolio.getNewProjectHtml(project);
        portfolio.deferImages();
    }

    if (numProjectWrappers === totalProjects - 1) {
        portfolio.moreProjectsBtn.innerHTML = 'Older Projects';
        portfolio.moreProjectsBtn.removeEventListener('click', portfolio.moreProjectsClickEvent);
        portfolio.moreProjectsBtn.addEventListener('click', function() {
            window.open(portfolio.oldProjectsUrl, '_blank');
        });
        return false;
    }
};

portfolio.getNewProjectHtml = function(project) {
    var currentColor = portfolio.colors[portfolio.colorIndex][0],
        firstProjectId = project.fields.position === 1 ? 'first-project' : '',
        firstImgClass = project.fields.image_1 === '' ? 'hidden' : '',
        secondImgClass = project.fields.image_2 === '' ? 'hidden' : '',
        thirdImgClass = project.fields.image_3 === '' ? 'hidden' : '';

    var html =  `
                <div id="${firstProjectId}" class="project-wrapper ${project.fields.image_orientation}" data-position="${project.fields.position}">
                    <div class="left-content">
                        <div class="project-icon">
                            <img src="" class="${portfolio.imgAnimationClass}" data-src="${portfolio.baseS3Url}/${project.fields.icon}">
                        </div>

                        <div class="project-title">${project.fields.title}</div>
                        <div class="project-blurb">${project.fields.blurb}</div>

                        <hr align="left" class="dynamic-color ${currentColor}">

                        <div class="project-info"><div class="project-info-title">Technologies:</div>
                            <div class="project-info-value">${project.fields.technologies}</div>
                        </div>
                        `;

    var moreInfoHtml = `<div class="project-info">
                            <div class="project-info-title">More:</div>
                            <div class="project-info-value">${project.fields.extra_notes}</div>
                        </div>`;
    if (project.fields.extra_notes !== '') {
        html += moreInfoHtml;
    }

    html += `<a href="${project.fields.site_url}" target="_blank">
                <div class="project-link-btn dynamic-color ${currentColor}">Visit Site →</div>
            </a>
        </div>

        <div class="right-content">
            <div class="project-img-1 ${firstImgClass}"><img class="${portfolio.imgAnimationClass}" src="" data-src="${portfolio.baseS3Url}/${project.fields.image_1}"></div>
            <div class="project-img-2 ${secondImgClass}"><img class="${portfolio.imgAnimationClass}" src="" data-src="${portfolio.baseS3Url}/${project.fields.image_2}"></div>
            <div class="project-img-3 ${thirdImgClass}"><img class="${portfolio.imgAnimationClass}" src="" data-src="${portfolio.baseS3Url}/${project.fields.image_3}"></div>
        </div>
    </div>
    `;
    return html;
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