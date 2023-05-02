import { colorSquare, defaultColorSquareParams } from "../components/DoodleBoard"
const randomColor = require("randomcolor");


export function colorSquaresInSequence(params) {
    let timeOffset = 0;  // ms
    let timeOffsetDelay = 100;
    params.collection.forEach((element) => {
        setTimeout(() => {
            const colorSquareParams = {
                "square": element,
                "state": params.state,
                "duration": params.duration,
                "easing": params.easing,
                "colorFade": params.colorFade,
                "luminosity": params.luminosity
            };
            colorSquare({...defaultColorSquareParams, ...colorSquareParams});
        }, timeOffset += timeOffsetDelay)
    });
}

export function ringClick(params) {
    const cellSize = params.state.cellSize;
    const grid = document.querySelector('.doodle-board');
    let maxOffset = Math.floor(Math.min(grid.offsetWidth, grid.offsetHeight) / (2 * cellSize));
    maxOffset = maxOffset > 4 ? 4 : maxOffset;
    let timeOffset = 0;  // ms
    let timeOffsetDelay = 100;
    const selectedColor = randomColor({luminosity: params.luminosity});

    for (let offset = 1; offset <= maxOffset; offset++) {
        setTimeout(() => {
            const selectedSquares = getRingOfSquaresAroundTarget(params.target, offset);
            selectedSquares.forEach((square) => {
                const colorSquareParams = {
                    "square": square,
                    "state": params.state,
                    "chosenColor": selectedColor,
                    "duration": params.duration,
                    "easing": params.easing,
                    "colorFade": params.colorFade,
                    "luminosity": params.luminosity
                };
                colorSquare({...defaultColorSquareParams, ...colorSquareParams});
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

export function columnOrRowClick(params) {
    const { row, col } = params.target.dataset;
    const rowAndCol = {
        "row": parseInt(row),
        "col": parseInt(col)
    };
    const columnSquares = document.querySelectorAll(`[data-${params.type}="${rowAndCol[params.type]}"]`);
    const beforeTarget = [];
    const afterTarget = [];

    columnSquares.forEach((squareEl) => {
        let squareRowOrCol = parseInt(squareEl.dataset.col);
        let comparisonRowOrCol = rowAndCol["col"];
        if (params.type === "col") {
            squareRowOrCol = parseInt(squareEl.dataset.row);
            comparisonRowOrCol = rowAndCol["row"];
        }
        if (squareRowOrCol < comparisonRowOrCol) {
            beforeTarget.push(squareEl);
        } else if (squareRowOrCol >= comparisonRowOrCol) {
            afterTarget.push(squareEl);
        }
    });

    let defaultColorSquaresParams = {
        "state": params.state,
        "duration": params.duration,
        "easing": params.easing,
        "colorFade": params.colorFade
    };

    if (params.before) {
        defaultColorSquaresParams["collection"] = beforeTarget.reverse();
    } else {
        defaultColorSquaresParams["collection"] = afterTarget;
    }

    colorSquaresInSequence(defaultColorSquaresParams);
}