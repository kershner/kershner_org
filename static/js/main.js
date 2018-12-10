var portfolio = {
    'projectsPerPage'       : 0,
    'currentProjectIndex'   : 0
};

portfolio.init = function() {
    portfolio.deferImages();
};

portfolio.deferImages = function() {
    var imgDefer = document.getElementsByTagName('img');
    for (var i=0; i<imgDefer.length; i++) {
    if (imgDefer[i].getAttribute('data-src')) {
        imgDefer[i].setAttribute('src', imgDefer[i].getAttribute('data-src'));
        }
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