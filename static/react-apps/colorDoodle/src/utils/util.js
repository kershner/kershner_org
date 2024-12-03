import { getDefaultState } from "../components/DoodleState.jsx"


export const numCols = (cellSize) => {
    return Math.floor(window.innerWidth / cellSize);
};

export const numRows = (cellSize) => {
    return Math.floor(window.innerHeight / cellSize);
};

function getComputedButtonSize() {
    const button = document.querySelector(".doodle-square");
    const styles = getComputedStyle(button);
    return parseInt(styles.getPropertyValue("height"), 10);
}

export function calculateNumberOfCells(cellSize) {
    let totalCells = numRows(cellSize) * numCols(cellSize);

    // Adding extra row so grid extends beyond viewport
    totalCells += numCols(cellSize);

    return totalCells;
}

export function getNewGridNumCells(cellSize) {
    if (cellSize === undefined) {
        try {
            cellSize = getComputedButtonSize();
        } catch (e) {
            cellSize = getDefaultState().cellSize;
        }
    }
    return calculateNumberOfCells(cellSize);
}

export function encodeParams(params) {
    return Object.keys(params)
        .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(params[key]))
        .join('&');
}

export function parseParams() {
    if (window.location.search === "") {
        return {}; // No query params, return an empty object
    }

    const urlSearchParams = new URLSearchParams(window.location.search);
    const params = Object.fromEntries(urlSearchParams.entries());

    // Convert true/false query params to actual JS bools
    for (const key in params) {
        const value = params[key];
        if (value === "true" || value === "false") {
            params[key] = value !== "false";
        } else if (!isNaN(value)) {
            // Convert numeric strings to numbers
            params[key] = parseFloat(value);
        }
    }

    return params;
}

export function removeQueryParams() {
    const currentUrl = window.location.href;
    const urlObject = new URL(currentUrl);
    urlObject.search = '';
    window.history.replaceState({}, document.title, urlObject.toString());
}

export function addOrUpdateQueryParam(key, value) {
    const currentUrl = window.location.href;
    const urlObject = new URL(currentUrl);
    const queryParams = new URLSearchParams(urlObject.search);
    queryParams.set(key, value);
    urlObject.search = queryParams.toString();
    window.history.replaceState({}, document.title, urlObject.toString());
    
    updateLinksWithQueryParams();
}

export function updateLinksWithQueryParams() {
    const currentUrl = window.location.href;
    const urlObject = new URL(currentUrl);
    const queryParams = new URLSearchParams(urlObject.search);
    
    // Update footer link hrefs
    document.querySelectorAll(".preserve-params").forEach((el) => {
        const href = el.href;
        const urlObject = new URL(href);
        const hrefWithOutQueryParams = urlObject.origin + urlObject.pathname;
        el.href = `${hrefWithOutQueryParams}?${queryParams.toString()}`;
    });
}

export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
    } catch (err) {
        console.error('Failed to copy: ', err);
    }
}

export function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

export function updateBackgroundColor(state) {
    const darkColor = "#202123";
    const lightColor = "#FFFFFF";

    switch (state.backgroundColor) {
    case "dark":
        document.body.style.backgroundColor = darkColor;
        document.body.classList.add("dark-mode");
        break;
    case "light":
        document.body.style.backgroundColor = lightColor;
        document.body.classList.remove("dark-mode");
        break;
    }
}