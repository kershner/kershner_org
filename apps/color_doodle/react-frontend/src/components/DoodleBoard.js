import React, { useState, useContext, useEffect } from "react"
const randomColor = require("randomcolor");
import { GlobalStateContext } from "./DoodleState"
import ViewportResize from "./ViewportResize"
import { numCols, range } from "../utils/util"


export function colorSquare(squareEl, state, callback=null, color=null) {
    squareEl.addEventListener("transitionend", transitionEndHandler);

    const chosenColor = color ? color : randomColor({luminosity: state.luminosity});
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
        borderStyle: globalState.borderStyle,
        transition: `background-color ${globalState.animationDelay}s ${globalState.animationEasing}`
    };

    function handleMouseEnter(e) {
        if (globalState.mouseDown) {
            colorAdjacentSquares(e.target, 1);
        } else {
            colorSquare(e.target, globalState);
        }
    }

    function handleMouseLeave(e) {
    }

    function handleMouseDown(e) {
        updateGlobalState("mouseDown", true);
        colorAdjacentSquares(e.target, 1);
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

    function handleClick(e) {
    }

    function colorAdjacentSquares(square, offset=1) {
        const { row, col } = square.dataset;
        const adjacentSquares = getAdjacentSquares(+row, +col, offset);
        const chosenColor = randomColor({luminosity: globalState.luminosity});

        adjacentSquares.forEach(({ row, col }) => {
            const selector = `.doodle-square[data-row="${row}"][data-col="${col}"]`;
            const square = document.querySelector(selector);
            if (square) {
                colorSquare(square, globalState, null, chosenColor);
            }
        });
    }

    function getAdjacentSquares(row, col, offset) {
        const squares = [];
        for (let r=row-offset; r<=row+offset; r++) {
            for (let c=col-offset; c<=col+offset; c++) {
                squares.push({ row: r, col: c });
            }
        }
        return squares;
    }

    return (
        <button style={divStyle}
                className="doodle-square"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onClick={handleClick}
            {...props.dataAttrs} >
        </button>
    );
}

function DoodleSquares() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const doodleSquares = [];
    for (let i=0; i<globalState.numSquares; i++) {
        const row = Math.floor(i / numCols(globalState.cellSize));
        const col = i % numCols(globalState.cellSize);
        const dataAttrs = {
            'data-row': row,
            'data-col': col
        };

        doodleSquares.push(<DoodleSquare key={i} dataAttrs={dataAttrs} />);
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