import { colorSquare } from "../components/DoodleBoard"
const randomColor = require("randomcolor");


export function colorSquaresInSequence(collection, state, duration = "0.1", easing = "ease") {
    let timeOffset = 0;  // ms
    let timeOffsetDelay = 100;
    collection.forEach((element) => {
        setTimeout(() => {
            colorSquare(element, state, null, null, duration, easing);
        }, timeOffset += timeOffsetDelay)
    });
}

export function ringClick(target, state, duration = null, easing = null) {
    const cellSize = state.cellSize;
    const grid = document.querySelector('.doodle-board');
    const maxOffset = Math.floor(Math.min(grid.offsetWidth, grid.offsetHeight) / (2 * cellSize));
    let timeOffset = 0;  // ms
    let timeOffsetDelay = 100;
    const selectedColor = randomColor({luminosity: state.luminosity});

    for (let offset = 1; offset <= maxOffset; offset++) {
        setTimeout(() => {
            const selectedSquares = getRingOfSquaresAroundTarget(target, offset);
            selectedSquares.forEach((square) => {
                colorSquare(square, state, null, selectedColor, duration, easing);
            });

        }, timeOffset += timeOffsetDelay);
    }

    function getRingOfSquaresAroundTarget(target, offset) {
        const selectedSquares = [];
        const row = parseInt(target.dataset.row);
        const col = parseInt(target.dataset.col);

        for (let i = -offset; i <= offset; i++) {
            for (let j = -offset; j <= offset; j++) {
                if (Math.abs(i) !== offset && Math.abs(j) !== offset) continue; // skip cells inside ring
                const square = document.querySelector(`button[data-row="${row + i}"][data-col="${col + j}"]`);
                if (square) selectedSquares.push(square);
            }
        }

        return selectedSquares;
    }
}

export function columnOrRowClick(target, state, type = "col", before = false, duration = null, easing = null) {
    const { row, col } = target.dataset;
    const rowAndCol = {
        "row": parseInt(row),
        "col": parseInt(col)
    };
    const columnSquares = document.querySelectorAll(`[data-${type}="${rowAndCol[type]}"]`);
    const beforeTarget = [];
    const afterTarget = [];

    columnSquares.forEach((squareEl) => {
        let squareRowOrCol = parseInt(squareEl.dataset.col);
        let comparisonRowOrCol = rowAndCol["col"];
        if (type === "col") {
            squareRowOrCol = parseInt(squareEl.dataset.row);
            comparisonRowOrCol = rowAndCol["row"];
        }
        if (squareRowOrCol < comparisonRowOrCol) {
            beforeTarget.push(squareEl);
        } else if (squareRowOrCol >= comparisonRowOrCol) {
            afterTarget.push(squareEl);
        }
    });

    if (before) {
        colorSquaresInSequence(beforeTarget.reverse(), state, duration, easing);
    }
    colorSquaresInSequence(afterTarget, state, duration, easing);
}