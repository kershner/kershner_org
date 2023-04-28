import { defaultState } from "../components/DoodleState"


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
    return calculateNumberOfCells(getComputedButtonSize());
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

        const trueFalseParams = ["colorFade", "autoDoodle", "menuOpen"];
        // Convert true/false query params to actual JS bools
        trueFalseParams.forEach((param) => {
            params[param] = params[param] !== "false";
        });
    }

    return params;
}

export function updateUrlParams(state) {
    // Pop out unnecessary system params
    let stateCopy = { ...state };
    const keysToRemove = [
        "numSquares",
        "mouseDown",
        "updatingUrlParams"
    ];

    function removeKeys(obj, keys) {
        keys.forEach(key => delete obj[key]);
        return obj;
    }

    stateCopy = removeKeys(stateCopy, keysToRemove);
    history.replaceState(null, null, `?${encodeParams(stateCopy)}`);
}

export async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
}