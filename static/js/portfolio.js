window.portfolio = {
    initialLoad: true,
    projectsPerPage: 0,
    projectsHtml: [],
    filteredProjects: [],
    colorChangeInterval: 10000,
    stickyNav: document.querySelector('.sticky-nav'),
    projectsWrapper: document.querySelector('.projects-wrapper'),
    projectWrappers: document.getElementsByClassName('project-wrapper'),
    moreProjectsBtn: document.getElementById('more-projects-btn'),
    footer: document.querySelector('.footer'),
    projectsLink: document.querySelector('a[title="Projects"]'),
    styleToggles: document.querySelectorAll('input[name="projectStyle"]'),
    projectSearch: document.getElementById('projectSearch'),
    suggestionsDiv: document.querySelector('.suggestions'),
    clearFiltersBtn: document.querySelector('.clearFiltersBtn'),
    currentColor: '',
    debounceTimeout: undefined,
    currentFilterTerms: [],
};

const portfolio = window.portfolio;
const mobileBreakpoint = 768;
const isMobile = window.innerWidth <= mobileBreakpoint;

portfolio.init = function(baseS3Url) {
    const darkMode = document.body.classList.contains('dark-mode');

    portfolio.currentColor = randomColor({luminosity: darkMode ? 'bright' : 'dark'});
    portfolio.changeColors(false);

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            document.documentElement.classList.add('dynamic-colors-loaded');
            portfolio.rotateColors();
        });
    });

    portfolio.startGraphicsWall(baseS3Url);
};

portfolio.startGraphicsWall = function(baseS3Url) {
    const start = async () => {
        try {
            const { default: GraphicsWall } = await import(`${baseS3Url}/js/graphicsWall/graphicsWall.js`);

            const mobileWallTypes = ['fabric', 'orbs', 'water'];
            const desktopOnlyWallTypes = ['grass'];
            const wallTypes = isMobile ? mobileWallTypes : [...mobileWallTypes, ...desktopOnlyWallTypes];
            const type = wallTypes[Math.floor(Math.random() * wallTypes.length)];

            window.graphicsWall = await GraphicsWall.init(baseS3Url, {
                type,
                global: {
                    showControls: true,
                    currentColor: portfolio.currentColor,
                },
            });

            window.graphicsWall.set('wall.colorTransitionSpeed', 0.007);
        } catch (error) {
            console.warn('Graphics wall failed to load.', error);
        }
    };

    const scheduleStart = () => {
        requestAnimationFrame(() => {
            if ('requestIdleCallback' in window) {
                requestIdleCallback(start, { timeout: 2500 });
            } else {
                setTimeout(start, 1);
            }
        });
    };

    if (document.readyState === 'complete') {
        scheduleStart();
    } else {
        window.addEventListener('load', scheduleStart, { once: true });
    }
};

portfolio.addProjectHtml = function() {
    portfolio.projectsWrapper.innerHTML = portfolio.filteredProjects.join('');

    updateTechTagClasses();
    projectTagClickEvents();
};

portfolio.projectFilter = function() {
    portfolio.projectSearch.addEventListener('input', searchFilterInputHandler);
    portfolio.projectSearch.addEventListener('change', searchFilterInputHandler);

    portfolio.projectSearch.addEventListener('focus', () => {
        portfolio.projectSearch.classList.add('suggestions-active');
        showHideSuggestions('show');
    });

    portfolio.projectSearch.addEventListener('blur', () => {
        setTimeout(() => {
            portfolio.projectSearch.classList.remove('suggestions-active');
        }, 100);
    });

    const handleKeyEvent = (e) => {
        if (e.keyCode === 13 || e.key === 'Enter') {
            portfolio.projectSearch.classList.remove('suggestions-active');
            showHideSuggestions('hide');
        }
    };

    portfolio.projectSearch.addEventListener('keydown', handleKeyEvent);
    portfolio.projectSearch.addEventListener('keypress', handleKeyEvent);

    document.addEventListener('click', (event) => {
        if (!portfolio.projectSearch.contains(event.target)) {
            showHideSuggestions('hide');
        }
    });

    portfolio.clearFiltersBtn.addEventListener('click', () => {
        portfolio.projectSearch.value = '';
        portfolio.currentFilterTerms = [];
        portfolio.filteredProjects = portfolio.projectsHtml;
        portfolio.addProjectHtml();
    });
};

portfolio.searchSuggestions = function() {
    const suggestionFocusHandler = (e) => {
        if (e.type === 'click' || (e.type === 'keydown' && e.key === ' ')) {
            addOrRemoveFilterTerm(e.target.textContent);
        }
    };

    portfolio.suggestionsDiv.querySelectorAll('li').forEach((li) => {
        li.addEventListener('click', suggestionFocusHandler);
        li.addEventListener('keydown', suggestionFocusHandler);
    });
};

portfolio.projectStyleToggles = function() {
    const setProjectStyle = (newValue) => {
        portfolio.projectsWrapper.classList.remove('grid', 'list');
        portfolio.projectsWrapper.classList.add(newValue);
        setQueryParam('style', newValue);
    };

    portfolio.styleToggles.forEach((radio) => {
        radio.addEventListener('change', (e) => {
            setProjectStyle(e.target.value);
        });
    });

    const queryParamStyle = new URLSearchParams(window.location.search).get('style');

    if (queryParamStyle) {
        setProjectStyle(queryParamStyle);

        const matchingToggle = [...portfolio.styleToggles].find((radio) => radio.value === queryParamStyle);
        if (matchingToggle) {
            matchingToggle.checked = true;
        }
    }
};

