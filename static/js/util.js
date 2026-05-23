function hasClass(el, className) {
    if (el.classList) {
        return el.classList.contains(className);
    }
    return !!el.className.match(new RegExp('(\\s|^)' + className + '(\\s|$)'));
}

function addClass(el, className) {
    if (el.classList) {
        el.classList.add(className);
    } else if (!hasClass(el, className)) {
        el.className += " " + className;
    }
}

function addClassWithDelay(element, cssClass, delay) {
    setTimeout(function() {
        addClass(element, cssClass);
    }, delay);
}

function removeClass(el, className) {
    if (el.classList) {
        el.classList.remove(className);
    } else if (hasClass(el, className)) {
        var reg = new RegExp('(\\s|^)' + className + '(\\s|$)');
        el.className = el.className.replace(reg, ' ');
    }
}

/**
 * Shuffles array in place.
 * @param {Array} a items An array containing the items.
 */
function shuffle(a) {
    var j, x, i;
    for (i = a.length - 1; i > 0; i--) {
        j = Math.floor(Math.random() * (i + 1));
        x = a[i];
        a[i] = a[j];
        a[j] = x;
    }
    return a;
}

function randomIntFromInterval(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

/**
 * Detects collision between two HTMLElements
 * @param htmlElementA
 * @param htmlElementB
 * @returns {boolean}
 */
function detectCollision(htmlElementA, htmlElementB) {
    var aRect = htmlElementA.getBoundingClientRect();
    var bRect = htmlElementB.getBoundingClientRect();

    return !(
        ((aRect.top + aRect.height) < (bRect.top)) ||
        (aRect.top > (bRect.top + bRect.height)) ||
        ((aRect.left + aRect.width) < bRect.left) ||
        (aRect.left > (bRect.left + bRect.width))
    );
}

function fetchWrapper(endpoint, method, params, headers={}, callback) {
    var callParams = {
        headers     : headers,
        method      : method,
        credentials : 'include',
        mode        : 'same-origin'
    };
    if (params instanceof FormData) {
        callParams['body'] = params
    } else {
        if (method.toLowerCase() === 'post') {
            callParams['body'] = JSON.stringify(params);
        }
    }

    fetch(endpoint, callParams)
    .then((response) => {
        return response.text();
    })
    .then((data) => {
        let response = JSON.parse(data);
        callback(response);
    })
    .catch(function(ex) {
        console.log(ex);
    });
}


// JavaScript function to get cookie by name; retrieved from https://docs.djangoproject.com/en/3.2/ref/csrf/
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            // Does this cookie string begin with the name we want?
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

function setQueryParam(key, value) {
    const currentURL = new URL(window.location.href);

    if (value === null || value === undefined || value === '') {
        currentURL.searchParams.delete(key);
    } else {
        currentURL.searchParams.set(key, value);
    }

    window.history.replaceState(window.history.state, '', currentURL.toString());
}
  
function updateLinksWithQueryParams() {
    const currentUrl = window.location.href;
    const urlObject = new URL(currentUrl);
    const queryParams = urlObject.searchParams.toString();

    document.querySelectorAll('.preserve-params').forEach((el) => {
        const anchorElement = el;
        const linkUrl = new URL(anchorElement.href);
        const hrefWithoutQueryParams = `${linkUrl.origin}${linkUrl.pathname}`;
        const hash = linkUrl.hash || '';

        anchorElement.href = queryParams
            ? `${hrefWithoutQueryParams}?${queryParams}${hash}`
            : `${hrefWithoutQueryParams}${hash}`;
    });
}

function syncPreserveParamsLinksOnUrlChange() {
    if (!window.history || window.history.preserveParamsLinksSynced) return;

    const dispatchUrlChange = () => {
        window.dispatchEvent(new Event('urlchange'));
    };

    ['pushState', 'replaceState'].forEach((method) => {
        const originalMethod = window.history[method];

        window.history[method] = function() {
            const result = originalMethod.apply(this, arguments);
            dispatchUrlChange();
            return result;
        };
    });

    window.addEventListener('popstate', dispatchUrlChange);
    window.addEventListener('urlchange', updateLinksWithQueryParams);
    window.history.preserveParamsLinksSynced = true;
}

syncPreserveParamsLinksOnUrlChange();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateLinksWithQueryParams);
} else {
    updateLinksWithQueryParams();
}

function areArraysEqual(arr1, arr2) {
    return arr1.length === arr2.length &&
           arr1.every((value, index) => value === arr2[index]);
}

// Function to lighten a hex color by a percentage
function lightenColor(hex, percent) {
    // Remove the # if present
    hex = hex.replace('#', '');
    
    // Handle shorthand hex codes like #000
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    
    // Convert to RGB
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);
    
    // Handle NaN values (in case parsing fails)
    r = isNaN(r) ? 0 : r;
    g = isNaN(g) ? 0 : g;
    b = isNaN(b) ? 0 : b;
    
    // Lighten the color using the formula from the provided function
    r = Math.min(255, Math.round(r + (255 - r) * (percent / 100)));
    g = Math.min(255, Math.round(g + (255 - g) * (percent / 100)));
    b = Math.min(255, Math.round(b + (255 - b) * (percent / 100)));
    
    // Convert back to hex ensuring proper zero padding
    const rHex = r.toString(16).padStart(2, '0');
    const gHex = g.toString(16).padStart(2, '0');
    const bHex = b.toString(16).padStart(2, '0');
    
    return `#${rHex}${gHex}${bHex}`;
}