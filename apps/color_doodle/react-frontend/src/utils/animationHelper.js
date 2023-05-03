const randomColor = require("randomcolor");

export const defaultColorSquareParams = {
    "square": null,
    "state": null,
    "callback": null,
    "chosenColor": null,
    "duration": null,
    "easing": null,
    "colorFade": null
};

export function colorSquare(params) {
    params.square.addEventListener("transitionend", transitionEndHandler);
    const chosenColor = params.chosenColor ? params.chosenColor : randomColor({luminosity: params.luminosity});
    const chosenDuration = params.duration ? params.duration : params.state.autoDoodleAnimationDuration;
    const chosenEasing = params.easing ? params.easing : params.state.autoDoodleAnimationEasing;
    params.square.style.transition = `background-color ${chosenDuration}s ${chosenEasing}`;
    params.square.style.backgroundColor = chosenColor;

    function transitionEndHandler() {
        if (params.colorFade) {
            params.square.style.backgroundColor = "unset";
        }

        params.square.addEventListener("transitionend", removeTransitionEndHandler);
    }

    function removeTransitionEndHandler() {
        params.square.removeEventListener("transitionend", transitionEndHandler);

        if (params.callback) {
            params.callback();
        }
    }
}

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
        "colorFade": params.colorFade,
        "luminosity": params.luminosity
    };

    if (params.before) {
        defaultColorSquaresParams["collection"] = beforeTarget.reverse();
        colorSquaresInSequence(defaultColorSquaresParams);
    }

    defaultColorSquaresParams["collection"] = afterTarget;
    colorSquaresInSequence(defaultColorSquaresParams);
}

export function colorRandomSquare(randomSquare, fill = false) {
    let modifiedState = {...this.state};
    const duration = modifiedState.autoDoodleAnimationDuration;
    const easing = modifiedState.autoDoodleAnimationEasing;

    if (fill) {
        modifiedState.colorFade = !this.currentlyFilling;
    }

    const colorSquareParams = {
        "square": randomSquare,
        "state": modifiedState,
        "duration": duration,
        "easing": easing
    };
    colorSquare({...defaultColorSquareParams, ...colorSquareParams});
}

export function colorAdjacentSquares(params) {
    const { row, col } = params.square.dataset;
    const adjacentSquares = getAdjacentSquares(+row, +col, params.offset);
    const chosenColor = randomColor({luminosity: params.luminosity});
    const chosenDuration = params.duration ? params.duration : "0.1";
    const chosenEasing = params.easing ? params.easing : "ease";

    adjacentSquares.forEach(({ row, col }) => {
        const selector = `.doodle-square[data-row="${row}"][data-col="${col}"]`;
        const square = document.querySelector(selector);
        if (square) {
            const colorSquareParams = {
                "square": square,
                "state": params.state,
                "chosenColor": chosenColor,
                "duration": chosenDuration,
                "easing": chosenEasing,
                "colorFade": params.colorFade
            };
            colorSquare({...defaultColorSquareParams, ...colorSquareParams});
        }
    });

    function getAdjacentSquares(row, col, offset) {
        const squares = [];
        for (let r = row - offset; r <= row + offset; r++) {
            for (let c = col - offset; c <= col + offset; c++) {
                squares.push({row: r, col: c});
            }
        }
        return squares;
    }
}

export function effectChoice(params) {
    const defaultEffectParams = {
        "target": params.square,
        "state": params.state,
        "duration": params.duration,
        "easing": params.easing,
        "colorFade": params.colorFade,
        "luminosity": params.luminosity
    };
    let extraColumnOrRowParams = {
        "type": "col",
        "before": true
    };

    switch (params.effect) {
        case "ring":
            ringClick(defaultEffectParams);
            break;
        case "rowAndCol":
            columnOrRowClick({...extraColumnOrRowParams, ...defaultEffectParams});
            extraColumnOrRowParams.type = "row";
            columnOrRowClick({...extraColumnOrRowParams, ...defaultEffectParams});
            break;
        case "row":
            extraColumnOrRowParams.type = "row";
            columnOrRowClick({...extraColumnOrRowParams, ...defaultEffectParams});
            break;
        case "column":
            columnOrRowClick({...extraColumnOrRowParams, ...defaultEffectParams});
            break;
        case "rain":
            extraColumnOrRowParams.before = false;
            columnOrRowClick({...extraColumnOrRowParams, ...defaultEffectParams});
            break;
        case "randomFill":
            colorRandomSquare(params.square, true);
            break;
        case "block":
            const blockParams = {
                "square": params.square,
                "offset": 1
            };
            colorAdjacentSquares({...blockParams, ...defaultEffectParams});
            break;
        default:  // Random
            colorRandomSquare(params.square, false);
            break;
    }
}