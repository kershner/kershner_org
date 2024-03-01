import { defaultState } from "../components/DoodleState.jsx"


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

export function getNewGridNumCells() {
    let cellSize;
    try {
        cellSize = getComputedButtonSize();
    } catch (e) {
        cellSize = defaultState.cellSize;
    }
    return calculateNumberOfCells(cellSize);
}

export function encodeParams(params) {
    return Object.keys(params)
        .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(params[key]))
        .join('&');
}

export function parseParams() {
    let params = defaultState;

    if (window.location.search !== "") {
        const urlSearchParams = new URLSearchParams(window.location.search);
        params = Object.fromEntries(urlSearchParams.entries());

        // Convert true/false query params to actual JS bools
        for (const key in params) {
            const value = params[key];
            if (value === "true" || value === "false") {
                params[key] = value !== "false";
            }
        }
    }

    return params;
}

export function updateUrlParams(state) {
    // Pop out unnecessary system params
    let stateCopy = {...state};
    const keysToRemove = [
        "numSquares",
        "mouseDown"
    ];

    function removeKeys(obj, keys) {
        keys.forEach(key => delete obj[key]);
        return obj;
    }

    stateCopy = removeKeys(stateCopy, keysToRemove);
    history.replaceState(null, null, `?${encodeParams(stateCopy)}`);

    // update footer link hrefs
    document.querySelectorAll(".preserve-params").forEach((el) => {
        el.href = `${el.href}?${encodeParams(stateCopy)}`;
    })
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