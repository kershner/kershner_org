import React, { useState, useContext, useEffect } from "react"
const randomColor = require("randomcolor");
import { GlobalStateContext } from "./DoodleState"
import ViewportResize from "./ViewportResize"
import { numCols, colorSquaresInSequence } from "../utils/util"


export function colorSquare(squareEl, state, callback = null, color = null, duration = null, easing = null) {
    squareEl.addEventListener("transitionend", transitionEndHandler);

    const chosenColor = color ? color : randomColor({luminosity: state.luminosity});
    const chosenDuration = duration ? duration : state.autoDoodleAnimationDuration;
    const chosenEasing = easing ? easing : "ease-out";
    squareEl.style.transition = `background-color ${chosenDuration}s ${chosenEasing}`;
    squareEl.style.backgroundColor = chosenColor;

    function transitionEndHandler() {
        if (state.colorFade) {
            squareEl.style.backgroundColor = "unset";
        }

        squareEl.addEventListener("transitionend", removeTransitionEndHandler);
    }

    function removeTransitionEndHandler() {
        squareEl.removeEventListener("transitionend", transitionEndHandler);

        if (callback) {
            callback();
        }
    }
}

function DoodleSquare(props) {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const divStyle = {
        flexBasis: `${100 / numCols(globalState.cellSize) }%`,
        height: `${globalState.cellSize}px`,
        borderWidth: `${globalState.borderWidth}px`,
        borderRightColor: globalState.borderColor,
        borderBottomColor: globalState.borderColor,
        borderStyle: globalState.borderStyle
    };

    function handleMouseEnter(e) {
        if (globalState.hoverEffectEnabled) {
            const radius = parseInt(globalState.hoverEffectRadius);
            const duration = globalState.hoverEffectAnimationDuration;
            const easing = globalState.hoverEffectAnimationEasing;
            colorAdjacentSquares(e.target, radius, duration, easing);
        }
    }

    function handleMouseDown(e) {
        if (globalState.clickEffectEnabled) {
            updateGlobalState("mouseDown", true);
            const duration = globalState.clickEffectAnimationDuration;
            const easing = globalState.clickEffectAnimationEasing;

            switch (globalState.clickEffectMode) {
                case "ring":
                    ringClick(e.target);
                    break;
                case "rowAndCol":
                    columnOrRowClick(e.target, "row", true);
                    columnOrRowClick(e.target, "col", true);
                    break;
                case "row":
                    columnOrRowClick(e.target, "row", true);
                    break;
                case "column":
                    columnOrRowClick(e.target, "col", true);
                    break;
                case "rain":
                    columnOrRowClick(e.target);
                    break;
                default:
                    colorAdjacentSquares(e.target, 1, duration, easing);
                    break;
            }
        }
    }

    function ringClick(target) {
        const duration = globalState.clickEffectAnimationDuration;
        const easing = globalState.clickEffectAnimationEasing;
        const cellSize = globalState.cellSize;
        const grid = document.querySelector('.doodle-board');
        const maxOffset = Math.floor(Math.min(grid.offsetWidth, grid.offsetHeight) / (2 * cellSize));
        let timeOffset = 0;  // ms
        let timeOffsetDelay = 100;
        const selectedColor = randomColor({luminosity: globalState.luminosity});

        for (let offset = 1; offset <= maxOffset; offset++) {
            setTimeout(() => {
                const selectedSquares = getRingOfSquaresAroundTarget(target, offset);
                selectedSquares.forEach((square) => {
                    colorSquare(square, globalState, null, selectedColor, duration, easing);
                });

            }, timeOffset += timeOffsetDelay);
        }
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

    function columnOrRowClick(target, type = "col", before = false) {
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

        const duration = globalState.clickEffectAnimationDuration;
        const easing = globalState.clickEffectAnimationEasing;
        if (before) {
            colorSquaresInSequence(beforeTarget.reverse(), globalState, duration, easing);
        }
        colorSquaresInSequence(afterTarget, globalState, duration, easing);
    }

    function handleMouseUp(e) {
        updateGlobalState("mouseDown", false);
    }

    function handleTouchStart(e) {
        handleMouseDown(e);
    }

    function handleTouchEnd(e) {
        handleMouseUp(e);
    }

    function colorAdjacentSquares(square, offset = 1, duration = null, easing = null) {
        const { row, col } = square.dataset;
        const adjacentSquares = getAdjacentSquares(+row, +col, offset);
        const chosenColor = randomColor({luminosity: globalState.luminosity});
        const chosenDuration = duration ? duration : "0.1";
        const chosenEasing = easing ? easing : "ease";

        adjacentSquares.forEach(({ row, col }) => {
            const selector = `.doodle-square[data-row="${row}"][data-col="${col}"]`;
            const square = document.querySelector(selector);
            if (square) {
                colorSquare(square, globalState, null, chosenColor, chosenDuration, chosenEasing);
            }
        });
    }

    function getAdjacentSquares(row, col, offset) {
        const squares = [];
        for (let r = row - offset; r <= row + offset; r++) {
            for (let c = col - offset; c <= col + offset; c++) {
                squares.push({row: r, col: c});
            }
        }
        return squares;
    }

    return (
        <button style={divStyle}
                className="doodle-square"
                onMouseEnter={handleMouseEnter}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            {...props.dataAttrs} >
        </button>
    );
}

function DoodleSquares() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const doodleSquares = [];
    for (let i = 0; i < globalState.numSquares; i++) {
        const row = Math.floor(i / numCols(globalState.cellSize));
        const col = i % numCols(globalState.cellSize);
        const dataAttrs = {
            'data-row': row,
            'data-col': col
        };

        doodleSquares.push(<DoodleSquare key={i} dataAttrs={dataAttrs}/>);
    }

    return (
        <div className="doodle-squares">
            {doodleSquares}
        </div>
    )
}

export default function DoodleBoard() {
    return (
        <div className="doodle-board">
            <ViewportResize />
            <DoodleSquares />
        </div>
    )
}