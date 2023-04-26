import React, { useState, useContext, useEffect } from "react"
const randomColor = require("randomcolor");
import { GlobalStateContext } from "./DoodleState"
import ViewportResize from "./ViewportResize"


export function colorSquare(squareEl, state, callback = null) {
    squareEl.addEventListener("transitionend", transitionEndHandler);
    squareEl.style.backgroundColor = randomColor({luminosity: state.luminosity});

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
    const numColumns = Math.floor(window.innerWidth / globalState.cellSize);
    const divStyle = {
        flexBasis: `${100 / numColumns}%`,
        height: `${globalState.cellSize}px`,
        borderWidth: `${globalState.borderWidth}px`,
        borderRightColor: globalState.borderColor,
        borderBottomColor: globalState.borderColor,
        borderStyle: globalState.borderStyle,
        transition: `background-color ${globalState.animationDelay}s ${globalState.animationEasing}`
    };

    function handleMouseEnter(e) {
        colorSquare(e.target, globalState);
    }

    function handleMouseLeave(e) {
    }

    function handleClick(e) {
        const row = e.target.getAttribute("data-row");
        const col = e.target.getAttribute("data-col");
        const fullRow = document.querySelectorAll(`[data-row="${row}"]`);
        const fullColumn = document.querySelectorAll(`[data-col="${col}"]`);

        fullColumn.forEach((element) => {
            colorSquare(element, globalState);
        });
        fullRow.forEach((element) => {
            colorSquare(element, globalState);
        });
    }

    return (
        <button style={divStyle}
                className="doodle-square"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onClick={handleClick}
                {...props.dataAttrs} >
        </button>
    );
}

function DoodleSquares() {
    const { globalState, updateGlobalState } = useContext(GlobalStateContext);
    const numberOfColumns = Math.floor(window.innerWidth / globalState.cellSize);
    const doodleSquares = [];
    for (let i=0; i<globalState.numSquares; i++) {
        const row = Math.floor(i / numberOfColumns);
        const col = i % numberOfColumns;
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