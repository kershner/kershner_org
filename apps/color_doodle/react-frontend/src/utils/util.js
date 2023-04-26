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