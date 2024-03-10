let portfolio = {
    'projectsPerPage'       : 0,
    'projectsHtml'          : [],
    'filteredProjects'      : [],
    'colorChangeInterval'   : 10000,  // 10 seconds,
    'stickyNav'             : document.querySelector('.sticky-nav'),
    'projectsWrapper'       : document.querySelector('.projects-wrapper'),
    'projectWrappers'       : document.getElementsByClassName('project-wrapper'),
    'moreProjectsBtn'       : document.getElementById('more-projects-btn'),
    'footer'                : document.querySelector('.footer'),
    'projectsLink'          : document.querySelector('a[title="Projects"]'),
    'styleToggles'          : document.querySelectorAll('input[name="projectStyle"'),
    'projectSearch'         : document.getElementById('projectSearch'),
    'suggestionsDiv'        : document.querySelector('.suggestions'),
    'clearFiltersBtn'       : document.querySelector('.clearFiltersBtn'),
    'currentColor'          : '',
    'debouceTimeout'        : undefined
};

portfolio.init = function() {
    portfolio.currentColor = randomColor({luminosity: 'light'});
    portfolio.rotateColors();
    portfolio.projectStyleToggles();
    portfolio.projectFilter();
    portfolio.searchSuggestions();
    portfolio.stickyNav.querySelector('.sticky-nav-title').addEventListener('click', (e) => {
        window.scrollTo(0, 0);
    });

    portfolio.filteredProjects = portfolio.projectsHtml;
    portfolio.addProjectHtml();
};

portfolio.addProjectHtml = function () {
    const combinedProjectsHtml = portfolio.filteredProjects.map(html => html).join('');
    portfolio.projectsWrapper.innerHTML = combinedProjectsHtml;

    portfolio.projectsWrapper.style.opacity = 0;
    portfolio.projectsWrapper.offsetHeight;
    portfolio.projectsWrapper.style.transition = 'opacity 0.2s ease-in-out';
    portfolio.projectsWrapper.style.opacity = 1;
    setTimeout(() => {
        portfolio.projectsWrapper.style.transition = '';
    }, 200);
}

portfolio.projectFilter = function() {
    portfolio.projectSearch.addEventListener('input', inputHandler);
    portfolio.projectSearch.addEventListener('change', inputHandler);

    portfolio.projectSearch.addEventListener('focus', (e) => {
        portfolio.projectSearch.classList.add('suggestions-active');
        showHideSuggestions('show');
    });

    portfolio.projectSearch.addEventListener('blur', (e) => {
        setTimeout(() => {
            portfolio.projectSearch.classList.remove('suggestions-active');
        }, 100);
    });

    const handleKeyEvent = (e) => {
        if (e.keyCode === 13 || e.key === 'Enter') {
            portfolio.projectSearch.classList.remove('suggestions-active');
            showHideSuggestions('hide');
        }
    }
    portfolio.projectSearch.addEventListener('keydown', handleKeyEvent);
    portfolio.projectSearch.addEventListener('keypress', handleKeyEvent);
    
    document.addEventListener('click', (event) => {
        if (!portfolio.projectSearch.contains(event.target)) {
            showHideSuggestions('hide');
        }
    });

    portfolio.clearFiltersBtn.addEventListener('click', (e) => {
        portfolio.projectSearch.value = '';
        portfolio.filteredProjects = portfolio.projectsHtml;
        portfolio.addProjectHtml();
    });
}

portfolio.searchSuggestions = function() {
    const suggestionFocusHandler = (e) => {
        portfolio.projectSearch.value = e.target.textContent;
        portfolio.projectSearch.dispatchEvent(new Event('input'));
    }

    portfolio.suggestionsDiv.querySelectorAll('li').forEach((li) => {
        li.addEventListener('click', suggestionFocusHandler);
        li.addEventListener('focus', suggestionFocusHandler);
    });
}

portfolio.projectStyleToggles = function() {
    portfolio.styleToggles.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const newValue = e.target.value;
            portfolio.projectsWrapper.classList.remove('grid', 'list');
            portfolio.projectsWrapper.classList.add(newValue);
            setQueryParam('projectStyle', newValue);
            updateLinksWithQueryParams();
        });
    });
}

portfolio.scrollEvents = function() {
    portfolio.footer.classList.add('fixed');
    updateFooterOnScroll();
    const originalOffset = portfolio.stickyNav.offsetTop + portfolio.stickyNav.offsetHeight;

    window.addEventListener('scroll', function(e) {
        const scrollPosition = window.scrollY;
        updateFooterOnScroll();
        if (scrollPosition >= originalOffset) {
            portfolio.stickyNav.classList.add('fixed');
        } else {
            portfolio.stickyNav.classList.remove('fixed');
        }
    });
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

const projectsClickHandler = (e) => {
    e.preventDefault();
    window.scrollBy(0, 1);
    setTimeout(_ => {
        portfolio.stickyNav.scrollIntoView({block: 'start'});
    }, 20);
}

const updateFooterOnScroll = () => {
    const isAtTop = window.scrollY === 0;
    portfolio.footer.classList.toggle('fixed', isAtTop);
    
    if (portfolio.projectsLink) {
        portfolio.projectsLink.removeEventListener('click', projectsClickHandler);
        if (isAtTop) {
            portfolio.projectsLink.addEventListener('click', projectsClickHandler);
        }
    }
}

const showHideSuggestions = (action) => {
    if (action === 'hide') {
        portfolio.suggestionsDiv.classList.add('hidden');
    } else if (action === 'show') {
        portfolio.suggestionsDiv.classList.remove('hidden');
    }
}

const inputHandler = (e) => {
    clearTimeout(portfolio.debouceTimeout);
    portfolio.debouceTimeout = setTimeout(() => {
        const searchValue = e.target.value;
        if (searchValue) {
            portfolio.clearFiltersBtn.classList.remove('hidden');
        } else {
            portfolio.clearFiltersBtn.classList.add('hidden');
        }

        if (searchValue.length > 2) {
            portfolio.filteredProjects = portfolio.projectsHtml.filter(htmlString => htmlString.includes(searchValue));
            portfolio.addProjectHtml();
            document.getElementById('projects-wrapper-anchor').scrollIntoView({block: 'start'});
        }
    }, 300);
}
