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
    currentURL.searchParams.set(key, value);
    window.history.replaceState({}, '', currentURL.toString());
}
  
function updateLinksWithQueryParams() {
    const currentUrl = window.location.href;
    const urlObject = new URL(currentUrl);
    const queryParams = new URLSearchParams(urlObject.search);

    // Update footer link hrefs
    document.querySelectorAll('.preserve-params').forEach((el) => {
        const anchorElement = el;
        const href = anchorElement.href;
        const urlObject = new URL(href);
        const hrefWithOutQueryParams = urlObject.origin + urlObject.pathname;
        anchorElement.href = `${hrefWithOutQueryParams}?${queryParams.toString()}`;
    });
}