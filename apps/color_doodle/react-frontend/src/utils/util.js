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
    const urlSearchParams = new URLSearchParams(window.location.search);
    let params = Object.fromEntries(urlSearchParams.entries());

    // Convert true/false query params to actual JS bools
    params["colorFade"] = params["colorFade"] !== "false";
    params["autoDoodle"] = params["autoDoodle"] !== "false";

    return params;
}

export function updateUrlParams(state) {
    // Pop out unnecessary system params
    let stateCopy = { ...state };
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
}

export async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
}