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
    'debouceTimeout'        : undefined,
    'currentFilterTerms'    : []
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
    
    updateTechTagClasses();
    projectTagClickEvents();
    colorWave.init();

    setTimeout(() => {
        portfolio.projectsWrapper.style.transition = '';
    }, 200);
}

portfolio.projectFilter = function() {
    portfolio.projectSearch.addEventListener('input', searchFilterInputHandler);
    portfolio.projectSearch.addEventListener('change', searchFilterInputHandler);

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
        portfolio.currentFilterTerms = [];
        portfolio.filteredProjects = portfolio.projectsHtml;
        portfolio.addProjectHtml();
    });
}

portfolio.searchSuggestions = function() {
    const suggestionFocusHandler = (e) => {
        addOrRemoveFilterTerm(e.target.textContent);
    }

    portfolio.suggestionsDiv.querySelectorAll('li').forEach((li) => {
        li.addEventListener('click', suggestionFocusHandler);
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

const searchFilterInputHandler = (e) => {
    clearTimeout(portfolio.debouceTimeout);

    portfolio.debouceTimeout = setTimeout(() => {
        const searchValue = e.target.value.split(',').map(term => term.trim()).filter(Boolean);
        const { clearFiltersBtn, projectsHtml, addProjectHtml } = portfolio;

        clearFiltersBtn.classList.toggle('hidden', !searchValue.length);

        portfolio.currentFilterTerms = searchValue;
        let filteredHtmlEntries;
        const selectors = ['.project-tags', '.project-blurb', '.project-title'];

        filteredHtmlEntries = searchValue.flatMap(term => {
            return filterHtmlEntries(projectsHtml, term, selectors, true);
        });

        const htmlSet = new Set(filteredHtmlEntries);
        const uniqueHtmlArray = [...htmlSet];

        if (!uniqueHtmlArray.length && searchValue.length) {
            portfolio.projectsWrapper.innerHTML = `<div class='no-projects-found'>No projects matching filter values: <span>${searchValue.join(', ')}</span></div>`;
        } else if (!areArraysEqual(filteredHtmlEntries, portfolio.filteredProjects)) {
            portfolio.filteredProjects = uniqueHtmlArray.length ? uniqueHtmlArray : portfolio.projectsHtml;
            addProjectHtml();
            document.getElementById('projects-wrapper-anchor').scrollIntoView({ block: 'start' });
        }
    }, 300);
}

const filterHtmlEntries = (htmlList, substring, selectors, strict = false) => {
    const targetTextMatcher = strict
        ? new RegExp(`\\b${substring}\\b`, 'i')
        : new RegExp(substring, 'i');

    return htmlList
        .filter(htmlString => {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlString;

            return selectors.some(selector => {
                const targetElement = tempDiv.querySelector(selector);
                const targetText = targetElement ? targetElement.textContent.toLowerCase() : '';
                return targetTextMatcher.test(targetText);
            });
        })
        .map(filteredHtml => {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = filteredHtml;
            return tempDiv.innerHTML;
        });
}

const updateTechTagClasses = () => {
    const techTags = document.querySelectorAll('.tech-tag');    
    techTags.forEach(tag => {
        const tagText = tag.textContent.toLowerCase();
        const shouldApplyClass = portfolio.currentFilterTerms.length && portfolio.currentFilterTerms.some(substring =>
            tagText.includes(substring.toLowerCase())
        );

        if (shouldApplyClass) {
            tag.classList.add('dynamic-color');
        } else {
            tag.classList.remove('dynamic-color');
        }
    });
}

const projectTagClickEvents = () => {
    document.querySelectorAll('.project-tags .tech-tag').forEach((tag) => {
        tag.addEventListener('click', (e) => {
            addOrRemoveFilterTerm(e.target.textContent);
        });
    });
}

const addOrRemoveFilterTerm = (text) => {
    const index = portfolio.currentFilterTerms.indexOf(text);
    if (index !== -1) {
        portfolio.currentFilterTerms.splice(index, 1);
    } else {
        portfolio.currentFilterTerms.push(text);
    }

    portfolio.projectSearch.value = portfolio.currentFilterTerms;
    portfolio.projectSearch.dispatchEvent(new Event('input'));
} 