portfolio.scrollEvents = function() {
    portfolio.footer.classList.add('fixed');
    updateFooterOnScroll();

    const originalOffset = portfolio.stickyNav.offsetTop + portfolio.stickyNav.offsetHeight;

    if (portfolio.initialLoad && window.scrollY > 0) {
        portfolio.filteredProjects = portfolio.projectsHtml;
        portfolio.initialLoad = false;
        portfolio.addProjectHtml();
    }

    window.addEventListener('scroll', () => {
        const scrollPosition = window.scrollY;

        if (portfolio.initialLoad) {
            portfolio.initialLoad = false;
            portfolio.addProjectHtml();
        }

        updateFooterOnScroll();

        if (scrollPosition >= originalOffset) {
            portfolio.stickyNav.classList.add('fixed');
        } else {
            portfolio.stickyNav.classList.remove('fixed');
        }
    });
};

portfolio.rotateColors = function() {
    window.rotateColorsInterval = setInterval(() => {
        portfolio.changeColors();
    }, portfolio.colorChangeInterval);
};

portfolio.changeColors = function(rotate = true) {
    if (rotate) {
        portfolio.currentColor = randomColor({luminosity: 'all'});
    }

    document.documentElement.style.setProperty('--dynamic-color', portfolio.currentColor);

    if (
        window.graphicsWall &&
        typeof window.graphicsWall.setCurrentColor === 'function' &&
        window.graphicsWall.get('global.rotateColors')
    ) {
        window.graphicsWall.setCurrentColor(portfolio.currentColor);
    }
};

const projectsClickHandler = (e) => {
    e.preventDefault();

    window.scrollBy(0, 1);

    setTimeout(() => {
        portfolio.stickyNav.scrollIntoView({block: 'start'});
    }, 20);
};

const updateFooterOnScroll = () => {
    const isAtTop = window.scrollY === 0;
    portfolio.footer.classList.toggle('fixed', isAtTop);

    if (portfolio.projectsLink) {
        portfolio.projectsLink.removeEventListener('click', projectsClickHandler);

        if (isAtTop) {
            portfolio.projectsLink.addEventListener('click', projectsClickHandler);
        }
    }
};

const showHideSuggestions = (action) => {
    if (action === 'hide') {
        portfolio.suggestionsDiv.classList.add('hidden');
    } else if (action === 'show') {
        portfolio.suggestionsDiv.classList.remove('hidden');
    }
};

const searchFilterInputHandler = (e) => {
    clearTimeout(portfolio.debounceTimeout);

    portfolio.debounceTimeout = setTimeout(() => {
        const searchValue = e.target.value
            .split(',')
            .map((term) => term.trim())
            .filter(Boolean);

        portfolio.clearFiltersBtn.classList.toggle('hidden', !searchValue.length);
        portfolio.currentFilterTerms = searchValue;

        const selectors = ['.project-tags', '.project-blurb', '.project-title'];

        const filteredHtmlEntries = searchValue.flatMap((term) => {
            return filterHtmlEntries(portfolio.projectsHtml, term, selectors, true);
        });

        const uniqueHtmlArray = [...new Set(filteredHtmlEntries)];

        if (!uniqueHtmlArray.length && searchValue.length) {
            portfolio.projectsWrapper.innerHTML = `<div class='no-projects-found'>No projects matching filter values: <span>${searchValue.join(', ')}</span></div>`;
        } else if (!areArraysEqual(filteredHtmlEntries, portfolio.filteredProjects)) {
            portfolio.filteredProjects = uniqueHtmlArray.length ? uniqueHtmlArray : portfolio.projectsHtml;
            portfolio.addProjectHtml();
            document.getElementById('projects-wrapper-anchor').scrollIntoView({block: 'start'});
        }
    }, 300);
};

const filterHtmlEntries = (htmlList, substring, selectors, strict = false) => {
    const targetTextMatcher = strict
        ? new RegExp(`\\b${substring}\\b`, 'i')
        : new RegExp(substring, 'i');

    return htmlList
        .filter((htmlString) => {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlString;

            return selectors.some((selector) => {
                const targetElement = tempDiv.querySelector(selector);
                const targetText = targetElement ? targetElement.textContent.toLowerCase() : '';

                return targetTextMatcher.test(targetText);
            });
        })
        .map((filteredHtml) => {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = filteredHtml;

            return tempDiv.innerHTML;
        });
};

const updateTechTagClasses = () => {
    const techTags = document.querySelectorAll('.tech-tag');

    techTags.forEach((tag) => {
        const tagText = tag.textContent.toLowerCase();
        const shouldApplyClass = portfolio.currentFilterTerms.length && portfolio.currentFilterTerms.some((substring) => {
            return tagText.includes(substring.toLowerCase());
        });

        tag.classList.toggle('dynamic-color', Boolean(shouldApplyClass));
    });
};

const projectTagClickEvents = () => {
    document.querySelectorAll('.project-tags .tech-tag').forEach((tag) => {
        tag.addEventListener('click', (e) => {
            e.target.classList.toggle('dynamic-color');
            addOrRemoveFilterTerm(e.target.textContent);
        });
    });
};

const addOrRemoveFilterTerm = (text) => {
    const index = portfolio.currentFilterTerms.indexOf(text);

    if (index !== -1) {
        portfolio.currentFilterTerms.splice(index, 1);
    } else {
        portfolio.currentFilterTerms.push(text);
    }

    portfolio.projectSearch.value = portfolio.currentFilterTerms;
    portfolio.projectSearch.dispatchEvent(new Event('input'));
};

document.addEventListener('DOMContentLoaded', () => {
    portfolio.init(window.PORTFOLIO_BASE_S3_URL);
    window.dispatchEvent(new Event('portfolioReady'));
});