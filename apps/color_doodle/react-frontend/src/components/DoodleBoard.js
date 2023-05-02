import React, { useState, useContext, useEffect } from "react"
const randomColor = require("randomcolor");
import { GlobalStateContext, defaultState } from "./DoodleState"
import ViewportResize from "./ViewportResize"
import { numCols } from "../utils/util"
import { colorSquaresInSequence, ringClick, columnOrRowClick } from "../utils/animationHelper"


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

    const chosenColor = params.chosenColor ? params.chosenColor : randomColor({luminosity: params.state.luminosity});
    const chosenDuration = params.duration ? params.duration : params.state.autoDoodleAnimationDuration;
    const chosenEasing = params.easing ? params.easing : params.state.autoDoodleAnimationEasing;
    const colorFade = params.colorFade ? params.colorFade : params.state.colorFade;
    params.square.style.transition = `background-color ${chosenDuration}s ${chosenEasing}`;
    params.square.style.backgroundColor = chosenColor;

    function transitionEndHandler() {
        if (colorFade) {
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
            const colorFade = globalState.colorFade;
            const defaultClickParams = {
                "target": e.target,
                "state": globalState,
                "duration": duration,
                "easing": easing,
                "colorFade": colorFade
            };
            let extraColumnOrRowParams = {
                "type": "col",
                "before": true
            };

            switch (globalState.clickEffectMode) {
                case "ring":
                    ringClick(defaultClickParams);
                    break;
                case "rowAndCol":
                    columnOrRowClick({...extraColumnOrRowParams, ...defaultClickParams});
                    extraColumnOrRowParams.type = "row";
                    columnOrRowClick({...extraColumnOrRowParams, ...defaultClickParams});
                    break;
                case "row":
                    extraColumnOrRowParams.type = "row";
                    columnOrRowClick({...extraColumnOrRowParams, ...defaultClickParams});
                    break;
                case "column":
                    columnOrRowClick({...extraColumnOrRowParams, ...defaultClickParams});
                    break;
                case "rain":
                    extraColumnOrRowParams.before = false;
                    columnOrRowClick({...extraColumnOrRowParams, ...defaultClickParams});
                    break;
                default:
                    colorAdjacentSquares(e.target, 1, duration, easing);
                    break;
            }
        }
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
                const colorSquareParams = {
                    "square": square,
                    "state": globalState,
                    "chosenColor": chosenColor,
                    "duration": chosenDuration,
                    "easing": chosenEasing
                };
                colorSquare({...defaultColorSquareParams, ...colorSquareParams});
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