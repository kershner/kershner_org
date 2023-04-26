function getComputedButtonSize() {
    const button = document.querySelector(".doodle-square");
    const styles = getComputedStyle(button);
    return parseInt(styles.getPropertyValue("height"), 10);
}

export function calculateNumberOfCells(cellSize) {
    const numberOfRows = Math.floor(window.innerHeight / cellSize);
    const numberOfColumns = Math.floor(window.innerWidth / cellSize);
    let totalCells = numberOfRows * numberOfColumns;

    // Adding extra row so grid extends beyond viewport
    totalCells += numberOfColumns;

    return totalCells;
}

export function getNewGridNumCells() {
    return calculateNumberOfCells(getComputedButtonSize());
}